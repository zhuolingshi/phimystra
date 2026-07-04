# v0.1.3.001 — 视频转音频 + Windows 更新渠道

## 概述

在现有音频导入功能基础上，新增视频文件导入能力，自动提取音轨用于制谱。同时为 Windows 平台添加专用更新下载渠道。

## 功能一：视频转音频

### 原理

利用 WebView 内置的 `AudioContext.decodeAudioData()` API 解码视频文件的音轨。Tauri 的 WebView 引擎（Linux WebKitGTK / Android Chromium / Windows WebView2）均支持 MP4/WebM 容器中常见音频编码（AAC、Opus、Vorbis）的解码，可瞬间提取音频，无需额外安装 ffmpeg。

### 支持格式

mp4, m4v, webm, mkv, mov, avi

### 用户流程

1. 用户点击「导入视频」按钮（或拖拽视频文件）
2. 系统文件选择器筛选视频文件（`accept="video/*"` 移动端 / `.mp4,.webm,...` 桌面端）
3. 读取文件为 ArrayBuffer
4. 调用 `decodeAudioData()` 提取音轨
5. 成功 → 显示音频信息，进入制谱流程
6. 失败 → 提示「该视频格式不支持，请转换为 mp3/m4a 后导入」

### 实现变更

#### `audioDecoder.ts`

- 新增 `SUPPORTED_VIDEO_FORMATS` 数组
- 新增 `isSupportedVideoFormat(filename, mimeType)` 函数
- 新增 `extractAudioFromVideo(file, name)` 函数：
  - 读取 ArrayBuffer
  - 调用 `decodeAudioData()`
  - 返回与 `decodeAudioFile` 相同的 `DecodedAudio` 结构

#### `AudioImporter.tsx`

- 在音频导入区域下方新增「导入视频」按钮
- 新增隐藏的 `<input type="file" accept="video/*">` 
- 复用现有 `handleFile` 逻辑，增加视频格式分支
- 提取过程中显示「正在从视频提取音频...」

## 功能二：Windows 更新渠道

### update.json 结构

```json
{
  "version": "0.1.3.001",
  "url": "https://gh-proxy.com/.../releases/tag/v0.1.3.001",
  "urlAndroid": "https://gh-proxy.com/.../PhiMystra_0.1.3.001_android_universal.apk",
  "urlWindows": "https://gh-proxy.com/.../PhiMystra_0.1.3.001_windows_x64.exe",
  "note": "..."
}
```

### updater.ts 变更

平台检测逻辑：
```
Android → urlAndroid
Windows → urlWindows
其他    → url
```

## 版本号

- `updater.ts` APP_VERSION → `0.1.3.001`
- `tauri.conf.json` version → `0.1.3.001`

## 构建

- Linux: `npx tauri build --bundles deb`
- Android: `npx tauri android build --apk` + 签名
- Windows: 交叉编译 `x86_64-pc-windows-gnu` 便携版 .exe

## 测试

- 现有 72 个测试不受影响（纯新增功能）
- 手动测试视频导入流程
