import { getCommandLineArgs, getEnvConfig, isMainEntryPoint, logger, readErrorResponse } from './lib/utils.js';
import { fetch } from 'undici';

//#region MAIN
/**
 * Trade a generated JWT for an access token for use with embedding and Rev API
 * @param {string} revUrl 
 * @param {string} jwt 
 * @returns {Promise<{ accessToken: string, expiration: string }>}
 */
export async function getAccessToken(revUrl, jwt) {
    
    // make request - equivalent to:
    // curl -XGET https://my.rev.url/api/v2/jwtauthenticate?jwt_token=MY_JWT_TOKEN

    const url = new URL('/api/v2/jwtauthenticate', revUrl);
    url.searchParams.set("jwt_token", jwt);
    const response = await fetch(url, { method: 'GET' });

    // detect failed request
    if (!response.ok) {
        // Error response may have additional details in body
        const httpError = await readErrorResponse(response);
        throw httpError;
    }

    const session = await response.json();

    // console.log('Access Token is ', session.accessToken);
    return session;
}

//#endregion
//#region COMMANDLINE

// read and validate arguments from commandline / environment variables
if (isMainEntryPoint(import.meta.url)) {
    try {
        const args = getCommandLineArgs();
        const { revUrl } = getEnvConfig(args);
    
        // JWT generated using jwt.js, can be specified as first cli argument or --jwt <JWT>
        const jwt = args._?.[0] || args.jwt;
        const verbose = !!args.verbose;
    
        if (args.help) {
            showHelp();
        }
    
        if (!jwt) {
            throw 'Must specify JWT commandline argument';
        }
    
        if (!revUrl) {
            throw 'Must specify Rev URL using --url arg or REV_JWT_URL environment variable';
        }
    
        const session = await getAccessToken(revUrl, jwt);
        if (verbose) {
            logger.debug(`Success. Access Token expires ${session.expiration}\n`);
        }
        logger.info(session.accessToken);
        process.exit();
    } catch (error) {
        // this was an HTTP Error
        if (error?.isHttpError) {
            logger.error(error.message, error.details);
        } else {
            logger.error(error);
            showHelp();
        }
        process.exit(1);
    }
}

//#endregion
//#region HELPERS

function showHelp() {
    console.error(`
Make HTTP request to Rev to get an Access Token for use with Rev API/embedding

USAGE:
node auth.js <jwt>

ARGS:
    <jwt>                           JWT token generated using jwt.js

OPTIONS:
  --url      [string]               Rev URL (DEFAULT: set in .env file)
  --verbose                         Output expiration time as well
`);
    process.exit(1);
}

//#endregion