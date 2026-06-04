const crypto = require('crypto');

const MFA_ISSUER = 'Pentagram';
const TOTP_PERIOD_SECONDS = 30;
const TOTP_WINDOW_STEPS = 1;
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer) {
  let bits = '';
  for (const byte of buffer) {
    bits += byte.toString(2).padStart(8, '0');
  }
  let output = '';
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5);
    if (chunk.length < 5) {
      output += BASE32_ALPHABET[parseInt(chunk.padEnd(5, '0'), 2)];
      break;
    }
    output += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return output;
}

function base32Decode(secret) {
  const normalized = secret.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (const character of normalized) {
    const value = BASE32_ALPHABET.indexOf(character);
    if (value === -1) throw new Error('Invalid MFA secret');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function generateTotpSecret(byteLength = 20) {
  return base32Encode(crypto.randomBytes(byteLength));
}

function generateHotpToken(secret, counter, digits = 6) {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binaryCode = ((hmac[offset] & 0x7f) << 24)
    | (hmac[offset + 1] << 16)
    | (hmac[offset + 2] << 8)
    | hmac[offset + 3];
  return String(binaryCode % (10 ** digits)).padStart(digits, '0');
}

function verifyTotpToken(secret, token, { step = TOTP_PERIOD_SECONDS, window = TOTP_WINDOW_STEPS, digits = 6 } = {}) {
  const cleanToken = String(token).replace(/\s+/g, '');
  const currentCounter = Math.floor(Date.now() / 1000 / step);
  for (let offset = -window; offset <= window; offset += 1) {
    const expectedToken = generateHotpToken(secret, currentCounter + offset, digits);
    if (expectedToken === cleanToken) return true;
  }
  return false;
}

function buildOtpAuthUri(label, secret) {
  return `otpauth://totp/${encodeURIComponent(MFA_ISSUER)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(MFA_ISSUER)}&algorithm=SHA1&digits=6&period=${TOTP_PERIOD_SECONDS}`;
}

module.exports = {
  MFA_ISSUER,
  TOTP_PERIOD_SECONDS,
  TOTP_WINDOW_STEPS,
  BASE32_ALPHABET,
  base32Encode,
  base32Decode,
  generateTotpSecret,
  generateHotpToken,
  verifyTotpToken,
  buildOtpAuthUri
};
