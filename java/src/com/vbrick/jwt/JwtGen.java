package com.vbrick.jwt;
 
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Date;

import com.nimbusds.jose.EncryptionMethod;
import com.nimbusds.jose.JWEAlgorithm;
import com.nimbusds.jose.JWEHeader;
import com.nimbusds.jose.JWEObject;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.JWSSigner;
import com.nimbusds.jose.Payload;
import com.nimbusds.jose.crypto.RSAEncrypter;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
 
public class JwtGen {
   
    public static void main(String args[]) throws Exception {
 
        //Private Signing Key - your app key
        String privateSignKeyPath = "<<PATH_TO_PRIVATE_SIGNING_KEY>>";
        String signPrivateKeyContent = new String(Files.readAllBytes(Paths.get(privateSignKeyPath)));
        RSAKey rsaSignPrivateJWK = (RSAKey)JWK.parseFromPEMEncodedObjects(signPrivateKeyContent);
 
        //Public Encryption Key - Vbrick Rev key
        String publicEncKeyPath = "<<PATH_TO_PUBLIC_ENCRYPTION_KEY_PROVIDED_BY_VBRICK_REV>>";
        String encPublicKeyContent = new String(Files.readAllBytes(Paths.get(publicEncKeyPath)));
        RSAKey rsaEncPublicJWK = (RSAKey)JWK.parseFromPEMEncodedObjects(encPublicKeyContent);
 
        // Create RSA-signer with the private key
        JWSSigner signer = new RSASSASigner(rsaSignPrivateJWK);
 
        // Prepare JWT with claims set
        JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
            .audience("rev")
            .issuer("MyApp")
            .subject("john.doe@acme.com")
            .expirationTime(new Date(new Date().getTime() + 60 * 1000))
            .notBeforeTime(new Date(new Date().getTime() - 60 * 1000))
            .claim("res", "e8333dad-57f0-4d7f-9426-ce3315b12555") //cold be * or no need to include this claim
            .claim("fname", "John")
            .claim("lname", "Doe")
            .build();
 
        SignedJWT signedJWT = new SignedJWT(
        new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(rsaSignPrivateJWK.getKeyID()).build(),
            claimsSet);
 
        // Compute the RSA signature
        signedJWT.sign(signer);
 
        // To serialize to compact form
        String signedJWTStr = signedJWT.serialize();
        System.out.println("Signed JWT: " + signedJWTStr);
 
        //Encryption
        JWEObject encJweObject = new JWEObject(
            new JWEHeader.Builder(JWEAlgorithm.RSA_OAEP_256, EncryptionMethod.A256GCM)
            .contentType("JWT")
            .build(),
            new Payload(signedJWT));
 
        // Encrypt with the Vbrick Rev's public key
        encJweObject.encrypt(new RSAEncrypter(rsaEncPublicJWK));
 
        // Serialise to JWE compact form
        String encJweString = encJweObject.serialize();
        System.out.println("Encrypted & Signed JWT: " + encJweString);
           
      }
}