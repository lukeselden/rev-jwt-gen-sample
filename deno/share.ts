import { config, getArgs, parseStdInArg } from './utils.ts';

// read commandline args
const { _: [videoId, jwt], help, show } = getArgs();

if (help || !videoId || !jwt) {
  console.error(`
Open link to specified window using JWT authentication

USAGE:
deno run --allow-env --allow-read --allow-run share.ts <video id> <jwt> [--show]

ARGS:
  <video id>                Video ID
  <jwt>                     JWT token generated using jwt.ts.
                            Use "-" to read from stdin

OPTIONS:
  --show                    Print to screen instead of opening link in
                            default browser.

EXAMPLE: create a link for user@company.domain to view video 000000000-0000-0000-0000-000000000000, and open link in default browser.
deno run --allow-all jwt.ts user@company.domain --video 000000000-0000-0000-0000-000000000000 | deno run --allow-all share.ts 000000000-0000-0000-0000-000000000000
`);
  Deno.exit(1);
}

// read jwt from stdin if "-" specified
const token = await parseStdInArg(jwt);

// this is a URL to a video that just shows the video fullscreen, rather than including full Rev portal interface
const url = `${config.revUrl}/sharevideo/${videoId}?videoOnly&jwt_token=${encodeURIComponent(token)}`;

// just print out URL (with JWT) to screen
if (show) {
  console.log(url);
  Deno.exit(0);
}

// open URL using default browser, based on OS implementation
const opener: string[] = {
  darwin: ['open'],
  windows: ['cmd', '/s', '/c', 'start', '', '/b'],
  linux: ['xdg-open']
}[Deno.build.os] || [];

const openProcess = Deno.run({
  cmd: [...opener, url]
});

await openProcess.status();

Deno.exit();