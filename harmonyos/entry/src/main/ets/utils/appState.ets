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
    s.audioName = this.audioName
    s.audioFormat = this.audioFormat
    s.audioData = this.audioData
    s.decodedAudio = this.decodedAudio
    s.analysis = this.analysis
    s.isAnalyzing = this.isAnalyzing
    s.chart = this.chart
    s.difficulty = this.difficulty
    s.playstyle = this.playstyle
    s.songName = this.songName
    s.composer = this.composer
    s.charter = this.charter
    s.illustrator = this.illustrator
    s.backgroundData = this.backgroundData
    s.isGenerating = this.isGenerating
    s.genError = this.genError
    return s
  }
}

export const APP_VERSION = '0.1.0'
