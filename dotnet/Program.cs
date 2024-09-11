using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Jose;
using System.Web;
using System.Text.Json;

var usernameOrEmail = "<<USERNAME OR EMAIL>>";
var wildcardOrVideoId = "*";

Console.WriteLine("Generating JWE token...");
var jwt = JwtGeneration.Jwt.GenerateToken(usernameOrEmail, wildcardOrVideoId);
Console.WriteLine(jwt);
Console.WriteLine("Authenticating...");
var authResponse = JwtGeneration.Jwt.GetAccessToken(jwt);
Console.WriteLine($"Authenticated. Session (not JWT) expires {authResponse.expiration}");
var isValidSession = JwtGeneration.Jwt.VerifySession(authResponse.accessToken);
if (!isValidSession)
{
	Console.WriteLine("Session not valid - check provided username/email");
}
else
{
	Console.WriteLine("Session Valid");
}
Console.ReadLine();

namespace JwtGeneration
{
	public static class Jwt
	{
		private static string SigningPrivateKey = "signing.key";
        private static string EncryptionCert = "encryption.pem";
        private static string RevUrl = "https://my.rev.url";

		public static string GenerateToken(string usernameOrEmail = "", string resource = "*", int validMinutes = 30)
		{
			// Load Pem files for signing secret and encryption cert
			var signingKey = RSA.Create();
			signingKey.ImportFromPem(File.ReadAllText(SigningPrivateKey));

			var encryptionCert = new X509Certificate2(File.ReadAllBytes(EncryptionCert));
			var encryptKey = encryptionCert.GetRSAPublicKey();

			// seconds since 1970-01-01 - when token will expire
			var expires = DateTimeOffset.UtcNow.AddMinutes(validMinutes).ToUnixTimeSeconds();
			
			var payload = new Dictionary<string, object>()
			{
				{ "aud", "rev" },
				{ "iss", "rev-jwt-gen-sample" },
				{ "res", resource },
				{ "sub", usernameOrEmail },
				{ "exp", expires }
			};

			// optional - set not before claim to invalidate JWT if used before certain time
			//payload.Add("nbf", DateTimeOffset.UtcNow.AddMinutes(-15).ToUnixTimeSeconds());

			// if external user then specify videoId and mediaviewer ("mv") role. If "*" then it's for an internal user to access all resources/videos
			if (resource != "*")
            {
				payload.Add("role", "mv");
            } else if (usernameOrEmail == "")
            {
				throw new Exception("Username or Emaill cannot be blank for internal user JWT Token Type");
            }

			var headers = new Dictionary<string, object>()
			{
				{ "typ", "JWT" }
			};
			
			string signed = JWT.Encode(payload, signingKey, JwsAlgorithm.RS256, extraHeaders: headers);

			// viewable via jwt.io
			//Console.WriteLine(signed);

			string token = JWE.Encrypt(signed, new[] { new JweRecipient(JweAlgorithm.RSA_OAEP_256, encryptKey) }, JweEncryption.A256GCM, mode: SerializationMode.Compact);
            
            return token;
        }
		public static AccessTokenResponse GetAccessToken(string jwt)
		{
			HttpClient client = new HttpClient();
			var url = $"{RevUrl}/api/v2/jwtauthenticate?jwt_token={HttpUtility.UrlEncode(jwt)}";
			var request = new HttpRequestMessage(HttpMethod.Get, url);
			var response = client.SendAsync(request).Result;
			response.EnsureSuccessStatusCode();
			var doc = JsonSerializer.Deserialize<AccessTokenResponse>(response.Content.ReadAsStream());

			return doc;
		}
		public static bool VerifySession(string accessToken)
        {
			HttpClient client = new HttpClient();
			var url = $"{RevUrl}/api/v2/user/session";
			var request = new HttpRequestMessage(HttpMethod.Get, url);
			request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Vbrick", accessToken);
			var response = client.SendAsync(request).Result;
			return response.IsSuccessStatusCode;
		}
	}
	public class AccessTokenResponse
    {
		public string accessToken { get; set; }
		public string csrfToken { get; set; }
		public DateTimeOffset expiration { get; set; }
	}
}
