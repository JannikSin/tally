// Zero-dep PNG icon generator: navy field, four chalk tally strokes, brass diagonal.
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter none
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const INK = hex("#0B1526");
const INK2 = hex("#132440");
const CHALK = hex("#E9F1FB");
const BRASS = hex("#E5B04A");

const distSeg = (px, py, x1, y1, x2, y2) => {
  const dx = x2 - x1, dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  const cx = x1 + t * dx, cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
};

function draw(size) {
  const px = Buffer.alloc(size * size * 4);
  const u = size / 512; // design in 512 space
  // four vertical strokes + brass diagonal (a hand-drawn "5" tally)
  const w = 26 * u; // stroke half-width
  const top = 150 * u, bot = 362 * u;
  const xs = [136, 216, 296, 376].map((x) => x * u);
  const tilt = 10 * u; // slight hand-drawn lean, alternating
  const diag = [88 * u, 330 * u, 424 * u, 182 * u];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // radial felt glow toward center
      const d = Math.hypot(x - size / 2, y - size / 2) / (size / 2);
      const mix = Math.max(0, 1 - d * d);
      let [r, g, b] = [0, 1, 2].map((k) => Math.round(INK[k] + (INK2[k] - INK[k]) * mix * 0.9));
      let a = 255;
      for (let s = 0; s < 4; s++) {
        const lean = s % 2 ? tilt : -tilt;
        const dd = distSeg(x, y, xs[s] - lean / 2, top, xs[s] + lean / 2, bot);
        if (dd < w) {
          const edge = Math.min(1, (w - dd) / (2 * u));
          [r, g, b] = [0, 1, 2].map((k) => Math.round(r + (CHALK[k] - r) * edge));
        }
      }
      const dd = distSeg(x, y, diag[0], diag[1], diag[2], diag[3]);
      if (dd < w) {
        const edge = Math.min(1, (w - dd) / (2 * u));
        [r, g, b] = [0, 1, 2].map((k) => Math.round(r + (BRASS[k] - r) * edge));
      }
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
    }
  }
  return px;
}

mkdirSync(new URL("../icons/", import.meta.url), { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(new URL(`../icons/icon-${size}.png`, import.meta.url), png(size, draw(size)));
}
writeFileSync(new URL("../icons/apple-touch-icon.png", import.meta.url), png(180, draw(180)));
console.log("icons written");
