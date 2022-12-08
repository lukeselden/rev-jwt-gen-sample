# Vbrick Rev Sample JWT Generation

These are sample code to generate JSON Web Token (JWT) that can be used to interact with Vbrick Rev Platform. For more information on Vbrick Rev JWT please refer to https://revdocs.vbrick.com/reference/jwt-authentication

## Getting Started

These steps assume you're just getting started using the JWT authentication feature with Rev.

1. Generate Signing Public/Private key pair *(PEM format)*

    This repository includes a `init.js` script to use `jose` library to generate the required keypair

    ```sh
    node init.js --signing signing.private.key --signcert signing.public.pem
    ```

    Alternatively, you can follow the openssl steps in the [main readme](https://github.com/vbrick/rev-jwt-gen-sample/README.md)

2. Enable JWT Signing in Rev Admin and click save.
3. Add signing certificate in JWT section and download/copy resulting encryption certificate.
4. Copy `.env.example` to `.env` and update the file with paths to certs and REV URL
5. Use signing/encryption certs to generate JWT *(`jwt.js`)*

## Contents

* `init.js` - Generate a signing cert/key for use with the JWT authentication feature
* `jwt.js` - Generate a JWT (JSON Web Token) for a specified user
* `auth.js` - Request an Access Token using a JWT *(use result to make API calls)*
* `request.js` - Make an API request *(for testing an access token)*
* `index.js` - Example of using a JWT for API access

## Notes

* Each file can be run via the command line. Use `--help` for information of the available arguments
* The `.env` file is used by multiple scripts to re-use the Rev URL and certificate settings.
* The files in this repository are broken out into different `#regions`:
  * `//#region MAIN` - The core logic for functionality in question
  * `//#region COMMANDLINE` - Boilerplate/example code for parsing command-line/environment variables, calling the `MAIN` function, and handling the result.
  * `//#region HELPERS` - Extra utilities / help documentation


## Troubleshooting

* The `subject` specified for a JWT **must** be the username or email of an existing named user in Rev

---

## Disclaimer
This sample code is distributed "as is", with no warranty expressed or implied, and no guarantee for accuracy or applicability to your purpose.
