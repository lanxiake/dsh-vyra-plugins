/**
 * PNG statistics (pure, Node zlib only).
 *
 * The colour gate's "wallpaper interference" dimension needs pixel evidence:
 * how busy is the image behind the text? Decoding PNG here — rather than
 * depending on sharp — keeps the gate runnable on a bare Node install, and the
 * generated wallpapers are PNGs straight out of ComfyUI.
 *
 * Two numbers come out of a frame:
 *   stdLuma     spread of Rec.709 luma (0 = flat colour, 0.5 = harsh contrast)
 *   edgeEnergy  mean absolute horizontal/vertical luma gradient, normalised to
 *               0..1 — a busy, detailed picture scores high
 */
import { deflateSync, inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function isPng(buffer) {
  return Buffer.isBuffer(buffer) && buffer.length > 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    table[index] = value >>> 0;
  }
  return table;
})();

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Decode an 8-bit PNG (grey/RGB/palette/RGBA, non-interlaced) into
 * `{width, height, channels, data}`. Throws on anything it cannot read, so a
 * caller never analyses garbage silently.
 */
export function decodePng(buffer) {
  if (!isPng(buffer)) throw new Error("not a PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  let palette = null;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "PLTE") {
      palette = data;
    } else if (type === "IDAT") {
      idat.push(data);
    } else if (type === "IEND") {
      break;
    }
  }
  if (width <= 0 || height <= 0) throw new Error("PNG has no dimensions");
  if (bitDepth !== 8) throw new Error(`unsupported PNG bit depth ${bitDepth}`);
  if (interlace !== 0) throw new Error("interlaced PNG is not supported");
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (channels === undefined) throw new Error(`unsupported PNG colour type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(stride * height);
  let previous = Buffer.alloc(stride);
  for (let row = 0; row < height; row += 1) {
    const filter = raw[row * (stride + 1)];
    const line = raw.subarray(row * (stride + 1) + 1, row * (stride + 1) + 1 + stride);
    const target = out.subarray(row * stride, row * stride + stride);
    for (let index = 0; index < stride; index += 1) {
      const left = index >= channels ? target[index - channels] : 0;
      const up = previous[index];
      const upLeft = index >= channels ? previous[index - channels] : 0;
      let value;
      switch (filter) {
        case 0: value = line[index]; break;
        case 1: value = line[index] + left; break;
        case 2: value = line[index] + up; break;
        case 3: value = line[index] + ((left + up) >> 1); break;
        case 4: value = line[index] + paeth(left, up, upLeft); break;
        default: throw new Error(`unknown PNG filter ${filter}`);
      }
      target[index] = value & 0xff;
    }
    previous = target;
  }
  return { width, height, channels, colorType, palette, data: out };
}

function lumaAt(image, pixelIndex) {
  const { channels, colorType, data, palette } = image;
  if (colorType === 3) {
    const entry = data[pixelIndex];
    if (palette === null || entry * 3 + 2 >= palette.length) return 0;
    const r = palette[entry * 3];
    const g = palette[entry * 3 + 1];
    const b = palette[entry * 3 + 2];
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  if (channels === 1) return data[pixelIndex];
  if (channels === 2) return data[pixelIndex * 2];
  const base = pixelIndex * channels;
  return 0.2126 * data[base] + 0.7152 * data[base + 1] + 0.0722 * data[base + 2];
}

/**
 * Compute `{width, height, stdLuma, edgeEnergy}` for an image buffer.
 *
 * Default `step` is 1: exact statistics. A subsampling stride aliases against
 * periodic art (a 2px checkerboard sampled every 2nd pixel reads as one flat
 * colour), and a wallpaper being wrongly declared "calm" is worse than the few
 * hundred milliseconds a full pass costs. `step > 1` stays available for very
 * large inputs, with that caveat.
 */
export function imageStats(buffer, { step = 1 } = {}) {
  const image = decodePng(buffer);
  const stride = Math.max(1, Math.floor(step));
  const values = [];
  const rows = [];
  for (let y = 0; y < image.height; y += stride) {
    const row = [];
    for (let x = 0; x < image.width; x += stride) {
      const luma = lumaAt(image, y * image.width + x);
      row.push(luma);
      values.push(luma);
    }
    rows.push(row);
  }
  const count = values.length;
  const mean = count === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / count;
  const variance = count === 0 ? 0 : values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count;
  const stdLuma = Math.sqrt(variance) / 255;

  let edgeTotal = 0;
  let edgeCount = 0;
  for (const row of rows) {
    for (let index = 1; index < row.length; index += 1) {
      edgeTotal += Math.abs(row[index] - row[index - 1]);
      edgeCount += 1;
    }
  }
  for (let y = 1; y < rows.length; y += 1) {
    for (let x = 0; x < rows[y].length; x += 1) {
      edgeTotal += Math.abs(rows[y][x] - rows[y - 1][x]);
      edgeCount += 1;
    }
  }
  const edgeEnergy = edgeCount === 0 ? 0 : Math.min(1, edgeTotal / edgeCount / 255);

  return { width: image.width, height: image.height, stdLuma: Number(stdLuma.toFixed(4)), edgeEnergy: Number(edgeEnergy.toFixed(4)) };
}

/** Encode 8-bit RGB pixels as a PNG — used by tests and by stats fixtures. */
export function encodePng({ width, height, pixels }) {
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    pixels.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(typeAndData));
    return Buffer.concat([length, typeAndData, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2; // truecolour
  return Buffer.concat([
    PNG_SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}