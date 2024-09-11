# Vbrick Rev Sample JWT Generation

This repository includes sample code to generate JSON Web Tokens (JWT) that can be used to interact with Vbrick Rev Platform. For more information on using Vbrick Rev JWT for authentication please refer to https://revdocs.vbrick.com/reference/jwt-authentication 

---

## Getting Started

### 1. Generate a Private Key

The private key must be a RSA key of at least 2048 bits.

```sh
# Option 1 - private key via genpkey
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out signing.private.key

# Option 2 - genrsa then convert (if using old version of openssl)
openssl genrsa -out tmp.rsa.key
openssl pkcs8 -in tmp.rsa.key -nocrypt -topk8 -out signing.private.key
rm tmp.rsa.key
```

### 2. Output Public Key as X.509 Certificate

Rev expects you to provide the corresponding Public Key for your Private Key in X.509 certificate format. This cert can be self-signed and the Subject (CN) is arbitrary, since Rev will only be using the enclosed Public Key for JWT verification. The Public Key must have RSA-OAEP 256 padding *(as per JWT/JOSE standards)*.

Set the validity duration *(`-days`)* according to your security policy. Note that the encryption certificate Rev generates is valid for two years, so keys will need to be rotated before that time.

```sh
openssl req -x509 -nodes -key signing.private.key -days 730 -subj /CN=rev-jwt-gen -batch -pkeyopt rsa_padding_mode:oaep -out signing.public.pem
```

### 3. Configure JWT in Rev

1. [Enable JWT Signing](https://revdocs.vbrick.com/reference/jwt-authentication#process-overview) in Rev Admin and click save.
2. Add the signing certificate in JWT section and download/copy resulting encryption certificate.
3. Use the signing private key and encryption cert when generating JWTs

## Usage

Once configured JWT authentication can be used to:

* cookie-less embedding of videos/webcasts with the [Rev Javascript SDK](https://github.com/vbrick/rev-sdk-js)
* Add as the `jwt_token` query parameter for automatic authentication when [sharing/embedding](https://revdocs.vbrick.com/docs/share-a-video).
* [REST API authentication](https://revdocs.vbrick.com/reference/jwtauthenticate)

**NOTE:** The `sub` *(subject)* value when generating a JWT **MUST** match the username or email address of a valid Rev user. You can only have one active JWT authentication session for a given named user at a time.

## Trusted Access Configuration

1. Enable Trusted Access in Rev Admin -> System Settings -> Content Restriction "Public Access" section.
2. For any video that will be configured for external access update the "Access Control" settings accordingly. This shows in the Video Details API as `enableExternalApplicationAccess: true`

#### Old Payload (Rev User JWT):

JWT for Rev User with email/username `username.or.email@existing.rev.user` - grants access to videos user has access to:

```js
{
    "aud": "rev",
    "iss": "acme-arbitrary-value",
    "res": "*",
    "sub": "username.or.email@existing.rev.user",
    "exp": 123412341234
}
```
#### New Payload (External Viewer JWT):

JWT for guest viewer for video with video id `a4a8775a-daa5-4dee-8b67-3d2c1125619d`. Note the added `"role": "mv"` property. User will be reported in analytics as some arbitrary "Guest" value:

```json
{
    "aud": "rev",
    "iss": "acme-arbitrary-value",
    "res": "a4a8775a-daa5-4dee-8b67-3d2c1125619d",
    "sub": "",
    "role": "mv",
    "exp": 123412341234
}
```

JWT for guest viewer for video with video id `a4a8775a-daa5-4dee-8b67-3d2c1125619d`. User will be reported in analytics with the supplied "sub" as the email address.

```json
{
    "aud": "rev",
    "iss": "acme-arbitrary-value",
    "res": "a4a8775a-daa5-4dee-8b67-3d2c1125619d",
    "sub": "guest1234_gmail.com@external.mail",
    "role": "mv",
    "exp": 123412341234
}
```


## Key Rotation

The encryption certificate that Rev generates is valid for two years. Rev allows having two active signing certificate entries at a time to allow key rotation.

## Disclaimer
This sample code is distributed "as is", with no warranty expressed or implied, and no guarantee for accuracy or applicability to your purpose.
