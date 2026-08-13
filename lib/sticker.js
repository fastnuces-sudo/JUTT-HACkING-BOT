import crypto from 'crypto';
import fs from 'fs-extra';
import sharp from 'sharp';
import webpMux from 'node-webpmux';

const { Image: WebpImage } = webpMux;

/**
 * Sticker layouts supported by the old wa-sticker-formatter API.
 * Keeping the same names makes plugin migration intentionally small.
 */
export const StickerTypes = Object.freeze({
  DEFAULT: 'default',
  CROPPED: 'crop',
  FULL: 'full',
  CIRCLE: 'circle',
  ROUNDED: 'rounded',
});

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const MAX_REMOTE_BYTES = 25 * 1024 * 1024;

function normaliseQuality(value) {
  const quality = Number(value ?? 80);
  if (!Number.isFinite(quality)) return 80;
  return Math.max(1, Math.min(100, Math.round(quality)));
}

function buildExif(metadata) {
  const payload = JSON.stringify({
    'sticker-pack-id': metadata.id || crypto.randomBytes(32).toString('hex'),
    'sticker-pack-name': metadata.pack || '',
    'sticker-pack-publisher': metadata.author || '',
    emojis: Array.isArray(metadata.categories) ? metadata.categories : [],
  });

  const header = Buffer.from([
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
  ]);
  const data = Buffer.from(payload, 'utf8');
  header.writeUInt32LE(data.length, 14);
  return Buffer.concat([header, data]);
}

async function readInput(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (typeof input !== 'string' || !input.trim()) {
    throw new TypeError('Sticker input must be a Buffer, file path, URL, or SVG string');
  }

  if (input.trimStart().startsWith('<svg')) return Buffer.from(input);
  if (await fs.pathExists(input)) return fs.readFile(input);

  const url = new URL(input);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`Unsupported sticker URL protocol: ${url.protocol}`);
  }

  const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Sticker download failed with HTTP ${response.status}`);
  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_REMOTE_BYTES) throw new Error('Sticker source is larger than 25 MB');
  const data = Buffer.from(await response.arrayBuffer());
  if (data.length > MAX_REMOTE_BYTES) throw new Error('Sticker source is larger than 25 MB');
  return data;
}

async function addMetadata(webp, metadata) {
  const image = new WebpImage();
  await image.load(webp);
  image.exif = buildExif(metadata);
  return image.save(null);
}

/**
 * Small, maintained replacement for wa-sticker-formatter. It uses the project's
 * current Sharp build instead of pulling an obsolete Sharp/axios dependency tree.
 */
export class Sticker {
  constructor(input, metadata = {}) {
    this.input = input;
    this.metadata = { ...metadata };
  }

  setPack(pack) { this.metadata.pack = pack; return this; }
  setAuthor(author) { this.metadata.author = author; return this; }
  setID(id) { this.metadata.id = id; return this; }
  setCategories(categories) { this.metadata.categories = categories; return this; }
  setType(type) { this.metadata.type = type; return this; }
  setQuality(quality) { this.metadata.quality = quality; return this; }
  setBackground(background) { this.metadata.background = background; return this; }

  async build() {
    const input = await readInput(this.input);
    const type = this.metadata.type || StickerTypes.DEFAULT;
    const background = this.metadata.background || TRANSPARENT;

    let pipeline = sharp(input, {
      animated: true,
      failOn: 'error',
      limitInputPixels: 40_000_000,
    });

    if (type === StickerTypes.CROPPED) {
      pipeline = pipeline.resize(512, 512, { fit: 'cover' });
    } else if (type === StickerTypes.CIRCLE || type === StickerTypes.ROUNDED) {
      const shape = type === StickerTypes.CIRCLE
        ? '<circle cx="256" cy="256" r="256" fill="white"/>'
        : '<rect width="512" height="512" rx="50" ry="50" fill="white"/>';
      pipeline = pipeline
        .resize(512, 512, { fit: 'cover' })
        .composite([{
          input: Buffer.from(`<svg width="512" height="512">${shape}</svg>`),
          blend: 'dest-in',
        }]);
    } else {
      pipeline = pipeline.resize(512, 512, {
        fit: 'contain',
        background,
        withoutEnlargement: false,
      });
    }

    const webp = await pipeline
      .webp({ quality: normaliseQuality(this.metadata.quality), effort: 4 })
      .toBuffer();
    return addMetadata(webp, this.metadata);
  }

  async toBuffer() { return this.build(); }

  async toFile(filename) {
    await fs.writeFile(filename, await this.build());
    return filename;
  }
}

export async function createSticker(input, metadata = {}) {
  return new Sticker(input, metadata).toBuffer();
}

export default { Sticker, StickerTypes, createSticker };
