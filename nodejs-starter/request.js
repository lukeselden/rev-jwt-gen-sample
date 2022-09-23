import { fetch, Headers } from 'undici';
import { getCommandLineArgs, getEnvConfig, isMainEntryPoint, logger, readErrorResponse } from './lib/utils.js';

//#region MAIN

/**
 * Make an authorized Rev API request. This is a simple wrapper around fetch which will work
 * for simple Rev REST API calls. However, it won't cover all purposes, and is for demonstration
 * purposes only. For a more robust API wrapper see https://github.com/vbrick/rev-client-js
 * @param {string} revUrl          The FQDN of your Rev tenant
 * @param {string} endpoint        The relative path for API in question
 * @param {string} [accessToken]   The access token of active session (use auth.js to obtain)
 * @param {string} [method]        HTTP Method (GET/PUT/POST/etc.)
 * @param {string} [body]          A JSON payload string
 * @returns {Promise<any>}
 */
export async function makeRevRequest(revUrl, endpoint, accessToken, method, body) {
    // CREATE REQUEST
    const url = new URL(endpoint, revUrl);
    const request = {
        method: method || 'GET',
        headers: new Headers()
    };
    
    if (accessToken) {
        // construct authorization header using passed in access token
        // note the format is "Vbrick <ACCESS_TOKEN>"
        request.headers.set('Authorization', `Vbrick ${accessToken}`);
    }
    
    if (body) {
        // content-type header must be set if sending a body
        request.body = body;
        request.headers.set('Content-Type', 'application/json');
    }

    // MAKE REQUEST
    const response = await fetch(url, request);

    // HANDLE RESPONSE
    if (response.ok) {
        const isJson = response.headers.get('content-type')?.startsWith('application/json');

        // assumes endpoint is JSON/text - this isn't always the case!
        const result = isJson
            ? await response.json()
            : await response.text();

        return result;
    } else {
        // Error response may have additional details in body
        const httpError = await readErrorResponse(response);
        throw httpError;
    }
}

//#endregion
//#region COMMANDLINE

// run function if not called from other node.js script
if (isMainEntryPoint(import.meta.url)) {
    try {
        const args = getCommandLineArgs();

        if (args.help) {
            // show help and exit
            showHelp();
        }

        // CONFIGURATION
        const { revUrl } = getEnvConfig(args);               // URL of Rev tenant, read from --url
                                                             // cli arg or REV_JWT_URL env variable
        const endpoint    = args._?.[0] || args.endpoint;    // API endpoint/path
                                                             // (ex. /api/v2/videos/search)
        const accessToken = args._?.[1] || args.accessToken; // access token retrieved from auth.js
        const method      = args.method || 'GET';            // HTTP Method
        const body        = args.body;                       // JSON body

        if (!revUrl) {
            throw 'Must specify Rev URL using --url arg or REV_JWT_URL environment variable';
        }
        if (!endpoint) {
            throw 'Must specify API endpoint';
        }

        const result = await makeRevRequest(revUrl, endpoint, accessToken, method, body);
        console.log(result);
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
node request.js <endpoint> <token> [...flags]

ARGS:
  <endpoint>                           JWT token generated using jwt.js
  <token>                           JWT token generated using jwt.js

OPTIONS:
  --endpoint [string]               Relative URL for Rev
  --method   [string]               GET/POST/PATCH/etc. (DEFAULT: GET)
  --body     [string]               JSON body
  --url      [string]               Rev URL (DEFAULT: set in .env file)
`);
    process.exit(1);
}
