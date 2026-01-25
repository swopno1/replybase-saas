const fs = require('fs');
const { generateKeyPair } = require('crypto');

generateKeyPair('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
}, (err, publicKey, privateKey) => {
    if (err) {
        console.error(err);
        return;
    }

    // This is a naive generation. 
    // For OIDC Provider, we usually want the JSON JWK format.
    // We can use the 'jose' library or similar if available, but let's output a message 
    // pointing to the easier way if dependencies aren't present.

    console.log("Generating JWKS...");
    console.log("NOTE: For production, please use a library like 'jose' or an online JWK generator.");
    console.log("This script is a placeholder to remind you to set OIDC_JWKS.");
});

// Actually, let's provide a script that works with simple node deps if possible, 
// OR just advise the user to run a one-liner.
console.log(`
To generate a valid JWKS, you can run this in your terminal if you have 'jose' installed, or use an online tool (mkjwk.org):

const { generateJWK } = require('jose');
(async () => {
  const { privateKey, publicKey } = await generateJWK('PS256');
  console.log(JSON.stringify({ keys: [ { ...privateKey, kid: 'replybase-key-1', use: 'sig' } ] }, null, 2));
})();
`);
