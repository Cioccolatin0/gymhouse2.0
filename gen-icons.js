const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c, table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function makePng(size) {
  const dim = Buffer.alloc(13);
  dim.writeUInt32BE(size, 0);
  dim.writeUInt32BE(size, 4);
  dim[8] = 8;
  dim[9] = 6;
  dim[10] = 0;
  dim[11] = 0;
  dim[12] = 0;

  const raw = Buffer.alloc(size * (size * 4 + 1));
  const bg = { r: 79, g: 70, b: 229 };
  const bar = { r: 255, g: 255, b: 255 };
  const grip = { r: 16, g: 185, b: 129 };

  const gripW = Math.round(size * 0.11);
  const barW = Math.round(size * 0.12);
  const barH = Math.round(size * 0.52);
  const barX = Math.round(size * 0.39);
  const barY = Math.round(size * 0.24);
  const gripX1 = Math.round(size * 0.22);
  const gripX2 = Math.round(size * 0.67);
  const gripY = Math.round(size * 0.36);

  for (let y = 0; y < size; y++) {
    const rowOffset = y * (size * 4 + 1);
    raw[rowOffset] = 0;
    for (let x = 0; x < size; x++) {
      let c = bg;
      const at = (px, py) => px >= 0 && px < size && py >= 0 && py < size;
      if (x >= barX && x < barX + barW && y >= barY && y < barY + barH) c = bar;
      if (at(x, y) && ((x >= gripX1 && x < gripX1 + gripW && y >= gripY && y < gripY + gripW) || (x >= gripX2 && x < gripX2 + gripW && y >= gripY && y < gripY + gripW))) c = grip;
      const offset = rowOffset + 1 + x * 4;
      raw[offset] = c.r;
      raw[offset + 1] = c.g;
      raw[offset + 2] = c.b;
      raw[offset + 3] = 255;
    }
  }

  const ihdr = chunk('IHDR', dim);
  const idat = chunk('IDAT', zlib.deflateSync(raw, { level: 9 }));
  const iend = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ihdr, idat, iend]);
}

const outDir = __dirname;
fs.writeFileSync(path.join(outDir, 'icon-192.png'), makePng(192));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), makePng(512));
console.log('Icone generate: icon-192.png, icon-512.png');