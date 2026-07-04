import { common, Want } from '@kit.AbilityKit'
import { http } from '@kit.NetworkKit'
import { router } from '@kit.ArkUI'
import { fileIo } from '@kit.CoreFileKit'
import { AudioAnalysis, DecodedAudioData, analyzeAudio } from '../utils/audioAnalysis'
import { RPEChart, NOTE_HEIGHT } from '../model/chart'
import { generateChart, ChartGenerationResult } from '../utils/chartEngine'
import { DifficultyParams, Playstyle, levelToParams, applyPlaystyle, levelToRPEString, getDifficultyTier, DifficultyTier } from '../utils/difficultyParams'
import { decodeAudioFile, getAudioFormat, isSupportedAudioFormat } from '../utils/audioDecoder'
import { parseChart, ProcessedChart } from '../utils/eventParser'
import { render, RenderOptions } from '../utils/renderer'
import { checkForUpdate, UpdateInfo } from '../utils/updater'
import { APP_VERSION } from '../utils/appState'
import { ThemeMode, loadThemeMode, saveThemeMode, getResourceTheme, AppTheme } from '../utils/theme'
import { pickAudioFile, pickVideoFile, pickImageFile, saveViaPicker, saveFileViaPicker, PickedFile } from '../utils/filePicker'
import { buildZipFile } from '../utils/zipBuilder'
import { textureManager } from '../utils/textureManager'
import { PreviewAudioPlayer } from '../utils/previewAudioPlayer'

@Entry
@Component
struct Index {
  @State audioName: string = ''
  @State audioFormat: string = ''
  @State audioData: Uint8Array = new Uint8Array(0)
  private audioUri: string = ''
  @State decodedAudio: DecodedAudioData | null = null
  @State analysis: AudioAnalysis | null = null
  @State isAnalyzing: boolean = false
  @State chart: RPEChart | null = null
  @State genResult: ChartGenerationResult | null = null
  @State isGenerating: boolean = false
  @State genError: string = ''
  @State statNoteCount: number = 0
  @State statLineCount: number = 0
  @State statBpm: number = 0
  @State difficulty: number = 10
  @State playstyle: Playstyle = Playstyle.TwoFinger
  @State songName: string = ''
  @State composer: string = ''
  @State charter: string = 'PhiMystra'
  @State illustrator: string = ''
  @State backgroundData: Uint8Array | null = null
  @State showSettings: boolean = false
  @State themeMode: ThemeMode = ThemeMode.System
  @State colorMode: number = 0
  @State updateInfo: UpdateInfo | null = null
  @State startupUpdate: UpdateInfo | null = null
  @State isExporting: boolean = false
  @State exportMsg: string = ''
  @State exportOk: boolean = false
  @State canvasWidth: number = 800
  @State canvasHeight: number = 533
  @State previewTime: number = 0
  @State previewDuration: number = 0
  @State isPreviewPlaying: boolean = false

  private processedChart: ProcessedChart | null = null
  private renderOptions: RenderOptions = { showGuide: false, speedMultiplier: 1, debug: false }
  private canvasCtx: CanvasRenderingContext2D = new CanvasRenderingContext2D(new RenderingContextSettings(true))
  private timerId: number = -1
  private previewStartSec: number = 0
  private startTimestamp: number = 0
  private previewPlayer: PreviewAudioPlayer = new PreviewAudioPlayer()
  private prevPreviewTime: number = 0

  aboutToAppear(): void {
    const ctx = getContext(this) as common.UIAbilityContext
    globalThis.ctx = ctx

    textureManager.load(ctx)

    loadThemeMode().then((mode: ThemeMode) => {
      this.themeMode = mode
      if (mode === ThemeMode.Dark) {
        ctx.getApplicationContext().setColorMode(1)
      } else if (mode === ThemeMode.Light) {
        ctx.getApplicationContext().setColorMode(0)
      }
    })

    checkForUpdate().then((info: UpdateInfo) => {
      if (info.hasUpdate) this.startupUpdate = info
    }).catch(() => {})
  }

  aboutToDisappear(): void {
    this.stopPreview()
    this.previewPlayer.release()
    textureManager.clear()
  }

  private get theme(): AppTheme {
    return getResourceTheme()
  }

  private get bpm(): number {
    if (this.analysis) return this.analysis.bpm
    if (this.chart && this.chart.BPMList.length > 0) return this.chart.BPMList[0].bpm
    return 0
  }

  private get noteCount(): number {
    if (!this.chart) return 0
    let count = 0
    for (const line of this.chart.judgeLineList) count += line.numOfNotes
    return count
  }

  private get lineCount(): number {
    if (!this.chart) return 0
    return this.chart.judgeLineList.length
  }

  private handleBack(): void {
    if (this.chart) { this.chart = null; this.genResult = null; this.processedChart = null; this.stopPreview(); return }
    if (this.analysis) { this.analysis = null; return }
    if (this.decodedAudio) { this.decodedAudio = null; this.audioName = ''; this.audioData = new Uint8Array(0); this.audioUri = ''; return }
  }

  private async handleImportAudio(): Promise<void> {
    let file: PickedFile | null = null
    try {
      file = await pickAudioFile()
    } catch (e) {
      this.genError = `选择文件失败: ${e.message ?? JSON.stringify(e)}`
      return
    }
    if (!file) {
      this.genError = '未选择文件或文件读取失败'
      return
    }

    try {
      const format = getAudioFormat(file.name)
      const decoded = await decodeAudioFile(file.data, format)
      this.audioName = file.name
      this.audioFormat = format
      this.audioData = file.data
      this.audioUri = file.uri
      this.decodedAudio = decoded
      this.analysis = null
      this.chart = null
      this.genError = ''
    } catch (e) {
      this.genError = `音频解码失败: ${e.message ?? e}`
    }
  }

  private async handleImportVideo(): Promise<void> {
    const file = await pickVideoFile()
    if (!file) return

    try {
      const decoded = await decodeAudioFile(file.data, 'mp4')
      const baseName = file.name.replace(/\.[^.]+$/, '')
      this.audioName = `${baseName}.mp4`
      this.audioFormat = 'mp4'
      this.audioData = file.data
      this.audioUri = file.uri
      this.decodedAudio = decoded
      this.analysis = null
      this.chart = null
    } catch (e) {
      this.genError = `视频音频提取失败: ${e.message ?? e}`
    }
  }

  private async handleAnalyze(): Promise<void> {
    if (!this.decodedAudio) return
    this.isAnalyzing = true
    this.genError = ''
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 50))
      const result = analyzeAudio(this.decodedAudio)
      this.analysis = result
    } catch (e) {
      const msg = (e as Error).message ?? JSON.stringify(e)
      this.genError = `分析失败: ${msg}`
      console.error('[PhiMystra] analyze error: ' + msg)
    } finally {
      this.isAnalyzing = false
    }
  }

  private async handleGenerate(): Promise<void> {
    if (!this.analysis) return
    this.isGenerating = true
    this.genError = ''
    console.info('[PhiMystra] handleGenerate: START')

    await new Promise<void>((resolve) => setTimeout(resolve, 50))
    console.info('[PhiMystra] handleGenerate: after delay')

    try {
      console.info('[PhiMystra] handleGenerate: calling generateChart')
      const result = generateChart({
        analysis: this.analysis,
        difficultyLevel: this.difficulty,
        playstyle: this.playstyle,
        songName: this.songName || this.audioName.replace(/\.[^.]+$/, '') || '未命名',
        composer: this.composer || '未知',
        charter: this.charter || 'PhiMystra'
      })
      console.info(`[PhiMystra] handleGenerate: generateChart done, notes=${result.noteCount}`)

      this.chart = result.chart
      this.genResult = result
      this.statBpm = this.analysis.bpm
      this.statNoteCount = result.noteCount
      this.statLineCount = result.chart.judgeLineList.length
      console.info('[PhiMystra] handleGenerate: chart state set')

      try {
        this.processedChart = parseChart(result.chart)
        this.previewDuration = this.processedChart.duration
        console.info('[PhiMystra] handleGenerate: parseChart done')
      } catch (e2) {
        console.error('[PhiMystra] parseChart error: ' + JSON.stringify(e2))
      }
    } catch (e) {
      const err = e as Error
      this.genError = `生成失败: ${err.message ?? JSON.stringify(e)}`
      console.error('[PhiMystra] generate error: ' + this.genError)
    } finally {
      this.isGenerating = false
      console.info('[PhiMystra] handleGenerate: END')
    }
  }

  private async handleExport(): Promise<void> {
    if (!this.chart || !this.audioUri) return
    this.isExporting = true
    this.exportMsg = ''
    let step = 'init'

    try {
      const name = this.songName || this.audioName.replace(/\.[^.]+$/, '') || 'chart'
      this.chart.META.name = name
      this.chart.META.composer = this.composer || '未知'
      this.chart.META.charter = this.charter || 'PhiMystra'

      const ctx = globalThis.ctx as common.UIAbilityContext
      const tempDir = `${ctx.cacheDir}/pez_temp`
      const pathId = this.chart.META.id || '10000000'
      const chartFile = `${pathId}.json`
      const musicFile = `${pathId}.${this.audioFormat}`
      const pngFile = `${pathId}.png`

      step = 'mkdir'
      try { fileIo.rmdirSync(tempDir) } catch { /* ignore */ }
      fileIo.mkdirSync(tempDir, true)

      step = 'prepare-chart'
      const origSong = this.chart.META.song
      const origBg = this.chart.META.background
      this.chart.META.song = musicFile
      this.chart.META.background = pngFile
      this.chart.META.id = pathId
      const chartJson = JSON.stringify(this.chart, null, 2)
      this.chart.META.song = origSong
      this.chart.META.background = origBg

      step = 'prepare-info'
      const m = this.chart.META
      const nl = '\n'
      const infoTxt = '#' + nl +
        'Name: ' + m.name + nl +
        'Path: ' + pathId + nl +
        'Song: ' + musicFile + nl +
        'Picture: ' + pngFile + nl +
        'Chart: ' + chartFile + nl +
        'Level: ' + m.level + nl +
        'Composer: ' + m.composer + nl +
        'Charter: ' + m.charter + nl

      const infoYml = 'name: ' + JSON.stringify(m.name) + nl +
        'difficulty: 1' + nl +
        'level: ' + JSON.stringify(m.level) + nl +
        'charter: ' + JSON.stringify(m.charter) + nl +
        'composer: ' + JSON.stringify(m.composer) + nl +
        'illustrator: ' + JSON.stringify('AI') + nl +
        'chart: ' + JSON.stringify(chartFile) + nl +
        'music: ' + JSON.stringify(musicFile) + nl +
        'illustration: ' + JSON.stringify(pngFile) + nl +
        'previewStart: 0.0' + nl +
        'previewEnd: null' + nl +
        'aspectRatio: 1.7777778' + nl +
        'backgroundDim: 0.6' + nl +
        'lineLength: 6.0' + nl +
        'offset: ' + m.offset + nl +
        'tags: []' + nl +
        'holdPartialCover: false' + nl +
        'noteUniformScale: false' + nl +
        'forceAspectRatio: false' + nl

      step = 'write-temp'
      this.writeString(tempDir + '/chart.json', chartJson)
      this.writeString(tempDir + '/info.txt', infoTxt)
      this.writeString(tempDir + '/info.yml', infoYml)

      const pngBytes: number[] = [
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
        0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54,
        0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
        0xe2, 0x21, 0xbc, 0x33,
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44,
        0xae, 0x42, 0x60, 0x82
      ]
      const pngBuf = new ArrayBuffer(pngBytes.length)
      const pngView = new Uint8Array(pngBuf)
      for (let i = 0; i < pngBytes.length; i++) {
        pngView[i] = pngBytes[i]
      }
      const fPng = fileIo.openSync(tempDir + '/' + pngFile, fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC)
      fileIo.writeSync(fPng.fd, pngBuf)
      fileIo.closeSync(fPng)

      step = 'read-files'
      const fileMap = new Map<string, ArrayBuffer>()
      fileMap.set(chartFile, this.readFileBuf(tempDir + '/chart.json'))
      fileMap.set(musicFile, this.readFileBuf(this.audioUri))
      fileMap.set('info.txt', this.readFileBuf(tempDir + '/info.txt'))
      fileMap.set('info.yml', this.readFileBuf(tempDir + '/info.yml'))
      fileMap.set(pngFile, this.readFileBuf(tempDir + '/' + pngFile))

      step = 'zip'
      const zipPath = `${ctx.cacheDir}/temp_export.zip`
      try { fileIo.unlinkSync(zipPath) } catch { /* ignore */ }
      buildZipFile(zipPath, fileMap)

      step = 'save'
      const stat = fileIo.statSync(zipPath)
      await saveFileViaPicker(`${name}.pez`, zipPath)
      this.exportOk = true
      this.exportMsg = `导出成功！${name}.pez（${(stat.size / 1024).toFixed(0)} KB）`

      try { fileIo.rmdirSync(tempDir) } catch { /* ignore */ }
      try { fileIo.unlinkSync(zipPath) } catch { /* ignore */ }
    } catch (e) {
      this.exportOk = false
      const err = e as Error
      this.exportMsg = `导出失败[${step}]: ${err.message ?? JSON.stringify(e)}`
    } finally {
      this.isExporting = false
    }
  }

  private writeString(path: string, content: string): void {
    const f = fileIo.openSync(path, fileIo.OpenMode.READ_WRITE | fileIo.OpenMode.CREATE | fileIo.OpenMode.TRUNC)
    fileIo.writeSync(f.fd, content)
    fileIo.closeSync(f)
  }

  private readFileBuf(path: string): ArrayBuffer {
    const stat = fileIo.statSync(path)
    const f = fileIo.openSync(path, fileIo.OpenMode.READ_ONLY)
    const buf = new ArrayBuffer(stat.size)
    fileIo.readSync(f.fd, buf)
    fileIo.closeSync(f)
    return buf
  }

  private async handleImportBackground(): Promise<void> {
    const file = await pickImageFile()
    if (file) {
      this.backgroundData = file.data
    }
  }

  private async handleCheckUpdate(): Promise<void> {
    const info = await checkForUpdate()
    this.updateInfo = info
  }

  private async handleChangeTheme(mode: ThemeMode): Promise<void> {
    this.themeMode = mode
    await saveThemeMode(mode)
    if (mode === ThemeMode.System) {
      const ctx = getContext(this) as common.UIAbilityContext
      ctx.getApplicationContext().setColorMode(0)
    } else if (mode === ThemeMode.Dark) {
      const ctx = getContext(this) as common.UIAbilityContext
      ctx.getApplicationContext().setColorMode(1)
    } else {
      const ctx = getContext(this) as common.UIAbilityContext
      ctx.getApplicationContext().setColorMode(0)
    }
  }

  private async startPreview(): Promise<void> {
    if (!this.processedChart) return
    if (this.isPreviewPlaying) {
      this.stopPreview()
      return
    }

    if (this.audioData.length > 0) {
      await this.previewPlayer.prepare(this.audioData, this.audioFormat)
    }

    this.isPreviewPlaying = true
    this.previewStartSec = this.previewTime
    this.prevPreviewTime = this.previewTime
    this.startTimestamp = Date.now()
    this.previewPlayer.play()

    this.timerId = setInterval(() => {
      const audioTime = this.previewPlayer.getCurrentTime()
      let t: number
      if (audioTime >= 0) {
        t = this.previewStartSec + audioTime
      } else {
        const elapsed = (Date.now() - this.startTimestamp) / 1000
        t = this.previewStartSec + elapsed
      }
      if (t >= this.previewDuration) {
        this.previewTime = 0
        this.previewStartSec = 0
        this.prevPreviewTime = 0
        this.startTimestamp = Date.now()
        this.previewPlayer.seek(0)
        this.previewPlayer.resetHitTracking()
      } else {
        this.previewTime = t
      }
      if (this.processedChart) {
        this.previewPlayer.checkHitSounds(this.processedChart, this.previewTime, this.prevPreviewTime)
      }
      this.prevPreviewTime = this.previewTime
      this.renderPreview()
    }, 33)
  }

  private stopPreview(): void {
    if (this.timerId !== -1) {
      clearInterval(this.timerId)
      this.timerId = -1
    }
    this.isPreviewPlaying = false
    this.previewPlayer.pause()
  }

  private renderPreview(): void {
    if (!this.processedChart) return
    try {
      render(this.canvasCtx, this.processedChart, this.previewTime,
        this.canvasWidth, this.canvasHeight, this.renderOptions)
    } catch (e) {
      this.genError = `渲染错误: ${JSON.stringify(e)}`
    }
  }

  build(): void {
    Column() {
      this.Header()
      if (this.showSettings) {
        this.SettingsPanel()
      }
      if (this.startupUpdate) {
        this.UpdatePopup(this.startupUpdate)
      }
      Scroll() {
        Column() {
          if (!this.decodedAudio && !this.analysis && !this.chart) {
            this.HomeScreen()
          }
          if (this.decodedAudio && !this.analysis) {
            this.AnalysisScreen()
          }
          if (this.isAnalyzing) {
            this.AnalyzingScreen()
          }
          if (this.analysis && !this.chart) {
            this.ConfigScreen()
          }
          if (this.chart) {
            this.ChartScreen()
          }
        }
        .width('100%')
        .padding({ left: 16, right: 16, bottom: 32 })
      }
      .layoutWeight(1)
      .scrollBar(BarState.Off)
    }
    .width('100%')
    .height('100%')
    .backgroundColor($r('app.color.bg_primary'))
  }

  @Builder
  Header(): void {
    Row() {
      Row() {
        if (this.decodedAudio || this.analysis || this.chart) {
          Button() {
            SymbolGlyph($r('sys.symbol.chevron_left'))
              .fontSize(22)
              .fontColor([$r('app.color.text_primary')])
          }
          .type(ButtonType.Normal)
          .backgroundColor(Color.Transparent)
          .borderRadius(20)
          .width(40)
          .height(40)
          .onClick(() => this.handleBack())
          .margin({ right: 4 })
        }
        Text('音律魔女')
          .fontSize(22)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.text_primary'))
      }

      Button() {
        SymbolGlyph($r('sys.symbol.gearshape'))
          .fontSize(22)
          .fontColor([$r('app.color.text_primary')])
      }
      .type(ButtonType.Normal)
      .backgroundColor(Color.Transparent)
      .borderRadius(20)
      .width(40)
      .height(40)
      .onClick(() => { this.showSettings = !this.showSettings })
    }
    .width('100%')
    .padding({ left: 16, right: 16, top: 12, bottom: 12 })
    .justifyContent(FlexAlign.SpaceBetween)
    .alignItems(VerticalAlign.Center)
  }

  @Builder
  HomeScreen(): void {
    Column() {
      Column() {
        Image($r('app.media.app_icon'))
          .width(72)
          .height(72)
          .borderRadius(16)
          .margin({ bottom: 16 })
        Text('音律魔女')
          .fontSize(28)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.text_primary'))
          .margin({ bottom: 8 })
        Text('AI 自动制谱器')
          .fontSize(16)
          .fontColor($r('app.color.text_secondary'))
      }
      .width('100%')
      .padding({ top: 48, bottom: 32 })
      .justifyContent(FlexAlign.Center)

      Button('导入音频')
        .width('100%')
        .height(52)
        .fontSize(17)
        .fontColor($r('app.color.accent_text'))
        .backgroundColor($r('app.color.accent'))
        .borderRadius(24)
        .shadow({ radius: 8, color: 'rgba(0,125,255,0.3)', offsetX: 0, offsetY: 4 })
        .onClick(() => this.handleImportAudio())
        .margin({ bottom: 12 })

      Button('从视频提取音频')
        .width('100%')
        .height(48)
        .fontSize(16)
        .fontColor($r('app.color.text_primary'))
        .backgroundColor($r('app.color.bg_card'))
        .borderRadius(24)
        .border({ width: 1, color: $r('app.color.border') })
        .onClick(() => this.handleImportVideo())
        .margin({ bottom: 24 })

      Column() {
        Text('支持格式：MP3 / WAV / OGG / FLAC / M4A / MP4')
          .fontSize(13)
          .fontColor($r('app.color.text_secondary'))
        Text('完全本地运行，不上传任何数据')
          .fontSize(13)
          .fontColor($r('app.color.text_secondary'))
          .margin({ top: 4 })
      }
      .width('100%')
      .alignItems(HorizontalAlign.Center)

      if (this.genError.length > 0) {
        Text(this.genError)
          .fontSize(14)
          .fontColor('#FF9800')
          .margin({ top: 16 })
          .padding(12)
          .backgroundColor('rgba(255,152,0,0.1)')
          .borderRadius(8)
      }
    }
    .width('100%')
  }

  @Builder
  AnalysisScreen(): void {
    Column() {
      this.AudioInfoCard()

      Button(this.isAnalyzing ? '正在分析' : '分析节奏')
        .width('100%')
        .height(52)
        .fontSize(17)
        .fontColor($r('app.color.accent_text'))
        .backgroundColor(this.isAnalyzing ? $r('app.color.bg_card') : $r('app.color.accent'))
        .borderRadius(24)
        .enabled(!this.isAnalyzing)
        .onClick(() => this.handleAnalyze())
        .margin({ top: 16 })
    }
    .width('100%')
  }

  @Builder
  AnalyzingScreen(): void {
    Column() {
      LoadingProgress()
        .width(64)
        .height(64)
        .color($r('app.color.accent'))
        .margin({ bottom: 16 })
      Text('正在检测节奏点和频段信息...')
        .fontSize(15)
        .fontColor($r('app.color.text_secondary'))
    }
    .width('100%')
    .padding({ top: 48, bottom: 48 })
    .justifyContent(FlexAlign.Center)
  }

  @Builder
  ConfigScreen(): void {
    Column() {
      this.AudioInfoCard()
      this.AnalysisStatsCard()
      this.InfoEditorCard()
      this.PlaystyleCard()
      this.DifficultyCard()
      this.BackgroundCard()

      Button(this.isGenerating ? '正在生成' : '生成谱面')
        .width('100%')
        .height(52)
        .fontSize(17)
        .fontColor($r('app.color.accent_text'))
        .backgroundColor(this.isGenerating ? $r('app.color.bg_card') : '#34C759')
        .borderRadius(24)
        .enabled(!this.isGenerating)
        .onClick(() => this.handleGenerate())
        .margin({ top: 16 })

      if (this.genError.length > 0) {
        Text(this.genError)
          .fontSize(14)
          .fontColor('#FF9800')
          .margin({ top: 8 })
      }
    }
    .width('100%')
  }

  @Builder
  ChartScreen(): void {
    Column() {
      Text('谱面生成成功！')
        .fontSize(20)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('app.color.text_primary'))
        .padding(20)

      if (this.genResult) {
        Text(`BPM: ${this.statBpm}  音符: ${this.statNoteCount}  判定线: ${this.statLineCount}`)
          .fontSize(15)
          .fontColor($r('app.color.text_secondary'))
          .padding(16)
      }

      Button(this.isExporting ? '正在导出...' : '导出谱面包')
        .width('100%')
        .height(52)
        .fontSize(17)
        .fontColor($r('app.color.accent_text'))
        .backgroundColor(this.isExporting ? $r('app.color.bg_card') : '#FF9800')
        .borderRadius(24)
        .enabled(!this.isExporting)
        .onClick(() => this.handleExport())
        .margin({ top: 12 })

      if (this.exportMsg.length > 0) {
        Text(this.exportMsg)
          .fontSize(14)
          .fontColor(this.exportOk ? '#34C759' : '#FF9800')
          .padding(12)
          .margin({ top: 8 })
      }

      Button('重新生成')
        .width('100%')
        .height(48)
        .fontSize(15)
        .fontColor($r('app.color.text_secondary'))
        .backgroundColor($r('app.color.bg_card'))
        .borderRadius(24)
        .border({ width: 1, color: $r('app.color.border') })
        .onClick(() => { this.chart = null; this.genResult = null; this.processedChart = null; this.stopPreview() })
        .margin({ top: 8 })
    }
    .width('100%')
  }

  @Builder
  AudioInfoCard(): void {
    Row() {
      Column() {
        Text(this.audioName || '未选择文件')
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .fontColor($r('app.color.text_primary'))
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
        if (this.decodedAudio) {
          Text(`${this.decodedAudio.numberOfChannels}声道 · ${this.decodedAudio.sampleRate}Hz · ${this.decodedAudio.duration.toFixed(1)}秒`)
            .fontSize(13)
            .fontColor($r('app.color.text_secondary'))
            .margin({ top: 4 })
        }
      }
      .alignItems(HorizontalAlign.Start)
      .layoutWeight(1)

      Button('更换')
        .fontSize(14)
        .height(36)
        .fontColor($r('app.color.accent_text'))
        .backgroundColor($r('app.color.accent'))
        .borderRadius(18)
        .onClick(() => this.handleImportAudio())
    }
    .width('100%')
    .padding(16)
    .backgroundColor($r('app.color.bg_card'))
    .borderRadius(16)
  }

  @Builder
  AnalysisStatsCard(): void {
    if (this.analysis) {
      Column() {
        Row() {
          this.StatItem('BPM', this.analysis.bpm.toString())
          this.StatItem('时长', `${this.analysis.duration.toFixed(1)}s`)
          this.StatItem('节奏点', this.analysis.onsets.length.toString())
        }
        .width('100%')
        .justifyContent(FlexAlign.SpaceEvenly)
      }
      .width('100%')
      .padding(16)
      .backgroundColor($r('app.color.bg_card'))
      .borderRadius(16)
      .margin({ top: 12 })
    }
  }

  @Builder
  StatItem(label: string, value: string): void {
    Column() {
      Text(value)
        .fontSize(22)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('app.color.accent'))
      Text(label)
        .fontSize(13)
        .fontColor($r('app.color.text_secondary'))
        .margin({ top: 2 })
    }
    .alignItems(HorizontalAlign.Center)
  }

  @Builder
  InfoEditorCard(): void {
    Column() {
      Text('谱面信息')
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.text_primary'))
        .margin({ bottom: 12 })

      TextInput({ placeholder: '曲名', text: this.songName })
        .fontSize(15)
        .height(48)
        .borderRadius(12)
        .backgroundColor($r('app.color.bg_input'))
        .fontColor($r('app.color.text_primary'))
        .onChange((v: string) => this.songName = v)
        .margin({ bottom: 8 })

      TextInput({ placeholder: '曲师', text: this.composer })
        .fontSize(15)
        .height(48)
        .borderRadius(12)
        .backgroundColor($r('app.color.bg_input'))
        .fontColor($r('app.color.text_primary'))
        .onChange((v: string) => this.composer = v)
        .margin({ bottom: 8 })

      TextInput({ placeholder: '谱师', text: this.charter })
        .fontSize(15)
        .height(48)
        .borderRadius(12)
        .backgroundColor($r('app.color.bg_input'))
        .fontColor($r('app.color.text_primary'))
        .onChange((v: string) => this.charter = v)
    }
    .width('100%')
    .padding(16)
    .backgroundColor($r('app.color.bg_card'))
    .borderRadius(16)
    .margin({ top: 12 })
  }

  @Builder
  PlaystyleCard(): void {
    Column() {
      Text('玩法选择')
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.text_primary'))
        .margin({ bottom: 12 })

      Row() {
        Button('两指\n双手双指，适合手机')
          .layoutWeight(1)
          .height(72)
          .fontSize(14)
          .fontColor(this.playstyle === Playstyle.TwoFinger ? $r('app.color.accent_text') : $r('app.color.text_secondary'))
          .backgroundColor(this.playstyle === Playstyle.TwoFinger ? $r('app.color.accent') : $r('app.color.bg_input'))
          .borderRadius(16)
          .onClick(() => this.playstyle = Playstyle.TwoFinger)

        Button('多指\n多指并发，适合平板')
          .layoutWeight(1)
          .height(72)
          .fontSize(14)
          .fontColor(this.playstyle === Playstyle.MultiFinger ? $r('app.color.accent_text') : $r('app.color.text_secondary'))
          .backgroundColor(this.playstyle === Playstyle.MultiFinger ? $r('app.color.accent') : $r('app.color.bg_input'))
          .borderRadius(16)
          .onClick(() => this.playstyle = Playstyle.MultiFinger)
      }
      .width('100%')
    }
    .width('100%')
    .padding(16)
    .backgroundColor($r('app.color.bg_card'))
    .borderRadius(16)
    .margin({ top: 12 })
  }

  @Builder
  DifficultyCard(): void {
    Column() {
      Text(`难度等级：${this.difficulty}`)
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor($r('app.color.text_primary'))
        .margin({ bottom: 8 })

      Text(levelToRPEString(this.difficulty))
        .fontSize(14)
        .fontColor($r('app.color.accent'))
        .margin({ bottom: 16 })

      Slider({ value: this.difficulty, min: 1, max: 16, step: 1 })
        .blockColor($r('app.color.accent'))
        .trackColor($r('app.color.bg_input'))
        .selectedColor($r('app.color.accent'))
        .width('100%')
        .onChange((v: number) => this.difficulty = Math.round(v))

      Row() {
        Text('新手').fontSize(11).fontColor($r('app.color.text_secondary'))
        Text('简易').fontSize(11).fontColor($r('app.color.text_secondary'))
        Text('普通').fontSize(11).fontColor($r('app.color.text_secondary'))
        Text('困难').fontSize(11).fontColor($r('app.color.text_secondary'))
      }
      .width('100%')
      .justifyContent(FlexAlign.SpaceBetween)
      .margin({ top: 4 })
    }
    .width('100%')
    .padding(16)
    .backgroundColor($r('app.color.bg_card'))
    .borderRadius(16)
    .margin({ top: 12 })
  }

  @Builder
  BackgroundCard(): void {
    Row() {
      Text(this.backgroundData ? '已导入自定义背景' : '背景图片（可选）')
        .fontSize(14)
        .fontColor($r('app.color.text_secondary'))
        .layoutWeight(1)

      if (this.backgroundData) {
        Button('清除')
          .fontSize(13)
          .height(32)
          .fontColor($r('app.color.danger'))
          .backgroundColor($r('app.color.bg_input'))
          .borderRadius(16)
          .onClick(() => this.backgroundData = null)
          .margin({ right: 8 })
      }
      Button(this.backgroundData ? '更换' : '导入')
        .fontSize(13)
        .height(32)
        .fontColor($r('app.color.accent_text'))
        .backgroundColor($r('app.color.accent'))
        .borderRadius(16)
        .onClick(() => this.handleImportBackground())
    }
    .width('100%')
    .padding(16)
    .backgroundColor($r('app.color.bg_card'))
    .borderRadius(16)
    .margin({ top: 12 })
    .alignItems(VerticalAlign.Center)
  }

  @Builder
  ChartStatsCard(): void {
    if (this.genResult) {
      Column() {
        Row() {
          this.StatItem('BPM', this.bpm.toString())
          this.StatItem('音符', this.noteCount.toString())
          this.StatItem('判定线', this.lineCount.toString())
        }
        .width('100%')
        .justifyContent(FlexAlign.SpaceEvenly)

        Divider().color($r('app.color.border')).margin({ top: 12, bottom: 12 })

        Row() {
          this.StatItem('Tap', (this.genResult.noteTypeCounts.get('tap') ?? 0).toString())
          this.StatItem('Hold', (this.genResult.noteTypeCounts.get('hold') ?? 0).toString())
          this.StatItem('Flick', (this.genResult.noteTypeCounts.get('flick') ?? 0).toString())
          this.StatItem('Drag', (this.genResult.noteTypeCounts.get('drag') ?? 0).toString())
        }
        .width('100%')
        .justifyContent(FlexAlign.SpaceEvenly)
      }
      .width('100%')
      .padding(16)
      .backgroundColor($r('app.color.bg_card'))
      .borderRadius(16)
      .margin({ top: 12 })
    }
  }

  @Builder
  SettingsPanel(): void {
    Column() {
      Row() {
        Text('设置')
          .fontSize(20)
          .fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.text_primary'))
        Blank()
        Button() {
          SymbolGlyph($r('sys.symbol.xmark'))
            .fontSize(20)
            .fontColor([$r('app.color.text_secondary')])
        }
        .type(ButtonType.Normal)
        .backgroundColor(Color.Transparent)
        .borderRadius(20)
        .width(36)
        .height(36)
        .onClick(() => this.showSettings = false)
      }
      .width('100%')
      .margin({ bottom: 16 })

      Row() {
        Text('当前版本')
          .fontSize(14)
          .fontColor($r('app.color.text_secondary'))
        Blank()
        Text(`v${APP_VERSION}`)
          .fontSize(16)
          .fontColor($r('app.color.text_primary'))
      }
      .width('100%')
      .margin({ bottom: 16 })

      Column() {
        Text('主题模式')
          .fontSize(14)
          .fontColor($r('app.color.text_secondary'))
          .margin({ bottom: 8 })

        Row() {
          Button('浅色')
            .layoutWeight(1)
            .height(40)
            .fontSize(13)
            .fontColor(this.themeMode === ThemeMode.Light ? $r('app.color.accent_text') : $r('app.color.text_secondary'))
            .backgroundColor(this.themeMode === ThemeMode.Light ? $r('app.color.accent') : $r('app.color.bg_input'))
            .borderRadius({ topLeft: 20, bottomLeft: 20 })
            .onClick(() => this.handleChangeTheme(ThemeMode.Light))

          Button('深色')
            .layoutWeight(1)
            .height(40)
            .fontSize(13)
            .fontColor(this.themeMode === ThemeMode.Dark ? $r('app.color.accent_text') : $r('app.color.text_secondary'))
            .backgroundColor(this.themeMode === ThemeMode.Dark ? $r('app.color.accent') : $r('app.color.bg_input'))
            .borderRadius(0)
            .onClick(() => this.handleChangeTheme(ThemeMode.Dark))

          Button('跟随系统')
            .layoutWeight(1)
            .height(40)
            .fontSize(13)
            .fontColor(this.themeMode === ThemeMode.System ? $r('app.color.accent_text') : $r('app.color.text_secondary'))
            .backgroundColor(this.themeMode === ThemeMode.System ? $r('app.color.accent') : $r('app.color.bg_input'))
            .borderRadius({ topRight: 20, bottomRight: 20 })
            .onClick(() => this.handleChangeTheme(ThemeMode.System))
        }
        .width('100%')
      }
      .width('100%')
      .margin({ bottom: 16 })

      Divider().color($r('app.color.border')).margin({ bottom: 16 })

      Button('检查更新')
        .width('100%')
        .height(44)
        .fontSize(15)
        .fontColor($r('app.color.accent_text'))
        .backgroundColor($r('app.color.accent'))
        .borderRadius(12)
        .onClick(() => this.handleCheckUpdate())

      if (this.updateInfo) {
        Column() {
          if (this.updateInfo.networkError) {
            Text('网络连接失败，请稍后重试')
              .fontSize(13).fontColor('#FF9800')
          } else if (this.updateInfo.hasUpdate) {
            Text(`发现新版本 v${this.updateInfo.latestVersion}`)
              .fontSize(13).fontColor('#34C759')
            if (this.updateInfo.note.length > 0) {
              Text(this.updateInfo.note)
                .fontSize(13).fontColor($r('app.color.text_secondary'))
                .margin({ top: 4 })
            }
          } else {
            Text('已是最新版本')
              .fontSize(13).fontColor($r('app.color.text_secondary'))
          }
        }
        .width('100%')
        .alignItems(HorizontalAlign.Center)
        .margin({ top: 8 })
      }
    }
    .width('90%')
    .padding(20)
    .backgroundColor($r('app.color.bg_card'))
    .borderRadius(20)
    .shadow({ radius: 32, color: 'rgba(0,0,0,0.2)', offsetX: 0, offsetY: 8 })
    .position({ x: '5%', y: 72 })
    .zIndex(100)
  }

  @Builder
  UpdatePopup(info: UpdateInfo): void {
    Stack({ alignContent: Alignment.Center }) {
      Column() {
        Text('发现新版本')
          .fontSize(22).fontWeight(FontWeight.Bold)
          .fontColor($r('app.color.text_primary'))
          .margin({ bottom: 12 })

        Row() {
          Text(`v${info.currentVersion}`)
            .fontSize(15).fontColor($r('app.color.text_secondary'))
          Text('  至  ')
            .fontSize(15).fontColor($r('app.color.text_secondary'))
          Text(`v${info.latestVersion}`)
            .fontSize(18).fontWeight(FontWeight.Bold).fontColor('#34C759')
        }
        .margin({ bottom: 16 })

        if (info.note.length > 0) {
          Text(info.note)
            .fontSize(14).fontColor($r('app.color.text_secondary'))
            .textAlign(TextAlign.Center)
            .margin({ bottom: 20 })
        }

        if (info.downloadUrl.length > 0) {
          Button('下载最新版本')
            .width('100%').height(48)
            .fontSize(16)
            .fontColor($r('app.color.accent_text'))
            .backgroundColor($r('app.color.accent'))
            .borderRadius(12)
            .margin({ bottom: 10 })
            .onClick(() => {
              const ctx = getContext(this) as common.UIAbilityContext
              const want: Want = { action: 'ohos.want.action.viewData', uri: info.downloadUrl }
              ctx.startAbility(want)
            })
        }

        Button('稍后再说')
          .width('100%').height(40)
          .fontSize(14)
          .fontColor($r('app.color.text_secondary'))
          .backgroundColor(Color.Transparent)
          .border({ width: 1, color: $r('app.color.border') })
          .borderRadius(12)
          .onClick(() => this.startupUpdate = null)
      }
      .width('85%')
      .padding(28)
      .backgroundColor($r('app.color.bg_card'))
      .borderRadius(20)
      .shadow({ radius: 48, color: 'rgba(0,0,0,0.3)', offsetX: 0, offsetY: 12 })
    }
    .width('100%')
    .height('100%')
    .backgroundColor('rgba(0,0,0,0.6)')
    .zIndex(200)
  }
}
