// BEGIN - CONFIGURATION

// JWT Payload
const data = {
	aud: '<<AUDIENCE>>',
	iss: "<<ISSUER>>",
	exp: '<<SECONDS SINCE THE EPOCH>>',
	sub: '<<REV USER ID OR USER EMAIL>>'
};

// Signing Private Key PEM file
const signPrivateKeyFilename = 'sign-private-key.pem';
// Encryption Certificate PEM file
const encryptCertFilename = 'encrypt-cert.pem';

// END - CONFIGURATION

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { JWK, JWE } = require('node-jose');

const keystore = JWK.createKeyStore();

const signPrivateKey = fs.readFileSync(getPath(signPrivateKeyFilename));
const encryptCertificate = fs.readFileSync(getPath(encryptCertFilename));

// Gets the abosulte path of the PEM file
function getPath(filename) {
	return path.resolve(process.cwd(), filename);
}

// Signs the payload using a Private Key
function sign(data) {
  return jwt.sign(data, signPrivateKey, { algorithm: 'RS256' });
}

// Encrypts the signed token using a Certifficate
function encrypt(signedToken) {
  return keystore.add(encryptCertificate, 'pem')
		 .then(key => {
		   return JWE.createEncrypt({ format: 'compact' }, key)
		      .update(signedToken)
	              .final();
		 });
}

const signedToken = sign(data);

//console.log('Signed Token ', signedToken);

encrypt(signedToken)
	.then(encryptedToken => console.log(encryptedToken));

