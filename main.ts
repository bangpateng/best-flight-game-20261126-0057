// Elang Laut: Island Run (Node 22, standard library only): the game is this
// directory's game/ folder, plain static files a desktop browser loads
// offline (game/index.html and its ES modules, Three.js vendored locally, no
// network request), and this program hands it in. It copies game/ and
// screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library.
//
// Before it copies or writes anything it validates the entry against the
// kit's gate caps and fails loudly, naming the problem, instead of writing
// a broken dossier.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Gate caps from the kit (RULES.txt), mirrored here so a bad entry is
// refused here, with a named reason, instead of by the scorer.
const GAME_MAX_ENTRIES = 993;
const GAME_MAX_BYTES = 48 * 1024 * 1024;
const GAME_PATH_MAX_BYTES = 1000;
const INDEX_MAX_BYTES = 1024 * 1024;
const SHOT_MIN = 3;
const SHOT_MAX = 4;
const SHOT_MAX_BYTES = 256 * 1024;
const SHOT_LONG_MAX = 1280;
const SHOT_SHORT_MIN = 480;

// --- validation -----------------------------------------------------------

const errors: string[] = [];
function bad(message: string): void {
  errors.push(message);
}

// Walk game/ the way the gate counts it: plain files and directories only,
// no symlinks, at most 993 entries together, 48 MiB in all, every path at
// most 1000 UTF-8 bytes, and game/index.html a regular file of at most 1 MiB.
function validateGameDir(dir: string): void {
  const index = join(dir, 'index.html');
  if (!existsSync(index)) {
    bad(`game/index.html is missing`);
  } else {
    const st = lstatSync(index);
    if (st.isSymbolicLink() || !st.isFile()) bad(`game/index.html is not a regular file`);
    else if (st.size > INDEX_MAX_BYTES) {
      bad(`game/index.html is ${st.size} bytes, over the 1 MiB cap`);
    }
  }
  let entries = 0;
  let bytes = 0;
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const rel = p.slice(dir.length + 1);
      if (Buffer.byteLength(rel, 'utf8') > GAME_PATH_MAX_BYTES) {
        bad(`game/${rel}: path is over 1000 UTF-8 bytes`);
      }
      const st = lstatSync(p);
      entries += 1;
      if (st.isSymbolicLink()) {
        bad(`game/${rel}: symlink (game/ must be plain files and directories only)`);
      } else if (st.isDirectory()) {
        walk(p);
      } else if (st.isFile()) {
        bytes += st.size;
      } else {
        bad(`game/${rel}: not a regular file or directory`);
      }
    }
  };
  walk(dir);
  if (entries > GAME_MAX_ENTRIES) {
    bad(`game/ holds ${entries} entries, over the 993-entry cap`);
  }
  if (bytes > GAME_MAX_BYTES) {
    bad(`game/ totals ${bytes} bytes, over the 48 MiB cap`);
  }
}

// PNG signature + IHDR dimensions, or JPEG SOI + first SOF marker
// dimensions; anything else is not a whole PNG or JPEG.
function imageDimensions(buf: Buffer): { kind: string; width: number; height: number } | null {
  const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length >= 24 && buf.subarray(0, 8).equals(PNG_SIG)) {
    return {
      kind: 'PNG',
      width: buf.readUInt32BE(16),
      height: buf.readUInt32BE(20),
    };
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = buf[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return {
          kind: 'JPEG',
          height: buf.readUInt16BE(i + 5),
          width: buf.readUInt16BE(i + 7),
        };
      }
      if (marker === 0xda || marker === 0xd9) break; // start of scan: no SOF found
      i += 2 + buf.readUInt16BE(i + 2);
    }
  }
  return null;
}

// Screenshots row: 3 to 4 images (dotfiles skipped), names of letters,
// digits and . _ - (1-128 chars, not starting with . or -), each at most
// 256 KiB, a whole PNG or JPEG, long side at most 1280, short side at
// least 480 pixels.
function validateScreenshots(dir: string): void {
  if (!existsSync(dir)) {
    bad(`screenshots/ is missing (need ${SHOT_MIN}-${SHOT_MAX} screenshots)`);
    return;
  }
  const names = readdirSync(dir).filter((n) => !n.startsWith('.')).sort();
  if (names.length < SHOT_MIN || names.length > SHOT_MAX) {
    bad(`screenshots/ holds ${names.length} images, need ${SHOT_MIN}-${SHOT_MAX}`);
  }
  for (const name of names) {
    const p = join(dir, name);
    const st = lstatSync(p);
    if (st.isSymbolicLink() || !st.isFile()) {
      bad(`screenshots/${name}: not a regular file`);
      continue;
    }
    if (!/^[A-Za-z0-9._-]{1,128}$/.test(name) || name.startsWith('-')) {
      bad(`screenshots/${name}: name must be 1-128 letters, digits or . _ -, not starting with -`);
    }
    if (st.size > SHOT_MAX_BYTES) {
      bad(`screenshots/${name}: ${st.size} bytes, over the 256 KiB cap`);
    }
    const dims = imageDimensions(readFileSync(p));
    if (!dims) {
      bad(`screenshots/${name}: not a whole PNG or JPEG image`);
      continue;
    }
    const long = Math.max(dims.width, dims.height);
    const short = Math.min(dims.width, dims.height);
    if (long > SHOT_LONG_MAX || short < SHOT_SHORT_MIN) {
      bad(
        `screenshots/${name}: ${dims.kind} ${dims.width}x${dims.height}, ` +
          `need long side <= ${SHOT_LONG_MAX} and short side >= ${SHOT_SHORT_MIN}`,
      );
    }
  }
}

validateGameDir(join(here, 'game'));
validateScreenshots(join(here, 'screenshots'));
if (errors.length > 0) {
  for (const e of errors) console.error(`main.ts: validation failed: ${e}`);
  console.error(`main.ts: refusing to write a broken dossier (${errors.length} problem(s))`);
  process.exit(1);
}

// --- hand-in --------------------------------------------------------------

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of
// game files, in all, or a path under game/ over 1000 bytes: game/ counts
// beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
