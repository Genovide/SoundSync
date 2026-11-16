// Выравнивание громкости: разбор итога ffmpeg ebur128 и настоящий замер короткого сигнала.
const assert = require('node:assert/strict');
const { parseIntegrated } = require('../app/loudness.cjs');

const summary = (i, peak) =>
  `[Parsed_ebur128_0 @ 0x1] Summary:\n\n  Integrated loudness:\n    I:         ${i} LUFS\n    Threshold: -41.8 LUFS\n\n  Loudness range:\n    LRA:         0.0 LU\n\n  True peak:\n    Peak:      ${peak} dBFS\n`;

assert.deepEqual(parseIntegrated(summary('-8.0', '-7.1')), { lufs: -8, peak: -7.1 });
assert.deepEqual(parseIntegrated(summary('-23.5', '-inf')), { lufs: -23.5, peak: null });
assert.equal(parseIntegrated(summary('-70.0', '-80')), null, 'silence is not a loudness');
assert.equal(parseIntegrated('no summary here'), null);
// Берётся последний итог, а не промежуточные строки.
assert.deepEqual(parseIntegrated('I: -99 LUFS\n' + summary('-30.2', '-29')).lufs, -30.2);
console.log('Loudness summary parsing passed');
