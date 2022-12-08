# Vbrick Rev Sample JWT Generation for Deno

This sample code makes use of the [`@panva/jose`](https://github.com/panva/jose/tree/v4.8.3) javascript library. It includes additional scripts to demonstrate setting up JWT authentication in Rev and possible usages of this workflow.

## Usage

*NOTE: steps assume [Deno](https://deno.land) v1.20 or above*

1. Copy `.env.example` to `.env` and set the `REV_JWT_URL` to the URL of your Rev tenant
2. Configure the Signing/Encryption certificates following the openssl steps in the [main readme](https://github.com/vbrick/rev-jwt-gen-sample/README.md)

## Commands
Get help for scripts using `deno task <task> --help` or `deno run --allow-all <task>.ts --help`.

### `deno task jwt <username or email>`
Generate a JWT for the given user and dump to stdout

### `deno task auth <jwt>`
Request an access token for use with the Rev API from a JWT. See: [https://revdocs.vbrick.com/reference/jwtauthenticate](https://revdocs.vbrick.com/reference/jwtauthenticate)

### `deno task get <endpoint> -t <access token>`
Sample of making a GET HTTP call *(using `fetch`)* to specified API endpoint.

### `deno task share <video id> <jwt>`
Build a [Share Video](https://revdocs.vbrick.com/docs/share-a-video) link including the jwt as a query parameter.



