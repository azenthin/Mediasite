/**
 * generate_sample_audio.js
 *
 * Small helper to write two short WAV files (sine waves) into ./audio/
 * Usage: node scripts/generate_sample_audio.js
 */
const fs = require('fs');
const path = require('path');

function writeWav(filePath, samples, sampleRate = 44100) {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = samples.length * 2; // 16-bit

  const buffer = Buffer.alloc(44 + dataSize);
  let offset = 0;
  buffer.write('RIFF', offset); offset += 4;
  buffer.writeUInt32LE(36 + dataSize, offset); offset += 4;
  buffer.write('WAVE', offset); offset += 4;
  buffer.write('fmt ', offset); offset += 4;
  buffer.writeUInt32LE(16, offset); offset += 4; // subchunk1Size
  buffer.writeUInt16LE(1, offset); offset += 2; // PCM format
  buffer.writeUInt16LE(numChannels, offset); offset += 2;
  buffer.writeUInt32LE(sampleRate, offset); offset += 4;
  buffer.writeUInt32LE(byteRate, offset); offset += 4;
  buffer.writeUInt16LE(blockAlign, offset); offset += 2;
  buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;
  buffer.write('data', offset); offset += 4;
  buffer.writeUInt32LE(dataSize, offset); offset += 4;

  // write samples
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.floor(s * 0x7fff), offset);
    offset += 2;
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
}

function makeSine(freq, durationSec = 1.5, sampleRate = 44100, amplitude = 0.6) {
  const len = Math.floor(durationSec * sampleRate);
  const samples = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    samples[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return samples;
}

function float32ToArray(samples) {
  const out = new Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = samples[i];
  return out;
}

function main() {
  const audioDir = path.resolve(__dirname, '..', 'audio');
  fs.mkdirSync(audioDir, { recursive: true });

  const s1 = makeSine(110, 2.0); // A2-ish
  writeWav(path.join(audioDir, 'sample_a2.wav'), float32ToArray(s1));

  const s2 = makeSine(440, 2.0); // A4
  writeWav(path.join(audioDir, 'sample_a4.wav'), float32ToArray(s2));

  console.log('Generated sample audio files in ./audio: sample_a2.wav, sample_a4.wav');
  console.log('Run your extractor: conda activate mediasite; python ./scripts/extract_audio_features.py');
}

if (require.main === module) main();
