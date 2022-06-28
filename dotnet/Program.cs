using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;

Console.WriteLine("Generating JWE token...");
Console.WriteLine(JwtGeneration.Jwt.GenerateToken());
Console.ReadLine();

namespace JwtGeneration
{
	public static class Jwt
	{
		private static string SigningPrivateKey = "sign-private-key.pem";
		private static string EncryptionCert = "encrypt-cert.pem";
		public static string GenerateToken()
		{
			// Load Pem files for signing secret and encryption cert
			var signingPrivateKey = File.ReadAllBytes(SigningPrivateKey);
			var encryptionCert = File.ReadAllBytes(EncryptionCert);

			// Token descriptor that conffigures the claims and keys
			var tokenDescriptor = new SecurityTokenDescriptor
			{
				Issuer = "<<ISSUER>>",
				Subject = new ClaimsIdentity(new[]
				{
					new Claim("sub", "<<REV USER ID OR USER EMAIL>>"),
					new Claim("aud", "<<AUDIENCE>>")
				}),
				Expires = DateTime.UtcNow.AddDays(7),
				SigningCredentials = new SigningCredentials(
					new SymmetricSecurityKey(signingPrivateKey),
					SecurityAlgorithms.HmacSha256Signature),
				EncryptingCredentials = new EncryptingCredentials(
					new SymmetricSecurityKey(encryptionCert),
					SecurityAlgorithms.HmacSha256Signature)
			};

			// Generate the token
			var tokenHandler = new JwtSecurityTokenHandler();
			var token = tokenHandler.CreateToken(tokenDescriptor);
			return tokenHandler.WriteToken(token);
		}
	}
}
