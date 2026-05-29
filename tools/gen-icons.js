// One-shot icon generator — rasterises the Aperolympics emblem (see
// public/icons/icon.svg) into PNGs at the sizes Android/iOS want, with ZERO
// dependencies (hand-rolled PNG encoder via Node's zlib). Re-run after changing
// the emblem:  node tools/gen-icons.js
//
// Outputs: public/icons/icon-192.png, icon-512.png, icon-180.png (apple-touch),
// and icon-512-maskable.png (extra padding for Android maskable safe-zone).

const zlib = require("zlib");
const fs = require("fs");
const path = require("path");

// --- emblem geometry, in the SVG's 512 coordinate space ---
const BG = [15, 16, 32];          // #0f1020
const BLUE = [91, 108, 255];      // #5b6cff
const RED = [230, 57, 74];        // #e6394a
const GOLD = [255, 210, 63];      // #ffd23f
const GOLD_LIGHT = [255, 224, 122]; // #ffe07a
const GOLD_DARK = [224, 180, 0];  // #e0b400
const blueQuad = [[196, 116], [262, 286], [206, 308], [150, 168]];
const redQuad = [[316, 116], [250, 286], [306, 308], [362, 168]];
const star = [[256, 272], [270, 311], [311, 312], [279, 337], [290, 377], [256, 354], [222, 377], [233, 337], [201, 312], [242, 311]];

function inPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function inCircle(x, y, cx, cy, r) { const dx = x - cx, dy = y - cy; return dx * dx + dy * dy <= r * r; }

// Colour of the emblem at a point in 512-space (painter's order), or null for
// "outside the rounded-rect" (transparent corners — OS masks anyway, but clean).
function colorAt(x, y, pad, rx) {
  // pad: inset of the artwork (for maskable padding); rx: corner radius
  const W = 512;
  // rounded-rect background coverage
  const inX = x >= 0 && x <= W, inY = y >= 0 && y <= W;
  if (!inX || !inY) return null;
  // rounded corners
  if (x < rx && y < rx && !inCircle(x, y, rx, rx, rx)) return null;
  if (x > W - rx && y < rx && !inCircle(x, y, W - rx, rx, rx)) return null;
  if (x < rx && y > W - rx && !inCircle(x, y, rx, W - rx, rx)) return null;
  if (x > W - rx && y > W - rx && !inCircle(x, y, W - rx, W - rx, rx)) return null;
  let c = BG;
  if (inPoly(x, y, blueQuad)) c = BLUE;
  if (inPoly(x, y, redQuad)) c = RED;
  if (inCircle(x, y, 256, 330, 125)) c = GOLD_DARK;
  if (inCircle(x, y, 256, 330, 120)) c = GOLD;
  if (inCircle(x, y, 256, 330, 94)) c = GOLD_LIGHT;
  if (inPoly(x, y, star)) c = GOLD_DARK;
  return c;
}

function render(size, opts) {
  opts = opts || {};
  const pad = opts.pad || 0;           // fraction of padding (maskable)
  const rx = opts.rx != null ? opts.rx : 104; // corner radius in 512-space
  const SS = 3;                         // supersampling for crisp edges
  const buf = Buffer.alloc(size * size * 4);
  const art = 512 * (1 - 2 * pad);      // artwork box in 512-space
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, bl = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          // map output pixel → 512-space (with padding for maskable)
          const u = (px + (sx + 0.5) / SS) / size;
          const v = (py + (sy + 0.5) / SS) / size;
          const X = (u - pad) / (1 - 2 * pad) * 512;
          const Y = (v - pad) / (1 - 2 * pad) * 512;
          let c;
          if (pad > 0) {
            // maskable: fill the whole canvas with BG (no transparent corners),
            // artwork inset; outside the artwork box → BG.
            c = (X < 0 || X > 512 || Y < 0 || Y > 512) ? BG : (colorAt(X, Y, 0, 0) || BG);
          } else {
            c = colorAt(X, Y, 0, rx);
          }
          if (c) { r += c[0]; g += c[1]; bl += c[2]; a += 255; }
        }
      }
      const n = SS * SS;
      const i = (py * size + px) * 4;
      buf[i] = Math.round(r / n); buf[i + 1] = Math.round(g / n); buf[i + 2] = Math.round(bl / n); buf[i + 3] = Math.round(a / n);
    }
  }
  return buf;
}

// --- minimal PNG encoder (RGBA, filter 0) ---
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const tb = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([tb, data])), 0);
  return Buffer.concat([len, tb, data, crc]);
}
function encodePNG(size, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

const OUT = path.join(__dirname, "..", "public", "icons");
const jobs = [
  ["icon-192.png", 192, {}],
  ["icon-512.png", 512, {}],
  ["icon-180.png", 180, { rx: 0 }],                 // apple-touch: square (iOS rounds it)
  ["icon-512-maskable.png", 512, { pad: 0.12 }],    // Android maskable safe-zone
];
for (const [name, size, opts] of jobs) {
  const png = encodePNG(size, render(size, opts));
  fs.writeFileSync(path.join(OUT, name), png);
  console.log("wrote", name, png.length, "bytes");
}
console.log("done");
