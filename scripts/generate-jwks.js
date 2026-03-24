/* eslint-disable @typescript-eslint/no-require-imports */
const crypto = require("crypto");

// 1. Generate OIDC_COOKIE_KEY
const cookieKey = crypto.randomBytes(64).toString("hex");

console.log("\n=== OIDC CONFIGURATION ===\n");
console.log(`OIDC_COOKIE_KEY=${cookieKey}`);

// 2. Generate JWKS (RSA Key for Signing)
const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: "spki",
    format: "jwk",
  },
  privateKeyEncoding: {
    type: "pkcs8",
    format: "jwk",
  },
});

// Add required properties for OIDC Provider
const fullKey = {
  ...privateKey,
  kid: "replybase-signing-key-1",
  use: "sig",
  alg: "RS256",
};

const jwks = {
  keys: [fullKey],
};

console.log(`OIDC_JWKS=${JSON.stringify(jwks)}`);
console.log("\n==========================\n");
