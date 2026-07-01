import { AudioImporter } from './components/AudioImporter'
import { OnsetViewer } from './components/OnsetViewer'
import { useProjectStore } from './stores/projectStore'
import { analyzeAudio } from './modules/audioAnalysis'

export default function App() {
  const { audio, analysis, isAnalyzing, setAnalysis, setAnalyzing, reset } = useProjectStore()

  const handleAnalyze = async () => {
    if (!audio) return
    setAnalyzing(true)
    try {
      const result = await analyzeAudio(audio.audioBuffer)
      setAnalysis(result)
    } catch (err) {
      console.error('分析失败:', err)
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div style={{
      backgroundColor: '#0f0f1e', minHeight: '100vh', color: '#eee',
      padding: '24px', fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ marginBottom: '24px' }}>🎵 AI 音游制谱器</h1>

      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex',
        flexDirection: 'column', gap: '24px' }}>

        <AudioImporter />

        {audio && !analysis && (
          <button onClick={handleAnalyze} disabled={isAnalyzing}
            style={{
              padding: '12px 24px', fontSize: '16px', cursor: 'pointer',
              backgroundColor: '#5c6bc0', color: 'white', border: 'none',
              borderRadius: '8px',
            }}>
            {isAnalyzing ? '正在分析...' : '🔍 分析节奏'}
          </button>
        )}

        {isAnalyzing && (
          <p style={{ textAlign: 'center', opacity: 0.7 }}>正在检测节奏点...</p>
        )}

        {analysis && <OnsetViewer />}

        {analysis && (
          <button onClick={reset}
            style={{
              padding: '8px 16px', cursor: 'pointer',
              backgroundColor: '#333', color: '#ccc', border: '1px solid #555',
              borderRadius: '6px',
            }}>
            重新开始
          </button>
        )}
      </div>
    </div>
  )
}
