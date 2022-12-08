import { getCommandLineArgs, getEnvConfig, getEnvironmentVariables, isMainEntryPoint, logger } from './lib/utils.js';
import { CompactEncrypt, importPKCS8, importX509, SignJWT } from 'jose';
import fs from 'node:fs/promises';

//#region MAIN

export async function generateJWT(
    usernameOrEmail,
    expiration,
    notBefore,
    signingKeyPath,
    encryptionCertPath
) {
    // Actual body of JWT. All below claims must be included
    const JWTPayload = {
        aud: "rev",                   // audience claim is always 'rev'
        iss: "rev-jwt-gen-sample",    // can be any string
        res: "*",                     // '*' means allow content access based on user's Rev permissions
        sub: usernameOrEmail,         // REQUIRED, user must exist in Rev
        exp: Math.floor(expiration)   // expiration time in epoch seconds (seconds since 1970-01-01)
    };

    if (notBefore) {
        JWTPayload.nbf = Math.floor(notBefore);   // not before restriction is optional
        // NOTE: must be integer, not float, hence the floor()
    }

    // generate signed JWT using jose library
    const signer = await new SignJWT(JWTPayload)
        .setProtectedHeader({ alg: "RS256" });

    const signingKey = await fs.readFile(signingKeyPath, { encoding: 'utf-8' });
    const keyObj = await importPKCS8(signingKey, "RS256");
    const message = await signer.sign(keyObj);

    // console.debug('Signed JWT (viewable via jwt.io)\n', message);

    // encrypt the signed JWT using jose library
    const encoder = new TextEncoder();
    const encryptor = new CompactEncrypt(encoder.encode(message));
    encryptor.setProtectedHeader({
        alg: "RSA-OAEP-256",
        enc: "A256GCM",
    });

    // load and use encryption cert
    const encryptionCert = await fs.readFile(encryptionCertPath, { encoding: 'utf-8' });
    const certObj = await importX509(encryptionCert, "RSA-OAEP-256");
    const jwt = await encryptor.encrypt(certObj);

    return jwt;
}

//#endregion

//#region COMMANDLINE

// read and validate arguments from commandline / environment variables
if (isMainEntryPoint(import.meta.url)) {
    try {
        const args = getCommandLineArgs();

        // dynamic inputs - Specify JWT subject and JWT validity date range
        const usernameOrEmail = args._?.[0] || args.sub; // REQUIRED, must exist in Rev
        const expirationArg = args.exp;                  // Expiration time in epoch seconds
        const expirationMinutes = args.minutes || 60;    // Alternative, specify # minutes from now
        const notBeforeClaim = args.nbf;                 // Not Before time in epoch seconds

        // static inputs - Your Rev tenant's URL and signing/encryption certificates (see README.md)
        // pulled from commandline-args or env variables
        const {
            revUrl,
            signingKeyPath, 
            encryptionCertPath 
        } = getEnvConfig();
        
        if (args.help) {
            // show help and exit
            showHelp();
        }

        if (!revUrl) {
            throw 'Must specify Rev URL using --url arg or REV_JWT_URL environment variable';
        }
        if (!usernameOrEmail) {
            throw 'Must specify Subject claim (username or email) commandline argument';
        }

        // set expiration time from minutes if necessary
        const expirationClaim = expirationArg || Date.now() / 1000 + expirationMinutes * 60;
        // make sure exp/nbf are set to safe values
        validateTimeRange(expirationClaim, notBeforeClaim);

        const jwt = await generateJWT(
            usernameOrEmail,
            expirationClaim,
            notBeforeClaim,
            signingKeyPath,
            encryptionCertPath
        );

        // output to console and quit
        logger.info(jwt);
        process.exit();
    } catch (err) {
        logger.error(err);
        showHelp();
        process.exit(1);

    }
}

//#endregion
//#region HELPERS

function showHelp() {
    console.error(`
Generate a JWT for authenticating with Vbrick Rev

USAGE:
node jwt.js <subject> [...flags]

ARGS:
    <subject>                       sub claim (username or email of Rev user)
                                    NOTE: user MUST exist in Rev

OPTIONS:
  --exp:     [number]               Expiration date in epoch seconds (DEFAULT: derive from --minutes)
  --nbf      [number]               Not Before date in epoch seconds
  --minutes  [number]               Set expiration date to X minutes in the future (DEFAULT: 60)
  --url      [string]               Rev URL (DEFAULT: set in .env file)
  --encrypt  [string]               Encryption Key Path (DEFAULT: set in .env file)
  --sign     [string]               Signing Private Key Path (DEFAULT: set in .env file)

EXAMPLE (simple, defaults set in .env, 60 min expiration)
node jwt.js media.viewer@mycompany.com

EXAMPLE (verbose, no .env file)
node jwt.js media.viewer@mycompany.com  --exp 1662996000 --nbf 1662995100 --url "https://my.rev.url" --sign "signing.private.key" --encrypt "encrypt.public.pem"
`);
    process.exit(1);
}

function validateTimeRange(exp, nbf) {
    const nowInEpochSeconds = Math.floor(Date.now() / 1000);

    if (isNaN(exp)) {
        throw `Invalid expiration value. Expected number`;
    }

    if (exp <= nowInEpochSeconds) {
        throw `Expiration in past. NOTE dates must be set in epoch seconds (now = ${nowInEpochSeconds})`;
    }

    if (exp < nowInEpochSeconds + 300) {
        logger.warn('WARNING: Expiration is less than 10 minutes in the future. Consider accounting for clock drift.');
    }

    if (nbf != undefined) {
        if (isNaN(nbf)) {
            throw `Invalid Not Before value. Expected number`;
        }

        if (nbf > nowInEpochSeconds) {
            logger.warn(`WARNING: Not Before is set to the future. JWT will not be valid until ${new Date(nbf * 1000).toISOString()}`);
        } else if (nbf > nowInEpochSeconds - 300) {
            logger.warn('WARNING: Not Before is less than 10 minutes in the past. Consider accounting for clock drift.');
        }
    }
}

//#endregion