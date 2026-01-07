const MULAW_MAX = 0x1fff;
const MULAW_BIAS = 0x84;

function linearToMulaw(sample: number): number {
  const sign = (sample >> 8) & 0x80;
  if (sign !== 0) {
    sample = -sample;
  }

  if (sample > MULAW_MAX) {
    sample = MULAW_MAX;
  }
  sample += MULAW_BIAS;

  // Determine exponent
  let exponent = 7;
  for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; expMask >>= 1) {
    exponent -= 1;
  }

  const mantissa = (sample >> (exponent + 3)) & 0x0f;
  const muLawByte = ~(sign | (exponent << 4) | mantissa);
  return muLawByte & 0xff;
}

export function pcm16ToMulaw(pcm: Buffer): Buffer {
  const frameCount = Math.floor(pcm.length / 2);
  const mulaw = Buffer.alloc(frameCount);

  for (let i = 0; i < frameCount; i += 1) {
    const sample = pcm.readInt16LE(i * 2);
    mulaw[i] = linearToMulaw(sample);
  }

  return mulaw;
}

export function approximateDurationMs(chars: number): number {
  const words = Math.max(1, chars / 5);
  const wordsPerMinute = 180;
  const minutes = words / wordsPerMinute;
  return Math.round(minutes * 60 * 1000);
}
