package com.example.demo.crypto;

import java.math.BigInteger;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;

/**
 * Shamir secret sharing over a prime field GF(p).
 * Polynomial degree = threshold - 1, constant term = secret.
 */
public final class ShamirSecretSharing {

    private ShamirSecretSharing() {
    }

    public record Share(int x, BigInteger y) {
    }

    public static List<Share> split(BigInteger secret, int threshold, int n, BigInteger prime, SecureRandom random) {
        if (threshold < 1 || n < 1 || threshold > n) {
            throw new IllegalArgumentException("require 1 <= threshold <= n");
        }
        BigInteger s = secret.mod(prime);
        BigInteger[] coeffs = new BigInteger[threshold];
        coeffs[0] = s;
        for (int i = 1; i < threshold; i++) {
            coeffs[i] = randomScalar(prime, random);
        }
        List<Share> out = new ArrayList<>(n);
        for (int x = 1; x <= n; x++) {
            out.add(new Share(x, evaluatePolynomial(coeffs, BigInteger.valueOf(x), prime)));
        }
        return out;
    }

    public static BigInteger combine(List<Share> shares, BigInteger prime) {
        if (shares == null || shares.isEmpty()) {
            throw new IllegalArgumentException("shares must not be empty");
        }
        int k = shares.size();
        BigInteger secret = BigInteger.ZERO;
        for (int i = 0; i < k; i++) {
            Share si = shares.get(i);
            BigInteger xi = BigInteger.valueOf(si.x());
            BigInteger yi = si.y().mod(prime);
            BigInteger num = BigInteger.ONE;
            BigInteger den = BigInteger.ONE;
            for (int j = 0; j < k; j++) {
                if (i == j) {
                    continue;
                }
                BigInteger xj = BigInteger.valueOf(shares.get(j).x());
                num = num.multiply(xj.negate()).mod(prime);
                den = den.multiply(xi.subtract(xj)).mod(prime);
            }
            BigInteger lambda = num.multiply(den.modInverse(prime)).mod(prime);
            secret = secret.add(yi.multiply(lambda)).mod(prime);
        }
        return secret.mod(prime);
    }

    private static BigInteger evaluatePolynomial(BigInteger[] coeffs, BigInteger x, BigInteger prime) {
        BigInteger result = BigInteger.ZERO;
        BigInteger xp = BigInteger.ONE;
        for (BigInteger c : coeffs) {
            result = result.add(c.multiply(xp)).mod(prime);
            xp = xp.multiply(x).mod(prime);
        }
        return result;
    }

    private static BigInteger randomScalar(BigInteger prime, SecureRandom random) {
        BigInteger pMinusOne = prime.subtract(BigInteger.ONE);
        if (pMinusOne.signum() <= 0) {
            throw new IllegalArgumentException("invalid prime");
        }
        return new BigInteger(prime.bitLength() + 8, random).mod(pMinusOne);
    }
}
