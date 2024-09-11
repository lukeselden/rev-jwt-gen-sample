// @ts-check

import { getCommandLineArgs, getEnvConfig, isMainEntryPoint, logger } from './lib/utils.js';
import {externalUserJWTPayload, generateJWT, internalUserJWTPayload} from './jwt.js';
import {getAccessToken} from './auth.js';
import {makeRevRequest} from './request.js';

//#region COMMANDLINE
if (isMainEntryPoint(import.meta.url)) {
    try {
        // dynamic inputs - Specify JWT subject
        const args = getCommandLineArgs();
        const usernameOrEmail = args._?.[0] || args.sub; // REQUIRED, must exist in Rev
        const videoId = args.video;

        if (args.help) {
            showHelp();
        }

        // static inputs - Your Rev tenant's URL and signing/encryption certificates (see README.md)
        // pulled from commandline-args or env variables
        const {
            revUrl,
            signingKeyPath, 
            encryptionCertPath 
        } = getEnvConfig(args);

        // create JWT that is good for one hour
        const exp = Date.now() / 1000 + 3600;

        const payload = videoId
            ? externalUserJWTPayload(videoId, usernameOrEmail, exp)
            : internalUserJWTPayload(usernameOrEmail, exp);

        const jwt = await generateJWT(payload, signingKeyPath, encryptionCertPath);
        logger.debug(`JWT for ${usernameOrEmail}`, jwt);
        
        logger.debug('Trading JWT for Access Token for API usage...');
        const {accessToken, expiration} = await getAccessToken(revUrl, jwt);
        logger.debug('ACCESSTOKEN', accessToken, 'expires', expiration);


        logger.debug('Verifying session is valid...');
        const isSessionValid = await makeRevRequest(revUrl, '/api/v2/user/session', accessToken)
            .then(() => true)
            .catch(err => false);

        if (!isSessionValid) {
            logger.error('Invalid session!');
        }

        logger.debug('Getting details of current user via API...');
        const userDetails = await makeRevRequest(revUrl, '/api/v2/users/me', accessToken);
        logger.debug('user details:');
        logger.info(userDetails);

        logger.debug('Extending expiration time of current session');
        const extendResult = await makeRevRequest(revUrl, '/api/v2/user/extend-session', accessToken, 'POST');
        logger.info(extendResult);

        let playbackUrl;
        let title = 'NOT FOUND';
        if (videoId) {
            logger.debug(`Testing for video access for ${videoId}`);
            const video = await makeRevRequest(revUrl, `/api/v2/videos/${videoId}/playback-url`, accessToken);
            playbackUrl = new URL(video.playbackUrl);
            title = video.title;
        } else {
            logger.debug('Searching for the latest video uploaded to Rev (that this user can view)');
            const videoResults = await makeRevRequest(revUrl, '/api/v2/videos/search?count=1&sortField=whenUploaded&sortDirection=desc', accessToken);
            const video = videoResults.videos[0];
            playbackUrl = new URL(video.playbackUrl);
            title = video.title;
        }

        if (playbackUrl) {
            // add jwt_token query param to embed a video for a specific user
            playbackUrl.searchParams.set('jwt_token', jwt);
    
            logger.info(`Custom embed URL for ${userDetails.username} to view the video ${title}:`, playbackUrl.toString());
        } else {
            logger.warn('No available videos found');
        }

    } catch (error) {
        logger.error(error);
    }
}

//#endregion
//#region HELPERS

function showHelp() {
    console.error(`
Example of using the full JWT login process (JWT -> Authenticate -> use Rev API)

USAGE:
node index.js <usernameOrEmail>

ARGS:
    <usernameOrEmail>               The username or email of Rev user in question

OPTIONS:
  --url      [string]               Rev URL (DEFAULT: set in .env file)
`);
    process.exit(1);
}

//#endregion