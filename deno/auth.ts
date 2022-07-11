import { config, getArgs, parseStdInArg } from './utils.ts';

// get token from command line arguments
const { _: [jwt], help } = getArgs();

if (!jwt || help) {
  console.error(`
Make HTTP request to Rev to get an Access Token

USAGE:
deno run --allow-env --allow-read --allow-net auth.ts <jwt>
  
ARGS:
  <jwt>                     JWT token generated using jwt.ts.
                            Use "-" to read from stdin

RETURNS:
  <string>                  The access token for use with Rev APIs

EXAMPLE: Generate JWT and get access token for user@company.domain (read jwt from stdin)
deno run --allow-all jwt.ts user@company.domain | deno run --allow-all auth.ts -
  `);
  Deno.exit(1);
}

interface IAccessTokenResponse {
  accessToken: string;
  expiration: string;
  csrfToken: string;
  language: string;
}

interface IErrorResponse {
  name: string;
  message: string;
}

// read access token from stdin if "-" specified
const token =  await parseStdInArg(jwt);

/**
 * construct API call URL
 * @see https://revdocs.vbrick.com/reference/jwtauthenticate
 */
const url = new URL("/api/v2/jwtauthenticate", config.revUrl);
url.searchParams.set("jwt_token", token);

const response = await fetch(`${url}`);

if (response.ok) {
  const session: IAccessTokenResponse = await response.json();
  console.log(session.accessToken);
  Deno.exit(0);
} else {
  const details: IErrorResponse = await response
    .json()
    .catch((err) => ({ name: "UnknownError", message: `${err}` }));
  
  console.error(`HTTP ${response.status} ${response.statusText}`, details);
  Deno.exit(1);
}
