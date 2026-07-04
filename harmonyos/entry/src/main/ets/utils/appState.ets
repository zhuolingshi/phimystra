import { AudioAnalysis, DecodedAudioData } from './audioAnalysis'
import { RPEChart } from '../model/chart'
import { Playstyle } from './difficultyParams'

export class AppState {
  audioName: string = ''
  audioFormat: string = ''
  audioData: Uint8Array = new Uint8Array(0)
  decodedAudio: DecodedAudioData | null = null
  analysis: AudioAnalysis | null = null
  isAnalyzing: boolean = false
  chart: RPEChart | null = null
  difficulty: number = 10
  playstyle: Playstyle = Playstyle.TwoFinger
  songName: string = ''
  composer: string = ''
  charter: string = 'PhiMystra'
  illustrator: string = ''
  backgroundData: Uint8Array | null = null
  isGenerating: boolean = false
  genError: string = ''

  clone(): AppState {
    const s = new AppState()
    Object.assign(s, this)
    return s
  }
}

export const APP_VERSION = '0.1.0'
