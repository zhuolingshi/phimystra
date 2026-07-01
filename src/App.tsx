import { useState } from 'react'
import { AudioImporter } from './components/AudioImporter'
import { OnsetViewer } from './components/OnsetViewer'
import { DifficultySelector } from './components/DifficultySelector'
import { ChartPreview } from './components/ChartPreview'
import { ChartPlayer } from './components/ChartPlayer'
import { useProjectStore } from './stores/projectStore'
import { analyzeAudio } from './modules/audioAnalysis'
import { generateChart } from './modules/chartEngine'
import { exportPez, downloadPez, encodeAudioBufferToWav } from './modules/pezExporter'

export default function App() {
  const {
    audio, analysis, isAnalyzing, chart,
    setAnalysis, setAnalyzing, setChart, reset,
    difficulty, songName, setSongName,
  } = useProjectStore()

  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

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

  const handleGenerate = () => {
    if (!analysis) return
    setGenerating(true)
    setGenError(null)
    try {
      const result = generateChart({
        analysis,
        difficultyLevel: difficulty,
        songName: songName || audio?.name?.replace(/\.[^.]+$/, '') || '未命名',
        composer: '未知',
        charter: 'AI 制谱器',
      })
      if (result.validationErrors.length > 0) {
        setGenError(`警告: ${result.validationErrors.join(', ')}`)
      }
      setChart(result.chart)
    } catch (err) {
      setGenError(`生成失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = () => {
    if (!chart || !audio) return
    setExporting(true)
    try {
      const wavData = encodeAudioBufferToWav(audio.audioBuffer)
      const result = exportPez({
        chart,
        audioData: wavData,
        audioFormat: 'wav',
        filename: `${chart.META.name || 'chart'}.pez`,
      })
      downloadPez(result)
    } catch (err) {
      console.error('导出失败:', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div style={{
      backgroundColor: '#0f0f1e', minHeight: '100vh', color: '#eee',
      padding: '24px', fontFamily: 'system-ui, sans-serif',
    }}>
      <h1 style={{ marginBottom: '24px' }}>🎵 AI 音游制谱器</h1>

      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex',
        flexDirection: 'column', gap: '20px' }}>

        {/* Step 1: 导入音频 */}
        <AudioImporter />

        {/* Step 2: 分析节奏 */}
        {audio && !analysis && (
          <button onClick={handleAnalyze} disabled={isAnalyzing}
            style={buttonStyle(isAnalyzing)}>
            {isAnalyzing ? '正在分析...' : '🔍 分析节奏'}
          </button>
        )}
        {isAnalyzing && <p style={{ textAlign: 'center', opacity: 0.7 }}>正在检测节奏点和频段信息...</p>}
        {analysis && <OnsetViewer />}

        {/* Step 3: 选择难度 + 输入曲名 */}
        {analysis && !chart && (
          <>
            <input
              type="text"
              placeholder="输入曲名（可选）"
              value={songName}
              onChange={(e) => setSongName(e.target.value)}
              style={{
                padding: '10px 14px', borderRadius: '8px',
                border: '1px solid #444', backgroundColor: '#1a1a2e', color: '#eee',
                fontSize: '15px',
              }}
            />
            <DifficultySelector />
            <button onClick={handleGenerate} disabled={generating}
              style={buttonStyle(generating, '#4caf50')}>
              {generating ? '正在生成...' : '🎼 生成谱面'}
            </button>
          </>
        )}

        {genError && <p style={{ color: '#ff9800' }}>{genError}</p>}

        {/* Step 4: 预览 + 导出 */}
        {chart && audio && (
          <>
            <ChartPlayer />
            <ChartPreview />
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={handleExport} disabled={exporting}
                style={buttonStyle(exporting, '#ff9800')}>
                {exporting ? '正在导出...' : '📥 导出 .pez 谱面包'}
              </button>
              <button onClick={() => setChart(null)}
                style={buttonStyle(false, '#333', '#ccc', '#555')}>
                ⚙️ 重新生成
              </button>
              <button onClick={reset}
                style={buttonStyle(false, '#333', '#ccc', '#555')}>
                🔄 重新开始
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function buttonStyle(
  disabled: boolean,
  bg: string = '#5c6bc0',
  color: string = 'white',
  border: string = 'none'
): React.CSSProperties {
  return {
    padding: '12px 24px', fontSize: '16px', cursor: disabled ? 'wait' : 'pointer',
    backgroundColor: disabled ? '#333' : bg, color: disabled ? '#666' : color,
    border: `1px solid ${border}`, borderRadius: '8px',
    opacity: disabled ? 0.7 : 1, flex: 1,
  }
}
