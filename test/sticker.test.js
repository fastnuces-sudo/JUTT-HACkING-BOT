import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import webpMux from 'node-webpmux';
import { Sticker, StickerTypes } from '../lib/sticker.js';

test('sticker conversion creates a 512px WebP with WhatsApp metadata', async () => {
  const input = await sharp({
    create: { width: 40, height: 20, channels: 4, background: '#ff3366' },
  }).png().toBuffer();

  const output = await new Sticker(input, {
    pack: 'Jutts Test Pack',
    author: 'Test Runner',
    categories: ['✅'],
    type: StickerTypes.FULL,
    quality: 80,
  }).toBuffer();

  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width, 512);
  assert.equal(metadata.height, 512);

  const image = new webpMux.Image();
  await image.load(output);
  const exif = image.exif.toString('utf8');
  assert.match(exif, /Jutts Test Pack/);
  assert.match(exif, /Test Runner/);
});
