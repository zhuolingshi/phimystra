import { useRef, useState, useCallback } from 'react'
import { decodeAudioFile, isSupportedAudioFormat } from '../modules/audioImport/audioDecoder'
import { useProjectStore } from '../stores/projectStore'

export function AudioImporter() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { audio, setAudio } = useProjectStore()

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    if (!isSupportedAudioFormat(file.name)) {
      setError('不支持的格式，请用 mp3/wav/ogg/flac')
      return
    }
    setLoading(true)
    try {
      setAudio(await decodeAudioFile(file))
    } catch (err) {
      setError(`解码失败: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setLoading(false)
    }
  }, [setAudio])

  return (
    <div>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault(); setIsDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        style={{
          border: '2px dashed #666', borderRadius: '12px', padding: '40px',
          textAlign: 'center', cursor: 'pointer',
          backgroundColor: isDragging ? '#222' : '#1a1a2e', color: '#ccc',
        }}
      >
        {loading ? <p>正在解码...</p>
          : audio ? <div><p>✅ {audio.name}</p>
            <p style={{ fontSize: '0.85em', opacity: 0.7 }}>
              时长: {audio.duration.toFixed(1)}s | {audio.sampleRate}Hz
            </p></div>
          : <div><p>🎵 拖拽音频到此处，或点击选择</p>
            <p style={{ fontSize: '0.85em', opacity: 0.6 }}>MP3 / WAV / OGG / FLAC</p></div>}
      </div>
      <input ref={inputRef} type="file" accept=".mp3,.wav,.ogg,.flac,.m4a"
        style={{ display: 'none' }}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      {error && <p style={{ color: '#ff6b6b', marginTop: '8px' }}>{error}</p>}
    </div>
  )
}
