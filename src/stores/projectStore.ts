import { create } from 'zustand'
import type { DecodedAudio } from '../modules/audioImport/audioDecoder'
import type { AudioAnalysis } from '../modules/audioAnalysis'
import type { RPEChart } from '../types/rpe'

interface ProjectState {
  audio: DecodedAudio | null
  analysis: AudioAnalysis | null
  isAnalyzing: boolean
  chart: RPEChart | null
  difficulty: number
  songName: string
  setAudio: (audio: DecodedAudio | null) => void
  setAnalysis: (analysis: AudioAnalysis | null) => void
  setAnalyzing: (v: boolean) => void
  setChart: (chart: RPEChart | null) => void
  setDifficulty: (level: number) => void
  setSongName: (name: string) => void
  reset: () => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  audio: null,
  analysis: null,
  isAnalyzing: false,
  chart: null,
  difficulty: 10,
  songName: '',
  setAudio: (audio) => set({ audio }),
  setAnalysis: (analysis) => set({ analysis }),
  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setChart: (chart) => set({ chart }),
  setDifficulty: (difficulty) => set({ difficulty }),
  setSongName: (songName) => set({ songName }),
  reset: () => set({ audio: null, analysis: null, isAnalyzing: false, chart: null }),
}))
