// Generates the hazard warning beep for Site Zones.
// Run: node tools/sfx/gen_beep.js
// Writes Assets/GeneratedSFX/WarningBeep.wav (44.1 kHz, 16-bit mono).
// One loop of the file is two short beeps and a gap, so looping it gives a steady alarm.
const fs = require("fs");
const path = require("path");

const RATE = 44100;
const OUT_DIR = path.resolve(__dirname, "..", "..", "Assets", "GeneratedSFX");
const OUT = path.join(OUT_DIR, "WarningBeep.wav");

const BEEP_S = 0.14; // length of each beep
const GAP_S = 0.09; // gap between the two beeps
const REST_S = 0.38; // silence before the loop repeats
const EDGE_S = 0.004; // fade in and out, so the beep doesn't click

function beep(samples, startS) {
  const n = Math.floor(BEEP_S * RATE);
  const start = Math.floor(startS * RATE);
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    // 2.9 kHz is where small speakers are loudest and hearing is most sensitive.
    // The lower partial keeps it audible over machinery.
    let v = 0.62 * Math.sin(2 * Math.PI * 2900 * t) + 0.3 * Math.sin(2 * Math.PI * 1450 * t);
    v = Math.tanh(v * 1.8); // soft clip: louder without harsh aliasing
    const edge = Math.min(1, t / EDGE_S, (BEEP_S - t) / EDGE_S);
    samples[start + i] = v * edge * 0.9;
  }
}

const total = Math.floor((BEEP_S * 2 + GAP_S + REST_S) * RATE);
const samples = new Float32Array(total);
beep(samples, 0);
beep(samples, BEEP_S + GAP_S);

const data = Buffer.alloc(total * 2);
for (let i = 0; i < total; i++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), i * 2);
}
const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + data.length, 4);
header.write("WAVEfmt ", 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20); // PCM
header.writeUInt16LE(1, 22); // mono
header.writeUInt32LE(RATE, 24);
header.writeUInt32LE(RATE * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(data.length, 40);

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, Buffer.concat([header, data]));
console.log("wrote", OUT, data.length + 44, "bytes");
