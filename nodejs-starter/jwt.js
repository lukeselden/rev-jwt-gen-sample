import { getCommandLineArgs, getEnvConfig, getEnvironmentVariables, isMainEntryPoint, logger } from './lib/utils.js';
import { CompactEncrypt, importPKCS8, importX509, SignJWT } from 'jose';
import fs from 'node:fs/promises';

//#region MAIN

export function internalUserJWTPayload(usernameOrEmail, expiration, notBefore) {
    // Actual body of JWT. All below claims must be included
    const payload = {
        aud: "rev",                   // audience claim is always 'rev'
        iss: "rev-jwt-gen-sample",    // can be any string
        res: "*",                     // '*' means allow content access based on user's Rev permissions
        sub: usernameOrEmail,         // user must exist in Rev,
        exp: Math.floor(expiration)   // expiration time in epoch seconds (seconds since 1970-01-01)
    };

    if (notBefore) {
        payload.nbf = Math.floor(notBefore);   // not before restriction is optional
        // NOTE: must be integer, not float, hence the floor()
    }
    return payload;
}

export function externalUserJWTPayload(videoId, email = '', expiration, notBefore) {
    // Actual body of JWT. All below claims must be included
    const payload = {
        aud: "rev",                   // audience claim is always 'rev'
        iss: "rev-jwt-gen-sample",    // can be any string
        res: videoId,                 // Video ID to grant access
        sub: email,                   // OPTIONAL provide email address for analytics reporting
        role: 'mv',                   // REQUIRED - indicate temporary media viewer right
        exp: Math.floor(expiration)   // expiration time in epoch seconds (seconds since 1970-01-01)
    };

    if (notBefore) {
        payload.nbf = Math.floor(notBefore);   // not before restriction is optional
        // NOTE: must be integer, not float, hence the floor()
    }
    return payload;
}

export async function generateJWT(
    jwtPayload,
    signingKeyPath,
    encryptionCertPath
) {
    // generate signed JWT using jose library
    const signer = await new SignJWT(jwtPayload)
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
        const usernameOrEmail   = args._?.[0] || args.sub; // IF SSO - must exist in Rev
                                                           // IF External Viewer must be blank or email
        const expirationArg     = args.exp;                // Expiration time in epoch seconds
        const expirationMinutes = args.minutes || 60;      // Alternative, specify # minutes from now
        const notBeforeClaim    = args.nbf;                // Not Before time in epoch seconds
        const videoId           = args.video || args.res   // If external viewer specify resource

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
        if (videoId) {
            // minimal regex test for if value is email address
            // if (usernameOrEmail && !/.+@.+/.test(usernameOrEmail)) {
            //     throw 'External Viewer Subject claim must be blank of email address';
            // }
        } else if (!usernameOrEmail) {
            throw 'Must specify Subject claim (username or email) commandline argument';
        }

        // set expiration time from minutes if necessary
        const expirationClaim = expirationArg || Date.now() / 1000 + expirationMinutes * 60;
        // make sure exp/nbf are set to safe values
        validateTimeRange(expirationClaim, notBeforeClaim);

        let payload;
        // if videoId specified then generate JWT for external user
        if (videoId) {
            logger.debug(`Creating Trusted Public Access token for video ${videoId}`);
            payload = externalUserJWTPayload(videoId, usernameOrEmail, expirationClaim, notBeforeClaim);
        } else {
            logger.debug(`Creating token for Rev User ${usernameOrEmail}`);
            payload = internalUserJWTPayload(usernameOrEmail, expirationClaim, notBeforeClaim);
        }

        logger.debug('Payload is', payload);

        const jwt = await generateJWT(
            payload,
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
INTERNAL USER (Video Access by Rev User Permissions)
node jwt.js <subject> [...flags]

ARGS:
    <subject>                       sub claim (username or email of Rev user)
                                    NOTE: user MUST exist in Rev unless --videoId specified
OPTIONS:
  --video    [string]               Specify Video ID to allow External Viewer to access
                                    Subject must be blank or an email address.
  --minutes  [number]               Set expiration date to X minutes in the future (DEFAULT: 60)
  --exp:     [number]               Expiration date in epoch seconds (DEFAULT: derive from --minutes)
  --nbf      [number]               Not Before date in epoch seconds
  --url      [string]               Rev URL (DEFAULT: set in .env file)
  --encrypt  [string]               Encryption Key Path (DEFAULT: set in .env file)
  --sign     [string]               Signing Private Key Path (DEFAULT: set in .env file)

EXAMPLE (simple, defaults set in .env, 60 min expiration)
node jwt.js media.viewer@mycompany.com

EXAMPLE (external viewer)
node jwt.js external.user@gmail.com --videoId 12341234-1234-1234-123412341234

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