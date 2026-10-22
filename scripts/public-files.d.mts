export interface PublicFile {
  path: string;
  data: Buffer;
}
export interface BuildStamp {
  app: string;
  commit: string;
  ref: string;
  run: string;
}
export const ALLOWED_EXTENSIONS: readonly string[];
export const URL_ALLOW_LIST: readonly string[];
export function scanFiles(files: readonly PublicFile[], options?: { expectedCommit?: string; requireStamp?: boolean }): string[];
export function readDir(dir: string): PublicFile[];
export function buildStamp(env?: Record<string, string | undefined>): BuildStamp;
export function writeStamp(dir: string, env?: Record<string, string | undefined>): BuildStamp;
