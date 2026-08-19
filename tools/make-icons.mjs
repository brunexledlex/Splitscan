/* Renders the app icon — a radar sweep, the app's own geometry — and writes
   PNGs with a minimal encoder so this stays dependency-free.
   Run: node tools/make-icons.mjs                                          */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

/* ── minimal PNG writer (RGBA, no interlace) ───────────────────────── */
const CRC_T = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++){
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = buf => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_T[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
function png(width, height, rgba){
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++){
    raw[y * (stride + 1)] = 0;                                  // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, {level: 9})),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ── the mark ──────────────────────────────────────────────────────── */
const GROUND = [0x0D, 0x0A, 0x08];
const AMBER  = [0xFF, 0x9A, 0x2E];
const INK    = [0xED, 0xE4, 0xD8];
const TAU = Math.PI * 2;

function render(size){
  const buf = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const R = size * 0.40;          // sweep disc
  const SS = 2;                   // supersample factor
  const blade = -Math.PI / 2;     // blade points up

  for (let y = 0; y < size; y++){
    for (let x = 0; x < size; x++){
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++){
        for (let sx = 0; sx < SS; sx++){
          const px = x + (sx + .5) / SS - c;
          const py = y + (sy + .5) / SS - c;
          const d = Math.hypot(px, py);
          let col = GROUND;

          if (d <= R){
            let a = Math.atan2(py, px) - blade;
            a = ((a % TAU) + TAU) % TAU;             // 0 at blade, grows behind
            // quantise to discrete slices — the geometry the app actually cuts
            const wedges = 16, gap = 0.018;
            const slot = TAU / wedges;
            const qa = Math.floor(a / slot) * slot;
            const k = Math.pow(1 - qa / TAU, 1.7) * 0.95;
            const inGap = (a % slot) < gap;          // hairline between slices
            const lead = a < slot;                   // bright leading blade
            const tint = lead ? INK : AMBER;
            const m = inGap ? 0 : (lead ? 1 : k);
            col = [
              GROUND[0] + (tint[0] - GROUND[0]) * m,
              GROUND[1] + (tint[1] - GROUND[1]) * m,
              GROUND[2] + (tint[2] - GROUND[2]) * m,
            ];
            // hub
            if (d < size * 0.045) col = GROUND;
          }
          r += col[0]; g += col[1]; b += col[2];
        }
      }
      const n = SS * SS, i = (y * size + x) * 4;
      buf[i] = r / n; buf[i+1] = g / n; buf[i+2] = b / n; buf[i+3] = 255;
    }
  }
  return png(size, size, buf);
}

mkdirSync(OUT, {recursive: true});
for (const s of [180, 192, 512]){
  const file = join(OUT, `icon-${s}.png`);
  writeFileSync(file, render(s));
  console.log('wrote', file);
}
