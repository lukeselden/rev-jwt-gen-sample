import fs from 'node:fs/promises';
import { generateKeyPair, exportPKCS8, exportSPKI } from 'jose';
import forge from 'node-forge';
import { getCommandLineArgs, isMainEntryPoint, logger, exists, getEnvConfig } from './lib/utils.js';

const {pki, md} = forge;

//#region MAIN

/**
 * Generate the signing private key / cert used with vbrick rev's JWT feature
 * @param {string} signingKeyPath 
 * @param {string} signingCertPath 
 * @param {string} encryptionCertPath 
 * @param {boolean} overwrite 
 */
export async function generateSigningKeypair(
    signingKeyPath,
    signingCertPath,
    encryptionCertPath,
    validDays = 3650,
    issuer = "rev-jwt-gen",
    overwrite = false
) {
    // check to see if this would overwrite existing certs
    if (!overwrite) {
        for (let path of [signingKeyPath, signingCertPath, encryptionCertPath]) {
            if (await exists(path)) {
                throw `Not overwriting existing file ${path}. Use -y or --force to ovwrite.`;
            }
        }
    }

    logger.debug('...Generating Keys...');

    // see https://github.com/panva/jose
    const { publicKey, privateKey } = await generateKeyPair("RSA-OAEP", { extractable: true });
    const privatePEM = await exportPKCS8(privateKey);
    const publicKeyPEM = await exportSPKI(publicKey);
    const publicPEM = generateCert(privatePEM, publicKeyPEM, issuer, validDays);

    logger.debug('...Saving Files...');

    // write to disk - paths are set in .env config file
    await fs.writeFile(signingKeyPath, privatePEM);
    await fs.writeFile(signingCertPath, publicPEM);
    // write empty file, waiting to be filled with cert from Rev
    await fs.writeFile(encryptionCertPath, '');

    return publicPEM;
}

//#endregion
//#region COMMANDLINE

// run function if not called from other node.js script
if (isMainEntryPoint(import.meta.url)) {
    try {
        const args = getCommandLineArgs();
        const days = parseInt(args.days, 10) || 3650;
        const issuer = args.issuer || "rev-jwt-gen";

        // location of signing/encryption certificates (see README.md)
        // pulled from commandline-args or env variables
        const {
            signingKeyPath,
            signingCertPath,
            encryptionCertPath 
        } = getEnvConfig(args);

        // customize output filenames
        const shouldOverwrite = !!args.y || !!args.force;

        const signingCertText = await generateSigningKeypair(signingKeyPath, signingCertPath, encryptionCertPath, days, issuer, shouldOverwrite);

        logger.debug(`Done.

NEXT STEPS: 
1.  Log into Rev
2.  Navigate to Rev Admin -> System Settings -> Security -> JWT Authentication
3.  If "Enable JWT Authentication & Authorization" is not already checked
    enable it and click Save at the bottom of the page.
4.  Go back to JWT section and click "+ Add New"
5.  Paste in the contents of ${signingCertPath} (output below).
6.  Download the encryption cert and save as ${encryptionCertPath}
    (replace the current empty file)
7.  Test out the results with jwt.js and auth.js

${signingCertText}
`);
        process.exit();
    } catch (error) {
        logger.error(error);
        showHelp();
        process.exit(1);
    }
}

//#endregion
//#region HELPERS

function showHelp() {
    console.error(`
Generate a Signing and Encryption Key Pair
    
USAGE:
node init.js

OPTIONS:
    --sign      [string]              Signing Private Key Path (DEFAULT: set in .env file)
    --signcert  [string]              Signing Public  Key Path (DEFAULT: set in .env file)
    --encrypt   [string]              Encryption Key Path (DEFAULT: set in .env file)
    --days  [number]                  Days signing cert is valid for. (DEFAULT: 3650 / 10 years)
    --iss   [string]                  Subject of self-signed certificate. (DEFAULT: rev-jwt-gen)
    -y, --force                       Overwrite existing files
`);
    process.exit(1);
}

/**
 * Use node-forge to create an X.509 certificate
 * @param {string} privateKeyPEM 
 * @param {string} publicKeyPEM 
 * @param {string} issuer 
 * @param {number} validDays 
 */
function generateCert(privateKeyPEM, publicKeyPEM, issuer, validDays) {
    const cert = pki.createCertificate();
    cert.publicKey = pki.publicKeyFromPem(publicKeyPEM);
    cert.serialNumber = Math.random()
        .toString(16)
        .slice(2, 10)
        .toUpperCase()
        .replace(/^[01]/, '2')
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setDate(cert.validity.notAfter.getDate() + validDays);
    cert.setIssuer([{ name: 'commonName', value: issuer }]);
    cert.setSubject([{ name: 'commonName', value: issuer }]);
    cert.sign(pki.privateKeyFromPem(privateKeyPEM), md.sha256.create());
    return pki.certificateToPem(cert);
}

//#endregion