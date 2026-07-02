import { create } from 'zustand'
import type { DecodedAudio } from '../modules/audioImport/audioDecoder'
import type { AudioAnalysis } from '../modules/audioAnalysis'
import type { RPEChart } from '../types/rpe'

export type Playstyle = 'two-finger' | 'multi-finger'

interface ProjectState {
  audio: DecodedAudio | null
  analysis: AudioAnalysis | null
  isAnalyzing: boolean
  chart: RPEChart | null
  difficulty: number
  playstyle: Playstyle
  songName: string
  composer: string
  charter: string
  illustrator: string
  exportPath: string
  backgroundData: Uint8Array | null
  setBackgroundData: (v: Uint8Array | null) => void
  setAudio: (audio: DecodedAudio | null) => void
  setAnalysis: (analysis: AudioAnalysis | null) => void
  setAnalyzing: (v: boolean) => void
  setChart: (chart: RPEChart | null) => void
  setDifficulty: (level: number) => void
  setPlaystyle: (v: Playstyle) => void
  setSongName: (name: string) => void
  setComposer: (v: string) => void
  setCharter: (v: string) => void
  setIllustrator: (v: string) => void
  setExportPath: (v: string) => void
  reset: () => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  audio: null,
  analysis: null,
  isAnalyzing: false,
  chart: null,
  difficulty: 10,
  playstyle: 'two-finger',
  songName: '',
  composer: '',
  charter: 'PhiMystra',
  illustrator: '',
  exportPath: '',
  backgroundData: null,
  setAudio: (audio) => set({ audio }),
  setAnalysis: (analysis) => set({ analysis }),
  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setChart: (chart) => set({ chart }),
  setDifficulty: (difficulty) => set({ difficulty }),
  setPlaystyle: (playstyle) => set({ playstyle }),
  setSongName: (songName) => set({ songName }),
  setComposer: (composer) => set({ composer }),
  setCharter: (charter) => set({ charter }),
  setIllustrator: (illustrator) => set({ illustrator }),
  setExportPath: (exportPath) => set({ exportPath }),
  setBackgroundData: (backgroundData) => set({ backgroundData }),
  reset: () => set({ audio: null, analysis: null, isAnalyzing: false, chart: null }),
}))
