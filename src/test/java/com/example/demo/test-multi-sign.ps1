# =============================================
# THRESHOLD MPC SIGNING — TEST SUITE
# API: /api/remote-signing  (Spring Boot :8080)
# =============================================

$API      = "http://localhost:8080/api"
$RUN_ID   = Get-Date -Format "HHmmss"
$OWNER    = "owner_$RUN_ID"
$SIGNER1  = "signer1_$RUN_ID"
$SIGNER2  = "signer2_$RUN_ID"
$PASSWORD = "Test@1234"
$WRONG_PW = "WrongPass"
$PDF_PATH = "E:/testpdf/test.pdf"

$script:PASS = 0
$script:FAIL = 0

function Write-Pass([string]$msg) {
    Write-Host "  [PASS] $msg" -ForegroundColor Green
    $script:PASS++
}
function Write-Fail([string]$msg) {
    Write-Host "  [FAIL] $msg" -ForegroundColor Red
    $script:FAIL++
}
function Write-Info([string]$msg) { Write-Host "  [INFO] $msg" -ForegroundColor Gray }
function Write-Section([string]$msg) {
    Write-Host "`n--- $msg ---" -ForegroundColor Cyan
}

# ── HTTP helper (Invoke-WebRequest wraps status code on error too) ───────────
function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body   = $null,
        [string]$Token  = $null
    )
    $uri     = "$API$Path"
    $headers = @{}
    if ($Token) { $headers["Authorization"] = "Bearer $Token" }

    try {
        $p = @{ Method = $Method; Uri = $uri; Headers = $headers; UseBasicParsing = $true }
        if ($Body) {
            $p["Body"]        = ($Body | ConvertTo-Json -Depth 10)
            $p["ContentType"] = "application/json"
        }
        $resp = Invoke-WebRequest @p
        $parsed = $null
        try { $parsed = $resp.Content | ConvertFrom-Json } catch {}
        return @{ Status = [int]$resp.StatusCode; Body = $parsed }
    } catch {
        $code = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode.value__ } else { 0 }
        return @{ Status = $code; Body = $_.ErrorDetails.Message }
    }
}

# ── BigInteger RSA partial-sig computation ────────────────────────────────────
# Java: sig = new BigInteger(1, docHashBytes).modPow(yi, n)   (big-endian positive)
# .NET BigInteger: little-endian, last byte = sign
Add-Type -AssemblyName System.Numerics

function ConvertHexToBI([string]$Hex) {
    # Pad odd-length hex (BigInteger.toString(16) omits leading zeros)
    if ($Hex.Length % 2 -ne 0) { $Hex = "0$Hex" }
    $bytes = [byte[]]@(for ($i = 0; $i -lt $Hex.Length; $i += 2) {
        [Convert]::ToByte($Hex.Substring($i, 2), 16)
    })
    # Reverse to little-endian, append 0x00 sign byte (positive)
    [byte[]]($bytes[($bytes.Length - 1)..0] + [byte]0x00)
}

function Compute-PartialSig([string]$HashBase64, [string]$YHex, [string]$NHex) {
    $hashBytes = [Convert]::FromBase64String($HashBase64)
    # big-endian → little-endian + sign byte
    $hashLE = [byte[]]($hashBytes[($hashBytes.Length - 1)..0] + [byte]0x00)

    $h = [System.Numerics.BigInteger]::new($hashLE)
    $y = [System.Numerics.BigInteger]::new((ConvertHexToBI $YHex))
    $n = [System.Numerics.BigInteger]::new((ConvertHexToBI $NHex))

    # Java: hashToInt = new BigInteger(1, hashBytes).mod(n)  then  .modPow(yi, n)
    $h   = [System.Numerics.BigInteger]::Remainder($h, $n)
    $sig = [System.Numerics.BigInteger]::ModPow($h, $y, $n)
    $le   = $sig.ToByteArray()
    # Remove trailing sign byte if present
    if ($le.Length -gt 1 -and $le[-1] -eq 0) { $le = $le[0..($le.Length - 2)] }
    # Reverse back to big-endian for Java
    $be   = [byte[]]($le[($le.Length - 1)..0])
    [Convert]::ToBase64String($be)
}

# =============================================
Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "   THRESHOLD SIGNING TEST SUITE         " -ForegroundColor Magenta
Write-Host "   Run ID: $RUN_ID                      " -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta

# ============================================
# SECTION 1: REGISTER & LOGIN
# ============================================
Write-Section "1. Register & Login (3 users)"

function Register-And-Login([string]$Username) {
    $r = Invoke-Api -Method POST -Path "/auth/register" -Body @{
        username = $Username
        email    = "$Username@test.com"
        password = $PASSWORD
    }
    if ($r.Status -eq 201) {
        Write-Pass "Registered $Username"
        return $r.Body.token
    }
    # Conflict (re-run) — fall back to login
    $r2 = Invoke-Api -Method POST -Path "/auth/login" -Body @{
        username = $Username; password = $PASSWORD
    }
    if ($r2.Status -eq 200) {
        Write-Pass "Logged in $Username (already existed)"
        return $r2.Body.token
    }
    Write-Fail "Cannot register/login $Username (reg=$($r.Status), login=$($r2.Status))"
    return $null
}

$TOKEN_OWNER   = Register-And-Login $OWNER
$TOKEN_SIGNER1 = Register-And-Login $SIGNER1
$TOKEN_SIGNER2 = Register-And-Login $SIGNER2

if (-not $TOKEN_OWNER -or -not $TOKEN_SIGNER1 -or -not $TOKEN_SIGNER2) {
    Write-Host "`n[ABORT] Auth failed — is the server running on :8080?" -ForegroundColor Red
    exit 1
}

# ============================================
# SECTION 2: KEY GROUP
# ============================================
Write-Section "2. Create Key Group (2-of-2)"

$kgResp = Invoke-Api -Method POST -Path "/remote-signing/keys/groups" -Token $TOKEN_OWNER -Body @{
    participants = @($SIGNER1, $SIGNER2)
    threshold    = 2
}
if ($kgResp.Status -eq 200) {
    Write-Pass "Key group created: $($kgResp.Body.groupId)"
    $GROUP_ID = $kgResp.Body.groupId
    $RSA_N    = $kgResp.Body.rsaModulusHex
} else {
    Write-Fail "Key group creation failed (status=$($kgResp.Status))"
    exit 1
}

$s1Resp = Invoke-Api -Method GET -Path "/remote-signing/keys/groups/$GROUP_ID/participants/$SIGNER1/share" -Token $TOKEN_SIGNER1
$s2Resp = Invoke-Api -Method GET -Path "/remote-signing/keys/groups/$GROUP_ID/participants/$SIGNER2/share" -Token $TOKEN_SIGNER2

if ($s1Resp.Status -eq 200) { Write-Pass "Got key share for $SIGNER1" } else { Write-Fail "Cannot get share for $SIGNER1 (status=$($s1Resp.Status))" }
if ($s2Resp.Status -eq 200) { Write-Pass "Got key share for $SIGNER2" } else { Write-Fail "Cannot get share for $SIGNER2 (status=$($s2Resp.Status))" }

$Y1 = $s1Resp.Body.yHex
$Y2 = $s2Resp.Body.yHex

# ============================================
# SECTION 3: UPLOAD DOCUMENT
# ============================================
Write-Section "3. Upload Document"

if (-not (Test-Path $PDF_PATH)) {
    Write-Fail "PDF not found: $PDF_PATH"
    Write-Info "Tạo file PDF test tại $PDF_PATH rồi chạy lại"
    exit 1
}

$uploadRaw = curl.exe -s -X POST `
    -H "Authorization: Bearer $TOKEN_OWNER" `
    -F "file=@$PDF_PATH" `
    "$API/remote-signing/documents/upload"

try {
    $uploadResp = $uploadRaw | ConvertFrom-Json
    if ($uploadResp.documentId) {
        Write-Pass "Document uploaded: $($uploadResp.documentId)"
        Write-Info "Hash: $($uploadResp.hashBase64.Substring(0,20))..."
        $DOC_ID   = $uploadResp.documentId
        $DOC_HASH = $uploadResp.hashBase64
    } else {
        Write-Fail "Upload response missing documentId: $uploadRaw"
        exit 1
    }
} catch {
    Write-Fail "Upload failed (JSON parse error): $uploadRaw"
    exit 1
}

# ============================================
# SECTION 4: CREATE SIGNING REQUEST
# ============================================
Write-Section "4. Create Signing Request"

$reqResp = Invoke-Api -Method POST -Path "/remote-signing/requests" -Token $TOKEN_OWNER -Body @{
    documentId   = $DOC_ID
    participants = @($SIGNER1, $SIGNER2)
    threshold    = 2
    keyGroupId   = $GROUP_ID
}
if ($reqResp.Status -eq 200) {
    Write-Pass "Signing request created: $($reqResp.Body.requestId) (status=$($reqResp.Body.status))"
    $REQ_ID = $reqResp.Body.requestId
} else {
    Write-Fail "Signing request failed (status=$($reqResp.Status)): $($reqResp.Body)"
    exit 1
}

# ============================================
# SECTION 5: CONFIRM PASSWORD — EDGE CASES
# ============================================
Write-Section "5. Confirm Password — Edge Cases"

Write-Info "Computing partial signature for $SIGNER1 (BigInteger RSA)..."
$SIG1 = Compute-PartialSig -HashBase64 $DOC_HASH -YHex $Y1 -NHex $RSA_N
Write-Info "SIG1 prefix: $($SIG1.Substring(0, [Math]::Min(20, $SIG1.Length)))..."

# 5a: Thiếu confirmPassword (field không có trong body)
$r = Invoke-Api -Method POST -Path "/remote-signing/requests/$REQ_ID/partial-sign" -Token $TOKEN_SIGNER1 -Body @{
    participantId          = $SIGNER1
    partialSignatureBase64 = $SIG1
}
if ($r.Status -eq 403) { Write-Pass "Thiếu confirmPassword → 403 Forbidden" }
else { Write-Fail "Thiếu confirmPassword phải trả 403 (got $($r.Status))" }

# 5b: Password sai
$r = Invoke-Api -Method POST -Path "/remote-signing/requests/$REQ_ID/partial-sign" -Token $TOKEN_SIGNER1 -Body @{
    participantId          = $SIGNER1
    partialSignatureBase64 = $SIG1
    confirmPassword        = $WRONG_PW
}
if ($r.Status -eq 403) { Write-Pass "Password sai → 403 Forbidden" }
else { Write-Fail "Password sai phải trả 403 (got $($r.Status))" }

# 5c: Password rỗng
$r = Invoke-Api -Method POST -Path "/remote-signing/requests/$REQ_ID/partial-sign" -Token $TOKEN_SIGNER1 -Body @{
    participantId          = $SIGNER1
    partialSignatureBase64 = $SIG1
    confirmPassword        = ""
}
if ($r.Status -eq 403) { Write-Pass "Password rỗng → 403 Forbidden" }
else { Write-Fail "Password rỗng phải trả 403 (got $($r.Status))" }

# 5d: Không phải participant (owner ký vào request của signer)
$r = Invoke-Api -Method POST -Path "/remote-signing/requests/$REQ_ID/partial-sign" -Token $TOKEN_OWNER -Body @{
    participantId          = $OWNER
    partialSignatureBase64 = $SIG1
    confirmPassword        = $PASSWORD
}
if ($r.Status -eq 400) { Write-Pass "Không phải participant → 400 Bad Request" }
else { Write-Fail "Không phải participant phải trả 400 (got $($r.Status))" }

# ============================================
# SECTION 6: HAPPY PATH — SIGNER1 KÝ
# ============================================
Write-Section "6. Signer1 Ký (confirmPassword đúng)"

$r = Invoke-Api -Method POST -Path "/remote-signing/requests/$REQ_ID/partial-sign" -Token $TOKEN_SIGNER1 -Body @{
    participantId          = $SIGNER1
    partialSignatureBase64 = $SIG1
    confirmPassword        = $PASSWORD
}
if ($r.Status -eq 200) {
    Write-Pass "Signer1 ký thành công → acceptedPartials=$($r.Body.acceptedPartials), status=$($r.Body.status)"
} else {
    Write-Fail "Signer1 ký thất bại (status=$($r.Status)): $($r.Body)"
}

# 6b: Signer1 ký lần 2 (duplicate) — password đúng, không crash
$r = Invoke-Api -Method POST -Path "/remote-signing/requests/$REQ_ID/partial-sign" -Token $TOKEN_SIGNER1 -Body @{
    participantId          = $SIGNER1
    partialSignatureBase64 = $SIG1
    confirmPassword        = $PASSWORD
}
if ($r.Status -eq 200) { Write-Pass "Ký trùng signer1 → 200 (overwrite, không lỗi)" }
else { Write-Info "Ký trùng signer1 → status=$($r.Status) (chấp nhận)" }

# ============================================
# SECTION 7: SIGNER2 KÝ → ĐẠT THRESHOLD
# ============================================
Write-Section "7. Signer2 Ký — Đạt Threshold (2-of-2)"

Write-Info "Computing partial signature for $SIGNER2..."
$SIG2 = Compute-PartialSig -HashBase64 $DOC_HASH -YHex $Y2 -NHex $RSA_N
Write-Info "SIG2 prefix: $($SIG2.Substring(0, [Math]::Min(20, $SIG2.Length)))..."

$r = Invoke-Api -Method POST -Path "/remote-signing/requests/$REQ_ID/partial-sign" -Token $TOKEN_SIGNER2 -Body @{
    participantId          = $SIGNER2
    partialSignatureBase64 = $SIG2
    confirmPassword        = $PASSWORD
}
if ($r.Status -eq 200) {
    Write-Pass "Signer2 ký thành công → acceptedPartials=$($r.Body.acceptedPartials), status=$($r.Body.status)"
    if ($r.Body.status -eq "READY_TO_COMBINE") { Write-Pass "Status = READY_TO_COMBINE" }
    else { Write-Info "Status = $($r.Body.status)" }
} else {
    Write-Fail "Signer2 ký thất bại (status=$($r.Status)): $($r.Body)"
}

# ============================================
# SECTION 8: COMBINE
# ============================================
Write-Section "8. Combine Signatures"

$combResp = Invoke-Api -Method POST -Path "/remote-signing/requests/$REQ_ID/combine" -Token $TOKEN_OWNER
if ($combResp.Status -eq 200 -and $combResp.Body.status -eq "SIGNED") {
    Write-Pass "Combine thành công → status=SIGNED"
    Write-Info "signedPdfBase64 length: $($combResp.Body.signedPdfBase64.Length) chars"
} else {
    Write-Fail "Combine thất bại (status=$($combResp.Status)): $($combResp.Body)"
}

# 8b: Combine lần 2 — idempotent (không lỗi)
$r = Invoke-Api -Method POST -Path "/remote-signing/requests/$REQ_ID/combine" -Token $TOKEN_OWNER
if ($r.Status -eq 200) { Write-Pass "Combine lần 2 → idempotent, status=$($r.Body.status)" }
else { Write-Info "Combine lần 2 → status=$($r.Status)" }

# ============================================
# SECTION 9: VERIFY
# ============================================
Write-Section "9. Verify Signature"

$vResp = Invoke-Api -Method POST -Path "/remote-signing/verify" -Token $TOKEN_OWNER -Body @{
    requestId = $REQ_ID
}
if ($vResp.Status -eq 200 -and $vResp.Body.valid -eq $true) {
    Write-Pass "Chữ ký HỢP LỆ: $($vResp.Body.message)"
} else {
    Write-Fail "Xác minh thất bại: $($vResp.Body.message) (status=$($vResp.Status))"
}

# Verify request chưa ký (requestId giả)
$r = Invoke-Api -Method POST -Path "/remote-signing/verify" -Token $TOKEN_OWNER -Body @{
    requestId = "non-existent-id"
}
if ($r.Status -eq 400) { Write-Pass "Verify requestId không tồn tại → 400 Bad Request" }
else { Write-Info "Verify requestId không tồn tại → status=$($r.Status)" }

# ============================================
# SECTION 10: AUDIT LOG
# ============================================
Write-Section "10. Audit Log"

$logResp = Invoke-Api -Method GET -Path "/remote-signing/audit-logs" -Token $TOKEN_OWNER
if ($logResp.Status -eq 200) {
    $all      = @($logResp.Body)
    $myLogs   = $all | Where-Object { $_.detail -match $REQ_ID }
    Write-Pass "Audit log entries cho request này: $($myLogs.Count)"

    $myLogs | ForEach-Object {
        Write-Info "[$($_.action)] $($_.detail)"
    }

    # Kiểm tra có log SIGN_CONFIRM_FAILED không (từ section 5)
    $failLogs = $all | Where-Object { $_.action -eq "SIGN_CONFIRM_FAILED" -and $_.detail -match $REQ_ID }
    if ($failLogs) {
        Write-Pass "SIGN_CONFIRM_FAILED được ghi $($failLogs.Count) lần trong audit log"
    } else {
        Write-Fail "Không thấy SIGN_CONFIRM_FAILED trong audit log"
    }

    # Kiểm tra PARTIAL_SUBMITTED được ghi
    $partialLogs = $myLogs | Where-Object { $_.action -eq "PARTIAL_SUBMITTED" }
    if ($partialLogs.Count -ge 2) {
        Write-Pass "PARTIAL_SUBMITTED ghi $($partialLogs.Count) lần"
    } else {
        Write-Fail "Cần ít nhất 2 PARTIAL_SUBMITTED (got $($partialLogs.Count))"
    }

    # Kiểm tra SIGNATURE_COMBINED
    $combinedLogs = $myLogs | Where-Object { $_.action -eq "SIGNATURE_COMBINED" }
    if ($combinedLogs) { Write-Pass "SIGNATURE_COMBINED được ghi" }
    else { Write-Fail "Không thấy SIGNATURE_COMBINED trong audit log" }
} else {
    Write-Fail "Không lấy được audit log (status=$($logResp.Status))"
}

# ============================================
# FINAL SUMMARY
# ============================================
Write-Host "`n========================================" -ForegroundColor Magenta
Write-Host "              KẾT QUẢ                  " -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  PASS : $($script:PASS)" -ForegroundColor Green
Write-Host "  FAIL : $($script:FAIL)" -ForegroundColor Red
Write-Host ""

if ($script:FAIL -eq 0) {
    Write-Host "  ALL TESTS PASSED" -ForegroundColor Green
} else {
    Write-Host "  $($script:FAIL) TEST(S) FAILED" -ForegroundColor Red
}
