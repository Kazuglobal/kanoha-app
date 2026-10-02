"use client";

/**
 * 学習アプリ用 Web Audio API サウンドマネージャー
 * - 外部音声ファイル不要（ゼロ遅延・オフライン完全対応）
 * - 正解音・はずれたときの優しい音・ヒント音・タップ音
 * - 算数（テンポよく明るい）・国語（おだやかなオルゴール風）のインタラクティブBGM
 * - 子ども・保護者向けの音量・消音（ミュート）切り替え対応
 */

export type BgmType = "math" | "japanese" | "celebrate";

export interface SoundSettings {
  bgmEnabled: boolean;
  seEnabled: boolean;
}

const STORAGE_KEY = "kanoha_sound_settings_v1";

class SoundManager {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private currentBgm: BgmType | null = null;
  private bgmStep = 0;
  private bgmTimer: number | null = null;
  private isBgmPlaying = false;
  private settings: SoundSettings = { bgmEnabled: true, seEnabled: true };

  constructor() {
    if (typeof window !== "undefined") {
      this.loadSettings();
    }
  }

  private loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SoundSettings>;
        if (typeof parsed.bgmEnabled === "boolean") this.settings.bgmEnabled = parsed.bgmEnabled;
        if (typeof parsed.seEnabled === "boolean") this.settings.seEnabled = parsed.seEnabled;
      }
    } catch {
      // ignore
    }
  }

  private saveSettings() {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.settings));
      window.dispatchEvent(
        new CustomEvent("kanoha-sound-change", { detail: this.settings })
      );
    } catch {
      // ignore
    }
  }

  public getSettings(): SoundSettings {
    return { ...this.settings };
  }

  public toggleBgm(): boolean {
    this.settings.bgmEnabled = !this.settings.bgmEnabled;
    this.saveSettings();
    if (!this.settings.bgmEnabled) {
      this.stopBgm();
    } else if (this.currentBgm) {
      this.startBgm(this.currentBgm);
    }
    return this.settings.bgmEnabled;
  }

  public toggleSe(): boolean {
    this.settings.seEnabled = !this.settings.seEnabled;
    this.saveSettings();
    return this.settings.seEnabled;
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  // ========================================================
  // 効果音 (SE)
  // ========================================================

  /** 正解音: チャラララーン！明るく華やかなメジャーチャイム */
  public playCorrect() {
    if (!this.settings.seEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // C5, E5, G5, C6 のキラキラアルペジオ
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0, now + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.48);
    });

    // ベルの高音の倍音
    const bellOsc = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bellOsc.type = "triangle";
    bellOsc.frequency.setValueAtTime(2093.0, now + 0.24); // C7
    bellGain.gain.setValueAtTime(0.08, now + 0.24);
    bellGain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    bellOsc.connect(bellGain);
    bellGain.connect(ctx.destination);
    bellOsc.start(now + 0.24);
    bellOsc.stop(now + 0.68);
  }

  /** はずれたときの音: おしい！優しい木琴風の「ポヨン」（責めない音） */
  public playWrong() {
    if (!this.settings.seEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // 2音の柔らかいスライド（F4 → D4）
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(349.23, now); // F4
    osc.frequency.exponentialRampToValueAtTime(261.63, now + 0.28); // C4へやさしく下がる

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);

    // 2音目のぽふっ
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(220.0, now + 0.16); // A3
    gain2.gain.setValueAtTime(0, now + 0.16);
    gain2.gain.linearRampToValueAtTime(0.12, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.16);
    osc2.stop(now + 0.45);
  }

  /** ヒント音: ピロリン♪ ひらめきのベル */
  public playHint() {
    if (!this.settings.seEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [783.99, 987.77, 1174.66]; // G5, B5, D6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      gain.gain.setValueAtTime(0, now + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.38);
    });
  }

  /** タップ・着せ替え音: ぽっ♪ */
  public playTap() {
    if (!this.settings.seEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(659.25, now); // E5
    osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.06); // A5
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  /** 達成・レベルアップファンファーレ */
  public playCelebrate() {
    if (!this.settings.seEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const melody = [
      { freq: 523.25, time: 0, dur: 0.12 }, // C5
      { freq: 659.25, time: 0.12, dur: 0.12 }, // E5
      { freq: 783.99, time: 0.24, dur: 0.14 }, // G5
      { freq: 1046.5, time: 0.38, dur: 0.35 }, // C6
      { freq: 880.0, time: 0.75, dur: 0.14 }, // A5
      { freq: 1046.5, time: 0.9, dur: 0.55 }, // C6
    ];

    melody.forEach(({ freq, time, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + time);
      gain.gain.setValueAtTime(0, now + time);
      gain.gain.linearRampToValueAtTime(0.18, now + time + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + time);
      osc.stop(now + time + dur + 0.05);
    });
  }

  // ========================================================
  // BGM (問題・教科に応じたバックグラウンドミュージック)
  // ========================================================

  /**
   * BGMの開始
   * - 'math': ピコピコ軽快でテンポのよい知育ステップ
   * - 'japanese': おだやかで落ち着いた言葉のオルゴール調
   * - 'celebrate': 達成感のあるハッピーワルツ
   */
  public startBgm(type: BgmType) {
    this.currentBgm = type;
    if (!this.settings.bgmEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    if (this.isBgmPlaying) {
      this.stopBgm();
    }
    this.isBgmPlaying = true;
    this.bgmStep = 0;

    // マスターBGMゲイン
    this.bgmGain = ctx.createGain();
    this.bgmGain.gain.setValueAtTime(0.038, ctx.currentTime); // 勉強を邪魔しない優しい音量
    this.bgmGain.connect(ctx.destination);

    // 算数用メロディパターン (8ステップループ: ド・レ・ミ・ソ・ラ)
    const mathNotes = [523.25, 587.33, 659.25, 783.99, 659.25, 783.99, 880.0, 783.99];
    // 国語用メロディパターン (12ステップゆったりループ: レ・ファ・ソ・ラ・ド)
    const japaneseNotes = [587.33, 0, 698.46, 783.99, 0, 880.0, 1046.5, 0, 880.0, 783.99, 698.46, 587.33];
    // 達成用メロディパターン (6ステップ)
    const celebrateNotes = [523.25, 659.25, 783.99, 1046.5, 880.0, 1046.5];

    const stepInterval = type === "japanese" ? 420 : type === "math" ? 300 : 260;

    const playNextNote = () => {
      if (!this.isBgmPlaying || !this.ctx || !this.bgmGain) return;

      const notes =
        type === "japanese"
          ? japaneseNotes
          : type === "celebrate"
          ? celebrateNotes
          : mathNotes;

      const freq = notes[this.bgmStep % notes.length];
      this.bgmStep += 1;

      if (freq > 0) {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();

        // 算数はピコピコ感（パルス/矩形風サイン）、国語は柔らかいサイン波
        osc.type = type === "math" ? "sine" : "sine";
        osc.frequency.setValueAtTime(freq, now);

        const dur = type === "japanese" ? 0.36 : 0.22;
        noteGain.gain.setValueAtTime(0, now);
        noteGain.gain.linearRampToValueAtTime(1, now + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        osc.connect(noteGain);
        noteGain.connect(this.bgmGain);

        osc.start(now);
        osc.stop(now + dur + 0.05);

        // 国語の場合はオルゴール風のふんわり高音倍音をうっすら重ねる
        if (type === "japanese") {
          const oscHarmonic = this.ctx.createOscillator();
          const harmGain = this.ctx.createGain();
          oscHarmonic.type = "triangle";
          oscHarmonic.frequency.setValueAtTime(freq * 2, now);
          harmGain.gain.setValueAtTime(0.18, now);
          harmGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
          oscHarmonic.connect(harmGain);
          harmGain.connect(this.bgmGain);
          oscHarmonic.start(now);
          oscHarmonic.stop(now + 0.3);
        }
      }

      this.bgmTimer = window.setTimeout(playNextNote, stepInterval);
    };

    playNextNote();
  }

  public stopBgm() {
    this.isBgmPlaying = false;
    if (this.bgmTimer !== null) {
      clearTimeout(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (this.bgmGain && this.ctx) {
      try {
        this.bgmGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      } catch {
        // ignore
      }
    }
  }
}

// シングルトンインスタンス
export const soundManager = new SoundManager();
