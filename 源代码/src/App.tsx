import { useState, useEffect } from 'react'
import { save, message, open } from '@tauri-apps/plugin-dialog'
import { writeFile, readFile } from '@tauri-apps/plugin-fs'
import { AudioImporter } from './components/AudioImporter'
import { OnsetViewer } from './components/OnsetViewer'
import { DifficultySelector } from './components/DifficultySelector'
import { ChartPreview } from './components/ChartPreview'
import { ChartPlayer } from './components/ChartPlayer'
import { useProjectStore } from './stores/projectStore'
import { analyzeAudio } from './modules/audioAnalysis'
import { generateChart } from './modules/chartEngine'
import { exportPez, encodeAudioBufferToWav } from './modules/pezExporter'
import { checkForUpdate, getAppVersion, type UpdateInfo } from './modules/updater'
import { openUrl } from '@tauri-apps/plugin-opener'

export default function App() {
  const {
    audio, analysis, isAnalyzing, chart,
    setAnalysis, setAnalyzing, setChart, reset,
    difficulty, songName, setSongName,
    playstyle, setPlaystyle,
    composer, setComposer, charter, setCharter,
    illustrator, setIllustrator,
    backgroundData, setBackgroundData,
  } = useProjectStore()

  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportMsg, setExportMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [startupUpdate, setStartupUpdate] = useState<UpdateInfo | null>(null)

  // 启动时自动检查更新
  useEffect(() => {
    checkForUpdate().then(info => {
      if (info.hasUpdate) setStartupUpdate(info)
    }).catch(() => {})
  }, [])

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true)
    try {
      const info = await checkForUpdate()
      setUpdateInfo(info)
    } finally {
      setCheckingUpdate(false)
    }
  }

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
    setExportMsg(null)
    try {
      const result = generateChart({
        analysis,
        difficultyLevel: difficulty,
        playstyle,
        songName: songName || audio?.name?.replace(/\.[^.]+$/, '') || '未命名',
        composer: composer || '未知',
        charter: charter || 'PhiMystra',
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

  // 同步编辑信息到 chart 的 META
  const syncMetaToChart = () => {
    if (!chart) return
    setChart({
      ...chart,
      META: {
        ...chart.META,
        name: songName || chart.META.name,
        composer: composer || chart.META.composer,
        charter: charter || chart.META.charter,
      },
    })
  }

  const handleExport = async () => {
    if (!chart || !audio) return
    setExporting(true)
    setExportMsg(null)
    try {
      // 先同步编辑的信息到 chart
      syncMetaToChart()
      const chartToExport = {
        ...chart,
        META: {
          ...chart.META,
          name: songName || chart.META.name,
          composer: composer || chart.META.composer,
          charter: charter || chart.META.charter,
        },
      }

      let audioData: Uint8Array
      let audioFormat: 'wav' | 'mp3' | 'ogg'
      if (audio.originalData && audio.originalFormat && audio.originalFormat !== 'wav') {
        audioData = new Uint8Array(audio.originalData)
        audioFormat = audio.originalFormat as 'mp3' | 'ogg'
      } else {
        audioData = encodeAudioBufferToWav(audio.audioBuffer)
        audioFormat = 'wav'
      }
      const result = exportPez({
        chart: chartToExport,
        audioData,
        audioFormat,
        coverData: backgroundData ?? undefined,
        filename: `${chartToExport.META.name || 'chart'}.zip`,
      })

      // 弹出保存对话框选择路径
      const defaultName = `${chartToExport.META.name || 'chart'}.zip`
      const savePath = await save({
        defaultPath: defaultName,
        filters: [{ name: '谱面包', extensions: ['zip'] }],
      })

      if (savePath) {
        // 用 Tauri fs 写入文件
        await writeFile(savePath, result.data)
        setExportMsg({ ok: true, text: `导出成功！已保存到：${savePath}（${(result.size / 1024).toFixed(0)} KB）` })
      } else {
        // 用户取消，用浏览器下载兜底
        downloadBlob(result.data, result.filename)
        setExportMsg({ ok: true, text: `已下载：${result.filename}（${(result.size / 1024).toFixed(0)} KB）` })
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setExportMsg({ ok: false, text: `导出失败：${errMsg}` })
      try { await message(`导出失败：${errMsg}`, { title: '错误', kind: 'error' }) } catch {}
    } finally {
      setExporting(false)
    }
  }

  const handleImportBackground = async () => {
    try {
      const selected = await open({
        filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp'] }],
        multiple: false,
      })
      if (typeof selected === 'string') {
        const data = await readFile(selected)
        setBackgroundData(new Uint8Array(data))
      }
    } catch (err) {
      console.error('导入背景失败:', err)
    }
  }

  const bpm = analysis?.bpm ?? chart?.BPMList?.[0]?.bpm ?? '—'
  const lineCount = chart?.judgeLineList?.length ?? '—'
  const noteCount = chart?.judgeLineList?.reduce((s, l) => s + (l.numOfNotes || 0), 0) ?? '—'

  return (
    <div style={{
      backgroundColor: '#0f0f1e', minHeight: '100vh', color: '#eee',
      padding: '24px', fontFamily: 'system-ui, sans-serif',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1>🎵 音律魔女</h1>
        <button onClick={() => setShowSettings(!showSettings)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#ccc' }}>
          ⚙️
        </button>
      </div>
      {showSettings && (
        <SettingsPanel
          version={getAppVersion()}
          updateInfo={updateInfo}
          checking={checkingUpdate}
          onCheck={handleCheckUpdate}
          onClose={() => setShowSettings(false)}
        />
      )}

      {startupUpdate && (
        <UpdatePopup info={startupUpdate} onClose={() => setStartupUpdate(null)} />
      )}

      <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex',
        flexDirection: 'column', gap: '20px' }}>

        <AudioImporter />

        {audio && !analysis && (
          <button onClick={handleAnalyze} disabled={isAnalyzing}
            style={buttonStyle(isAnalyzing)}>
            {isAnalyzing ? '正在分析...' : '🔍 分析节奏'}
          </button>
        )}
        {isAnalyzing && <p style={{ textAlign: 'center', opacity: 0.7 }}>正在检测节奏点和频段信息...</p>}
        {analysis && <OnsetViewer />}

        {/* Step 3: 生成前 — 信息编辑 + 难度 */}
        {analysis && !chart && (
          <>
            <ChartInfoEditor
              songName={songName} setSongName={setSongName}
              composer={composer} setComposer={setComposer}
              charter={charter} setCharter={setCharter}
              illustrator={illustrator} setIllustrator={setIllustrator}
              bpm={bpm} lineCount={lineCount} noteCount={noteCount}
            />
            <PlaystyleSelector value={playstyle} onChange={setPlaystyle} />
            <DifficultySelector />
            <BackgroundImporter onImport={handleImportBackground} hasBackground={!!backgroundData} onClear={() => setBackgroundData(null)} />
            <button onClick={handleGenerate} disabled={generating}
              style={buttonStyle(generating, '#4caf50')}>
              {generating ? '正在生成...' : '🎼 生成谱面'}
            </button>
          </>
        )}

        {genError && <p style={{ color: '#ff9800' }}>{genError}</p>}

        {/* Step 4: 生成后 — 可继续编辑信息 + 预览 + 导出 */}
        {chart && audio && (
          <>
            <ChartInfoEditor
              songName={songName} setSongName={setSongName}
              composer={composer} setComposer={setComposer}
              charter={charter} setCharter={setCharter}
              illustrator={illustrator} setIllustrator={setIllustrator}
              bpm={bpm} lineCount={lineCount} noteCount={noteCount}
            />
            <BackgroundImporter onImport={handleImportBackground} hasBackground={!!backgroundData} onClear={() => setBackgroundData(null)} />
            <ChartPlayer />
            <ChartPreview />

            {exportMsg && (
              <div style={{
                padding: '12px 16px', borderRadius: '8px',
                backgroundColor: exportMsg.ok ? 'rgba(76,175,80,0.15)' : 'rgba(244,67,54,0.15)',
                border: `1px solid ${exportMsg.ok ? '#4caf50' : '#f44336'}`,
                color: exportMsg.ok ? '#81c784' : '#ef9a9a',
                fontSize: '14px', wordBreak: 'break-all',
              }}>
                {exportMsg.ok ? '✅ ' : '❌ '}{exportMsg.text}
              </div>
            )}

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

// 背景导入器
function BackgroundImporter(props: { onImport: () => void; hasBackground: boolean; onClear: () => void }) {
  return (
    <div style={{ padding: '12px 16px', backgroundColor: '#1a1a2e', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ color: '#ccc', fontSize: '14px' }}>
        {props.hasBackground ? '✅ 已导入自定义背景' : '🖼️ 背景图片（不导入则使用默认）'}
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        {props.hasBackground && (
          <button onClick={props.onClear}
            style={{ padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', border: '1px solid #555', backgroundColor: '#333', color: '#ccc', fontSize: '13px' }}>
            清除
          </button>
        )}
        <button onClick={props.onImport}
          style={{ padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', border: '1px solid #5c6bc0', backgroundColor: '#252548', color: '#fff', fontSize: '13px' }}>
          {props.hasBackground ? '更换' : '导入背景'}
        </button>
      </div>
    </div>
  )
}

// 玩法选择器
function PlaystyleSelector(props: { value: string; onChange: (v: any) => void }) {
  const options = [
    { value: 'two-finger', label: '👆 两指', desc: '双手双指，适合手机' },
    { value: 'multi-finger', label: '✋ 多指', desc: '多指并发，适合平板' },
  ]
  return (
    <div style={{ padding: '16px', backgroundColor: '#1a1a2e', borderRadius: '12px' }}>
      <div style={{ marginBottom: '12px', color: '#ccc' }}>玩法选择</div>
      <div style={{ display: 'flex', gap: '12px' }}>
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => props.onChange(opt.value)}
            style={{
              flex: 1, padding: '14px', borderRadius: '8px', cursor: 'pointer',
              border: props.value === opt.value ? '2px solid #5c6bc0' : '2px solid #333',
              backgroundColor: props.value === opt.value ? '#252548' : '#12121f',
              color: props.value === opt.value ? '#fff' : '#888',
              fontSize: '16px', transition: 'all 0.2s',
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>{opt.label}</div>
            <div style={{ fontSize: '12px', opacity: 0.7 }}>{opt.desc}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// 可复用的谱面信息编辑组件
function ChartInfoEditor(props: {
  songName: string; setSongName: (v: string) => void
  composer: string; setComposer: (v: string) => void
  charter: string; setCharter: (v: string) => void
  illustrator: string; setIllustrator: (v: string) => void
  bpm: number | string; lineCount: number | string; noteCount: number | string
}) {
  return (
    <div style={{ display: 'flex', gap: '16px' }}>
      {/* 左栏：可编辑 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input type="text" placeholder="曲名" value={props.songName}
          onChange={(e) => props.setSongName(e.target.value)} style={inputStyle} />
        <input type="text" placeholder="曲师" value={props.composer}
          onChange={(e) => props.setComposer(e.target.value)} style={inputStyle} />
        <input type="text" placeholder="谱师" value={props.charter}
          onChange={(e) => props.setCharter(e.target.value)} style={inputStyle} />
        <input type="text" placeholder="画师" value={props.illustrator}
          onChange={(e) => props.setIllustrator(e.target.value)} style={inputStyle} />
      </div>
      {/* 右栏：只读 */}
      <div style={{
        width: '180px', backgroundColor: '#1a1a2e', borderRadius: '8px',
        padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px',
      }}>
        <div style={infoItemStyle}>
          <span style={infoLabelStyle}>BPM</span>
          <span style={infoValueStyle}>{props.bpm}</span>
        </div>
        <div style={infoItemStyle}>
          <span style={infoLabelStyle}>判定线</span>
          <span style={infoValueStyle}>{props.lineCount} 条</span>
        </div>
        <div style={infoItemStyle}>
          <span style={infoLabelStyle}>音符数</span>
          <span style={infoValueStyle}>{props.noteCount}</span>
        </div>
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '10px 14px', borderRadius: '8px',
  border: '1px solid #444', backgroundColor: '#1a1a2e', color: '#eee',
  fontSize: '15px',
}

const infoItemStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
}
const infoLabelStyle: React.CSSProperties = { opacity: 0.6, fontSize: '13px' }
const infoValueStyle: React.CSSProperties = { fontWeight: 'bold', fontSize: '15px' }

function buttonStyle(
  disabled: boolean, bg: string = '#5c6bc0',
  color: string = 'white', border: string = 'none'
): React.CSSProperties {
  return {
    padding: '12px 24px', fontSize: '16px', cursor: disabled ? 'wait' : 'pointer',
    backgroundColor: disabled ? '#333' : bg, color: disabled ? '#666' : color,
    border: `1px solid ${border}`, borderRadius: '8px',
    opacity: disabled ? 0.7 : 1, flex: 1,
  }
}

// 启动更新弹窗
function UpdatePopup(props: { info: UpdateInfo; onClose: () => void }) {
  const { info } = props
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex',
      alignItems: 'center', justifyContent: 'center',
    }} onClick={props.onClose}>
      <div style={{
        backgroundColor: '#1a1a2e', borderRadius: '16px', padding: '28px',
        boxShadow: '0 12px 48px rgba(0,0,0,0.6)', border: '1px solid #333',
        maxWidth: '400px', width: '90%',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: '22px', fontWeight: 'bold', marginBottom: '12px', textAlign: 'center' }}>
          🎉 发现新版本
        </div>
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <span style={{ color: '#888' }}>v{info.currentVersion}</span>
          <span style={{ margin: '0 8px', color: '#555' }}>→</span>
          <span style={{ color: '#4caf50', fontSize: '18px', fontWeight: 'bold' }}>v{info.latestVersion}</span>
        </div>
        {info.note && (
          <div style={{
            color: '#aaa', fontSize: '14px', marginBottom: '20px',
            whiteSpace: 'pre-wrap', textAlign: 'center', lineHeight: 1.6,
            backgroundColor: '#0f0f1e', padding: '12px', borderRadius: '8px',
          }}>
            {info.note}
          </div>
        )}
        {info.downloadUrl && (
          <button
            onClick={() => openUrl(info.downloadUrl!)}
            style={{
              display: 'block', width: '100%', textAlign: 'center', padding: '12px',
              borderRadius: '8px', backgroundColor: '#5c6bc0', color: '#fff',
              textDecoration: 'none', fontSize: '15px', marginBottom: '10px',
              border: 'none', cursor: 'pointer',
            }}>
            📥 下载最新版本
          </button>
        )}
        <button onClick={props.onClose}
          style={{
            width: '100%', padding: '10px', borderRadius: '8px',
            backgroundColor: 'transparent', color: '#888', fontSize: '14px',
            border: '1px solid #444', cursor: 'pointer',
          }}>
          稍后再说
        </button>
      </div>
    </div>
  )
}

// 设置面板
function SettingsPanel(props: {
  version: string
  updateInfo: UpdateInfo | null
  checking: boolean
  onCheck: () => void
  onClose: () => void
}) {
  const u = props.updateInfo
  return (
    <div style={{
      position: 'fixed', top: '60px', right: '24px', zIndex: 100,
      backgroundColor: '#1a1a2e', borderRadius: '12px', padding: '20px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)', border: '1px solid #333',
      minWidth: '300px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <span style={{ fontSize: '18px', fontWeight: 'bold' }}>设置</span>
        <button onClick={props.onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: '18px' }}>✕</button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <div style={{ color: '#888', fontSize: '13px', marginBottom: '4px' }}>当前版本</div>
        <div style={{ fontSize: '16px' }}>v{props.version}</div>
      </div>

      <div style={{ borderTop: '1px solid #333', paddingTop: '16px' }}>
        <button onClick={props.onCheck} disabled={props.checking}
          style={{
            width: '100%', padding: '10px', borderRadius: '8px', cursor: props.checking ? 'wait' : 'pointer',
            backgroundColor: props.checking ? '#333' : '#5c6bc0', color: '#fff', fontSize: '14px',
            border: 'none',
          }}>
          {props.checking ? '正在检查...' : '🔍 检查更新'}
        </button>

        {u && !props.checking && (
          <div style={{ marginTop: '12px', fontSize: '13px' }}>
            {u.networkError ? (
              <div style={{ color: '#ff9800' }}>网络连接失败，请稍后重试</div>
            ) : u.hasUpdate ? (
              <div>
                <div style={{ color: '#4caf50', marginBottom: '6px' }}>
                  发现新版本 v{u.latestVersion}
                </div>
                {u.note && <div style={{ color: '#aaa', marginBottom: '8px', whiteSpace: 'pre-wrap' }}>{u.note}</div>}
                {u.downloadUrl && (
                  <button onClick={() => openUrl(u.downloadUrl!)}
                    style={{
                      color: '#5c6bc0', textDecoration: 'underline', wordBreak: 'break-all',
                      background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px',
                    }}>
                    点击下载最新版本
                  </button>
                )}
              </div>
            ) : (
              <div style={{ color: '#888' }}>已是最新版本</div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// 浏览器下载兜底
function downloadBlob(data: Uint8Array, filename: string) {
  const blob = new Blob([data as BlobPart], { type: 'application/zip' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
