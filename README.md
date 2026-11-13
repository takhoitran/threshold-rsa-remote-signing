# Remote Digital Signing Platform

Bachelor thesis project (Hanoi University of Science and Technology, Global ICT, 2026) — Tran Anh Khoi, supervised by Do Ba Lam.

A web platform that enforces **t-of-n multi-party approval at the cryptographic layer**: an RSA-2048 private exponent is split with Shamir Secret Sharing, each participant submits a PIN-protected partial signature, and once the threshold is reached the signature is embedded into the PDF as a standard CMS/PKCS#7 signature verifiable in any PDF reader.

**Known limitations (prototype):** the backend temporarily reconstructs the private exponent during the combine step (required by iText 7), RSA is applied without PSS/PKCS#1 padding, keys are generated centrally (no DKG), and certificates are self-signed. Do not use in production.

Building a Remote Digital Signing Platform Using Threshold RSA and Shamir Secret Sharing.

## Prerequisites

| Tool | Version |
|------|---------|
| Java JDK | 21 or later |
| Gradle | included via wrapper (`gradlew`) |
| Node.js | 18 or later |
| npm | 9 or later |
| PostgreSQL | 14 or later |

## 1. Database Setup

Create a PostgreSQL database named `remote_signing`:

```sql
CREATE DATABASE remote_signing;
```

Then provide your database password and a JWT secret. Either set environment variables:

```bash
DB_PASSWORD=your_postgres_password
JWT_SECRET=$(openssl rand -hex 32)
# optional: DB_URL, DB_USERNAME (defaults: localhost:5432/remote_signing, postgres)
```

or copy `src/main/resources/application-secrets.properties.example` to
`src/main/resources/application-secrets.properties` and fill in the values (this file is git-ignored).

The schema is created automatically by Hibernate on first run (`ddl-auto=update`).

## 2. Backend

From the project root:

```bash
# Windows
gradlew.bat bootRun

# Linux / macOS
./gradlew bootRun
```

The backend starts on **http://localhost:8080**.

On startup, `DataInitializer` seeds the following test accounts automatically:

| Username | Password | PIN    | Role  |
|----------|----------|--------|-------|
| admin    | admin123 | —      | ADMIN |
| alice    | alice123 | 111111 | USER  |
| bob      | bob123   | 222222 | USER  |
| charlie  | charlie123 | 333333 | USER |
| dave     | dave123  | 444444 | USER  |
| eve      | eve123   | 555555 | USER  |

## 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend starts on **http://localhost:5173** and proxies API calls to the backend at port 8080.

## 4. Usage

1. Open `http://localhost:5173` in a browser.
2. Log in with one of the test accounts above.
3. Admin account can manage key groups (create group, add/remove participants).
4. Users can upload documents, create signing requests, and submit partial signatures using their PIN.

## Project Structure

```
src/                  Java source code (Spring Boot backend)
frontend/src/         React + TypeScript source code
build.gradle          Gradle build configuration
settings.gradle       Gradle settings
```
