import { config, getArgs, parseStdInArg } from './utils.ts';

// read commandline args
const { _: [endpoint], help, t, accessToken, pretty, out } = getArgs();

if (help || !endpoint) {
  console.error(`
Make authenticated call to Vbrick Rev REST APIs

USAGE:
deno run --allow-env --allow-read --allow-write --allow-net get.ts <endpoint> [...flags]

ARGS:
  <endpoint>              Relative HTTP path

OPTIONS:
  -t, --accessToken <string>  access token (get from auth.ts)
  --pretty                    pretty-print JSON output
  --out             <string>  write output to file instead of screen (as binary)

EXAMPLE: get basic details of Video with ID 00000000-0000-0000-0000-000000000000
deno run --allow-read --allow-net req.ts /api/v2/videos/00000000-0000-0000-0000-000000000000/playback-url -t $ACCESS_TOKEN --pretty

EXAMPLE: download thumbnail of Video with ID 00000000-0000-0000-0000-000000000000
echo $ACCESS_TOKEN | deno run --allow-all req.ts /api/v2/videos/00000000-0000-0000-0000-000000000000/thumbnail -t - --out "thumb.jpg"
`);
  Deno.exit(1);
}

// make a GET fetch request, with auth header
const url = new URL(endpoint, config.revUrl).toString();
const headers = new Headers();

// read access token from stdin if "-" specified
if (accessToken || t) {
  const token = await parseStdInArg(accessToken || t);
  // read access token from stdin if "-" specified
  headers.set('Authorization', `Vbrick ${token}`);
}

const response = await fetch(url, { headers });

// handle error response
if (!response.ok) {
  const details = [400, 500].includes(response.status)
    ? await response.json().catch(_ => {})
    : '';

  console.error(`HTTP ${response.status} ${response.statusText}`, details);
  Deno.exit(1);
}

// write out depending on cli flags
if (out) {
  const file = await Deno.open(out, { create: true, write: true });
  await response.body?.pipeTo(file.writable);
} else if (pretty) {
  console.log(await response.json());
} else {
  console.log(await response.text());
}
Deno.exit(0);