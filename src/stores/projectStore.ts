import { create } from 'zustand'
import type { DecodedAudio } from '../modules/audioImport/audioDecoder'
import type { AudioAnalysis } from '../modules/audioAnalysis'

interface ProjectState {
  audio: DecodedAudio | null
  analysis: AudioAnalysis | null
  isAnalyzing: boolean
  setAudio: (audio: DecodedAudio | null) => void
  setAnalysis: (analysis: AudioAnalysis | null) => void
  setAnalyzing: (v: boolean) => void
  reset: () => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  audio: null, analysis: null, isAnalyzing: false,
  setAudio: (audio) => set({ audio }),
  setAnalysis: (analysis) => set({ analysis }),
  setAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  reset: () => set({ audio: null, analysis: null, isAnalyzing: false }),
}))
