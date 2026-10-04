import { describe, expect, it } from "vitest";
import { boostPcmVolume, boostWavOrPcm } from "@/lib/ai/tts";

describe("boostPcmVolume", () => {
  it("amplifies low-volume 16-bit PCM samples cleanly without clipping", () => {
    // 16-bit samples: 1000, -2000, 5000 (peak = 5000)
    const buf = Buffer.alloc(6);
    buf.writeInt16LE(1000, 0);
    buf.writeInt16LE(-2000, 2);
    buf.writeInt16LE(5000, 4);

    // Boost with targetPeak = 25000 (gain = 5.0, clamped by maxGain = 2.5)
    const boosted = boostPcmVolume(buf, 25000, 2.5);

    expect(boosted.readInt16LE(0)).toBe(2500); // 1000 * 2.5
    expect(boosted.readInt16LE(2)).toBe(-5000); // -2000 * 2.5
    expect(boosted.readInt16LE(4)).toBe(12500); // 5000 * 2.5
  });

  it("safely clamps values to prevent 16-bit integer overflow", () => {
    const buf = Buffer.alloc(4);
    buf.writeInt16LE(20000, 0);
    buf.writeInt16LE(-25000, 2);

    // Boost with targetPeak = 28000
    const boosted = boostPcmVolume(buf, 28000, 2.5);

    // Peak is 25000, gain is 28000 / 25000 = 1.12
    const sample0 = boosted.readInt16LE(0);
    const sample1 = boosted.readInt16LE(2);

    expect(sample0).toBeLessThanOrEqual(32767);
    expect(sample1).toBeGreaterThanOrEqual(-32768);
  });

  it("leaves empty or already loud buffers untouched", () => {
    const empty = Buffer.alloc(0);
    expect(boostPcmVolume(empty)).toBe(empty);

    const loud = Buffer.alloc(2);
    loud.writeInt16LE(30000, 0);
    // targetPeak 28000 < 30000, gain <= 1.05 -> should not alter
    const result = boostPcmVolume(loud, 28000);
    expect(result.readInt16LE(0)).toBe(30000);
  });
});

describe("boostWavOrPcm", () => {
  it("identifies standard WAV RIFF header and boosts the data chunk payload", () => {
    // Construct minimal WAV with 44-byte header and 4 bytes PCM
    const header = Buffer.alloc(44);
    header.write("RIFF", 0);
    header.writeUInt32LE(36 + 4, 4);
    header.write("WAVE", 8);
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20); // PCM
    header.writeUInt16LE(1, 22); // mono
    header.writeUInt32LE(24000, 24);
    header.writeUInt32LE(48000, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write("data", 36);
    header.writeUInt32LE(4, 40);

    const pcm = Buffer.alloc(4);
    pcm.writeInt16LE(2000, 0);
    pcm.writeInt16LE(-3000, 2);

    const fullWav = Buffer.concat([header, pcm]);
    const boostedWav = boostWavOrPcm(fullWav, 24000, 2.0);

    expect(boostedWav.toString("ascii", 0, 4)).toBe("RIFF");
    expect(boostedWav.toString("ascii", 36, 40)).toBe("data");
    // pcm peak was 3000, target 24000 -> gain clamped to maxGain 2.0
    expect(boostedWav.readInt16LE(44)).toBe(4000);
    expect(boostedWav.readInt16LE(46)).toBe(-6000);
  });
});
