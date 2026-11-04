/** 親の設定(app_settings)のうち、えいごで おはなしに関わるもの。渡さないときは両方オン。 */
export interface TalkSettings {
  /** false なら読み上げの音声 API を呼ばない */
  enableAudio?: boolean;
  /** false ならマイクを出さず、4択だけで答える */
  enableVoiceAnswer?: boolean;
}
