import { logger } from './logger.js';

let _cached = null;
let _lastGen = 0;
const TTL = 6 * 60 * 60 * 1000; // regenerate every 6 hours

export async function getPoTokenArgs() {
  try {
    if (!_cached || Date.now() - _lastGen > TTL) {
      const { generate } = await import('youtube-po-token-generator');
      _cached = await generate();
      _lastGen = Date.now();
      logger.info('🔑 YouTube PO token refreshed');
    }
    if (_cached?.visitorData && _cached?.poToken) {
      return `--extractor-args "youtube:visitor_data=${_cached.visitorData};po_token=${_cached.poToken}"`;
    }
  } catch (e) {
    logger.warn({ err: e.message }, '⚠️ PO token generation failed — yt-dlp will run without it');
  }
  return '';
}
