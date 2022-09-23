import parser from 'yargs-parser';
import * as dotenv from 'dotenv';
import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

/**
 * @returns {{_: string[], help?: boolean, minutes?: number, exp?: number, nbf?: number, sub?: string} & Record<string, string>}
 */
export function getCommandLineArgs() {
    const args = parser(process.argv.slice(2));
    return args;
}

export function getEnvironmentVariables() {
    const {parsed: env = {}} = dotenv.config();
    const envVariables = {
        REV_JWT_URL: env.REV_JWT_URL,
        REV_JWT_ENCRYPTION_CERT: env.REV_JWT_ENCRYPTION_CERT,
        REV_JWT_SIGNING_KEY: env.REV_JWT_SIGNING_KEY,
        REV_JWT_SIGNING_CERT: env.REV_JWT_SIGNING_CERT
    };
    return envVariables;
}

/**
 * The scripts in this project depend on some common variables, which can be set via
 * environment variables or overridden via cli arguments
 */
export function getEnvConfig(args = getCommandLineArgs()) {
    const {parsed: env = {}} = dotenv.config();
    return {
        revUrl: args.url                 || env.REV_JWT_URL,
        signingKeyPath: args.sign        || env.REV_JWT_SIGNING_KEY     || 'signing.private.key',
        signingCertPath: args.signcert   || env.REV_JWT_SIGNING_CERT    || 'signing.public.key',
        encryptionCertPath: args.encrypt || env.REV_JWT_ENCRYPTION_CERT || 'encrypt.public.key'
    };
}

/**
 * check if script is being run vs. being required by a different script
 * https://stackoverflow.com/questions/57838022/detect-whether-es-module-is-run-from-command-line-in-node
 * @param {string} fileUrl import.meta.url
 * @returns 
 */
export function isMainEntryPoint(fileUrl) {
    return fileUrl === pathToFileURL(process.argv[1] ?? '').href;
}

/**
 * check if file exists
 * @param {string} filepath 
 * @returns {Promise<boolean>}
 */
export async function exists(filepath) {
    return fs.access(filepath).then(() => true, () => false);
}

/**
 * simple logging helper to colorize output to console
 */
const shouldColorize = process.env.NO_COLOR != '1' && process.stderr.isTTY;
export const logger = shouldColorize ? {
    ...console,
    debug(...args) { console.error('\x1b[32m', ...args, '\x1b[0m'); },
    warn(...args) { console.error('\x1b[33m', ...args, '\x1b[0m'); },
    error(...args) { console.error('\x1b[31m', ...args, '\x1b[0m'); }
} : console;


/**
 * Helper to translate a non-200 fetch response into an Error object with additional details
 * @param {import("undici").Response} response 
 * @returns {Promise<Error & {isHttpError: true, details: {name: string, message: string}}>}
 */
export async function readErrorResponse(response) {
    // Error response may have additional details
    const details = await response
        .json()
        .catch((err) => ({ name: "UnknownError", message: `${err}` }));

    const error = new Error(`HTTP ${response.status} ${response.statusText}`);
    Object.assign(error, { isHttpError: true, details });
    return error;
}