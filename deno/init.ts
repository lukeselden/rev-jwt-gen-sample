import { config, exec, ExecError, exists, getArgs } from './utils.ts';

// load certificate + key from .env file
const { encryptionCertPath, keyPath, signingCertPath } = config;

// read command line arguments
const {
  days = 3650,
  iss = "/CN=ref-jwt-gen",
  y: noConfirm,
  help
} = getArgs<{ days?: number, iss?: string, y?: boolean }>();

if (help) {
  console.error(`
Use OpenSSL to generate a signing key/cert 

USAGE:
deno run --allow-env --allow-read --allow-write --allow-run init.ts [...flags]

OPTIONS:
--days  <number>      Days signing cert is valid for. (DEFAULT: 3650 / 10 years)
--iss   <string>      Subject of self-signed certificate. (DEFAULT: /CN=rev-jwt-gen)
 -y                   Skip confirmation to overwrite existing files

NOTE: This utility assumes openssl is installed and in the PATH
NOTE: The output path for key and cert is configured in .env file
`);
  Deno.exit(1);
}

// prompt if script will overwrite existing files
if (!noConfirm) {
  const existing = await Promise.all([keyPath, signingCertPath, encryptionCertPath]
    .map(async p => await exists(p) && p)
  );
  if (existing.length > 0 && !confirm(`Do you want to overwrite existing files ${existing}?`)) {
    Deno.exit();
  }
}

let privateKey = '';
let cert = '';
try {
  // generate RSA key and convert to the PKCS8 format expected by jose library
  console.log('...Generating Key...');
  const rsaKey = await exec(["openssl", "genrsa", "-out", "-"]);
  privateKey = await exec(["openssl", "pkcs8", "-in", "-", "-nocrypt", "-topk8"], rsaKey);

  // generate self-signed certificate
  console.log('...Generating Certificate...');
  
  // make sure subject of cert is in openssl-accepted format
  const subj = /^\/\W+=\W+/.test(iss) ? iss : `/CN=${iss}`;

  cert = await exec(["openssl", "req", "-x509", "-nodes", "-key", "-", "-days", `${days}`, "-subj", subj, "-batch", "-pkeyopt", "rsa_padding_mode:oaep", "-out", "-"], privateKey);
} catch (error) {
  if (error instanceof ExecError) {
    console.error(`OpenSSL Error ${error.code}`, error.stderr);
  } else {
    console.error(error);
  }
  Deno.exit(1);
}

// write to disk - paths are set in .env config file
await Promise.all([
  Deno.writeTextFile(keyPath, privateKey),
  Deno.writeTextFile(signingCertPath, cert),
  Deno.writeTextFile(encryptionCertPath, "")
]);

console.log(`Done.

NEXT STEPS: 
1.  Log into Rev
2.  Navigate to Rev Admin -> System Settings -> Security -> JWT Authentication
3.  If "Enable JWT Authentication & Authorization" is not already checked
    enable it and click Save at the bottom of the page.
4.  Click "+ Add New" 
5.  Paste in the contents of ${signingCertPath} (output below).
6.  Download the encryption cert and save as ${encryptionCertPath}
    (replace the current empty file)
7.  Test out the results with jwt.ts and auth.ts

${cert}

`)

Deno.exit();