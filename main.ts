// Entry for the make.fun video-on-X bounty "The agent builds a game from one prompt".
// Node 22, standard library only. The program validates POST.json at the
// repository root and copies it to /output/POST.json, where the gate reads
// the X post address. A placeholder or malformed address fails loudly
// instead of being handed in silently.
//
// Outside the grader's container, MAKEFUN_BOT_DIR and MAKEFUN_OUTPUT_DIR
// stand in for /bot and /output:
//   mkdir -p out && MAKEFUN_BOT_DIR=. MAKEFUN_OUTPUT_DIR=out node main.ts

import { copyFileSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BOT_DIR = process.env.MAKEFUN_BOT_DIR ?? '/bot';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const MAX_POST_BYTES = 16384;
const POST_URL = /^https:\/\/(www\.|mobile\.)?(x\.com|twitter\.com)\/[^/]+\/status\/\d+$/;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readPost(): { url: string } {
  const source = join(BOT_DIR, 'POST.json');
  let size: number;
  try {
    size = statSync(source).size;
  } catch (err) {
    fail(`POST.json could not be found in ${BOT_DIR}: ${(err as Error).message}`);
  }
  if (size! > MAX_POST_BYTES) {
    fail(`POST.json is ${size} bytes, over the ${MAX_POST_BYTES} byte limit`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(source, 'utf8'));
  } catch (err) {
    fail(`POST.json could not be read as JSON from ${BOT_DIR}: ${(err as Error).message}`);
  }
  const url = (parsed as { url?: unknown }).url;
  if (typeof url !== 'string' || !POST_URL.test(url)) {
    fail('POST.json must name a real X post: https://x.com/<handle>/status/<digits>');
  }
  return { url: url as string };
}

const post = readPost();
const postId = post.url.split('/status/')[1].split(/[?#]/)[0];
if (post.url.includes('<handle>') || post.url.includes('<id>') || postId.length < 10) {
  fail('POST.json still holds the starter placeholder, not a real post address');
}

mkdirSync(OUTPUT_DIR, { recursive: true });
const destination = join(OUTPUT_DIR, 'POST.json');
try {
  copyFileSync(join(BOT_DIR, 'POST.json'), destination);
} catch (err) {
  fail(`POST.json could not be copied from ${BOT_DIR}: ${(err as Error).message}`);
}
// Verify the copy byte-for-byte so a truncated write is caught here,
// not by the gate reading /output/POST.json later.
const copied = readFileSync(destination, 'utf8');
if (JSON.parse(copied).url !== post.url) {
  fail('POST.json copy does not match the source, refusing to hand it in');
}
console.log(`POST.json copied for ${post.url} (${statSync(destination).size} bytes)`);
