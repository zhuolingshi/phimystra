import { useRef, useState, useCallback } from 'react'
import { decodeAudioFile, extractAudioFromVideo, isSupportedAudioFormat, isSupportedVideoFormat } from '../modules/audioImport/audioDecoder'
import { useProjectStore } from '../stores/projectStore'
import { useScreenSize } from '../hooks/useScreenSize'

export function AudioImporter() {
  const screen = useScreenSize()
  const { size, isTouch } = screen
  const isPhone = size === 'phone'

  const inputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const { audio, setAudio } = useProjectStore()

  const handleFile = useCallback(async (file: File) => {
    setError(null)
    const isAudio = isSupportedAudioFormat(file.name, file.type)
    const isVideo = isSupportedVideoFormat(file.name, file.type)
    if (!isAudio && !isVideo) {
      setError('不支持的格式，请用 mp3/wav/ogg/flac/m4a 或视频 mp4/webm/mkv')
      return
    }
    setLoading(true)
    try {
      if (isVideo) {
        setLoadingMsg('正在从视频提取音频...')
        setAudio(await extractAudioFromVideo(file))
      } else {
        setLoadingMsg('正在解码...')
        setAudio(await decodeAudioFile(file))
      }
    } catch (err) {
      setError(isVideo
        ? `视频音频提取失败: ${err instanceof Error ? err.message : String(err)}。请尝试转为 mp3/m4a 后导入`
        : `解码失败: ${err instanceof Error ? err.message : String(err)}`)
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
          border: '2px dashed #666', borderRadius: '12px',
          padding: isPhone ? '32px 20px' : size === 'tablet' ? '48px 32px' : '40px',
          textAlign: 'center', cursor: 'pointer',
          backgroundColor: isDragging ? '#222' : '#1a1a2e', color: '#ccc',
        }}
      >
        {loading ? <p style={{ fontSize: isPhone ? undefined : '17px' }}>{loadingMsg}</p>
          : audio ? <div><p>✅ {audio.name}</p>
            <p style={{ fontSize: '0.85em', opacity: 0.7 }}>
              时长: {audio.duration.toFixed(1)}s | {audio.sampleRate}Hz
            </p></div>
          : <div>
            <p style={{ fontSize: isPhone ? '17px' : size === 'tablet' ? '20px' : undefined }}>
              {isTouch ? '🎵 点击选择音频' : '🎵 拖拽音频到此处，或点击选择'}
            </p>
            <p style={{ fontSize: '0.85em', opacity: 0.6 }}>
              {isTouch ? '从手机音乐中选择' : 'MP3 / WAV / OGG / FLAC'}
            </p>
          </div>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={isTouch ? 'audio/*' : '.mp3,.wav,.ogg,.flac,.m4a'}
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept={isTouch ? 'video/*' : '.mp4,.m4v,.webm,.mkv,.mov,.avi'}
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />
      <div style={{ marginTop: '8px', textAlign: 'center' }}>
        <button
          onClick={() => videoInputRef.current?.click()}
          disabled={loading}
          style={{
            padding: isPhone ? '10px 20px' : '10px 24px',
            fontSize: isPhone ? '15px' : '16px',
            border: '1px solid #555', borderRadius: '8px',
            backgroundColor: '#1a1a2e', color: '#aaa', cursor: 'pointer',
          }}
        >
          🎬 导入视频提取音频
        </button>
      </div>
      {error && <p style={{ color: '#ff6b6b', marginTop: '8px' }}>{error}</p>}
    </div>
  )
}
