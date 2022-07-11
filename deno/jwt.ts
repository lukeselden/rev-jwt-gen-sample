import {
  CompactEncrypt,
  importPKCS8,
  importX509,
  SignJWT,
} from "https://deno.land/x/jose@v4.8.3/index.ts";

import {config, getArgs} from './utils.ts';

// load certificate + key from .env file
const { encryptionCertPath, keyPath } = config;

// get cli arguments
const {
  _: [sub],
  help,
  minutes = 60,
  ...flags
} = getArgs<{ exp?: number, nbf?: number, minutes?: number }>();


if (!sub || help) {
  console.error(`
Generate a JWT for authenticating with Vbrick Rev

USAGE:
deno run --allow-env --allow-read jwt.ts <sub> [...flags]

ARGS:
  <sub>                   sub claim (username or email of user to grant access)

OPTIONS:
  --video    [string]     Video ID (res claim)
  --webcast  [string]     Webcast ID (res claim)
  --exp      [number]     Expiration date in epoch seconds
  --nbf      [number]     Not Before date in epoch seconds
  --minutes  [number]     (DEFAULT: 60) Set expiration date to X minutes in
                          the future
`);
  Deno.exit(1);
}

const exp = flags.exp || (Date.now() / 1000 + minutes * 60);

// generate signed JWT using jose library
const signer = await new SignJWT({
  aud: "rev",
  iss: "rev-jwt-gen-sample",
  sub,
  res: flags.video || flags.webcast || "*",
})
  .setProtectedHeader({ alg: "RS256" })
  .setExpirationTime(exp);

// not before restriction is optional
if (flags.nbf) {
  signer.setNotBefore(flags.nbf);
}

// load and use private key
const signingKey = await Deno.readTextFile(keyPath);
const keyObj = await importPKCS8(signingKey, "RS256");
const message = await signer.sign(keyObj);

// encrypt the signed JWT using jose library
const encoder = new TextEncoder();
const encryptor = new CompactEncrypt(encoder.encode(message));
encryptor.setProtectedHeader({
  alg: "RSA-OAEP-256",
  enc: "A256GCM",
});

// load and use encryption cert
const encryptionCert = await Deno.readTextFile(encryptionCertPath);
const certObj = await importX509(encryptionCert, "RSA-OAEP-256");
const jwt = await encryptor.encrypt(certObj);

// output to console and quit
console.log(jwt);
Deno.exit(0);
