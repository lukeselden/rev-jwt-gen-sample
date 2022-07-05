import { parse } from "https://deno.land/std@0.146.0/flags/mod.ts";
import { config as dotenv } from "https://deno.land/std@0.146.0/dotenv/mod.ts";

// use dotenv from std library to read values from .env / environment variables
const cfg = await dotenv({ safe: true });
export const config = {
  encryptionCertPath: cfg.REV_JWT_ENCRYPTION_CERT,
  keyPath: cfg.REV_JWT_SIGNING_KEY,
  signingCertPath: cfg.REV_JWT_SIGNING_CERT,
  revUrl: cfg.REV_JWT_URL
};

// use flags from std library to read cli arguments 
export function getArgs<T>() {
  return parse(Deno.args) as { _: string[]; help?: boolean } & Record<string, string | undefined> & T;
}

/**
 * if string is "-" then read value from stdin
 */
export async function parseStdInArg<T extends string | undefined>(val: T) {
  if (val !== '-') {
    return val;
  }
  const buf = new Uint8Array(4096);
  const length = await Deno.stdin.read(buf);
  if (length) {
    return new TextDecoder().decode(buf.slice(0, length)).trim();
  }
  return '';
}

/**
 * run process and accumulate response
 */
export async function exec(cmd: string[], stdin?: string) {
  const p = Deno.run({
    cmd,
    stdin: stdin ? "piped" : "null",
    stdout: "piped",
    stderr: "piped"
  });

  if (stdin) {
    const encoder = new TextEncoder();
    await p.stdin?.write(encoder.encode(stdin));
    await p.stdin?.close();
  }

  const [status, stdout, stderr] = await Promise.all([
    p.status(),
    p.output(),
    p.stderrOutput()
  ]);
  
  p.close();
  const decoder = new TextDecoder();

  if (status.success) {
    return decoder.decode(stdout);
  }

  throw new ExecError(status.code, decoder.decode(stderr));
}

export class ExecError extends Error {
  constructor(
    public readonly code: number,
    public readonly stderr: string
  ) {
    super(`Exec Error ${code}`);
  }
}

// return bool if file exists or not
export async function exists(path: string) {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    }
    throw error;
  }
}
