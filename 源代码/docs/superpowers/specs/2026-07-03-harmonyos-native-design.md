# PhiMystra 鸿蒙版设计文档

## 概述

使用 ArkTS + ArkUI 开发 HarmonyOS 原生应用，完全独立的 UI 层，共享核心制谱逻辑。

## 技术栈

- ArkTS（TypeScript 超集）
- ArkUI 声明式 UI 框架
- HarmonyOS SDK API 12+
- 构建工具：hvigor + GitHub Actions

## 项目结构

```
harmonyos/
  entry/src/main/
    ets/
      pages/
        Index.ets                  # 主页面（单页应用）
      components/
        AudioImporter.ets          # 音频/视频导入
        OnsetViewer.ets            # 节奏点可视化
        ChartInfoEditor.ets        # 谱面信息编辑
        DifficultySelector.ets     # 难度选择
        ChartPlayer.ets            # Canvas 谱面预览
        ChartInfo.ets              # 谱面统计信息
        RecentList.ets             # 最近生成列表
        SettingsPanel.ets          # 设置面板（含主题切换）
        UpdatePopup.ets            # 更新弹窗
      utils/
        audioAnalysis.ets          # BPM检测+onset检测（移植）
        noteGenerator.ets          # 音符生成（移植）
        chartBuilder.ets           # 谱面构建（移植）
        pezExporter.ets            # PEZ导出（移植）
        audioDecoder.ets           # 音频解码（鸿蒙API重写）
        updater.ets                # 更新检查（鸿蒙HTTP）
        theme.ets                  # 主题管理
        storage.ets                # 本地存储（preferences）
      types/
        chart.ets                  # 类型定义
    resources/
      base/
        media/                     # 图标资源
        element/
          color.json               # 配色定义
          string.json              # 字符串
      dark/
        element/
          color.json               # 暗色模式配色
  config.json
  build-profile.json5
```

## 主题系统

### 三种模式
- `light` — 浅色模式
- `dark` — 深色模式
- `system` — 跟随系统（默认）

### 实现
- 使用 `@ohos.data.preferences` 持久化用户选择
- `system` 模式监听 `ConfigurationConstant.ColorMode`
- 全局通过 `AppStorage` 共享当前配色
- ArkUI 的 `$r('app.color.xxx')` 自动适配深浅色资源

### 配色方案

| 元素 | 浅色 | 深色 |
|---|---|---|
| 背景 | #F1F3F5 | #000000 |
| 卡片 | #FFFFFF | #18212A |
| 主文字 | #18242E | #E6E6E6 |
| 次文字 | #99A4B0 | #9CA3AF |
| 强调色 | #007DFF | #0A59F7 |
| 按钮主色 | #007DFF | #0A59F7 |
| 按钮文字 | #FFFFFF | #FFFFFF |
| 边框 | #E5E7EB | #2D3A4A |
| 危险色 | #FA2A2D | #FF4D4F |

## 鸿蒙设计规范

### 按钮
- 主按钮：圆角 20px，高度 48px，HarmonyOS Blue 底色
- 次按钮：圆角 20px，透明底 + 边框
- 文字按钮：无边框，强调色文字
- 按压效果：scale(0.98) + 透明度变化，spring 动画

### 卡片
- 圆角 16px
- 浅色：白色底 + 微弱阴影（elevation 2）
- 深色：#18212A 底，无边框
- 内边距 16-20px

### 图标
- 线性风格，描边宽度 2px
- 尺寸：小 20px / 中 24px / 大 32px
- 颜色跟随当前文字色或强调色

### 列表项
- 高度 ≥56px
- 左侧图标 + 文字，右侧箭头/操作
- 分隔线：1px，颜色 #E5E7EB / #2D3A4A

### 动画
- 页面切换：150ms ease-in-out
- 按钮按压：spring(curveSpring(0.8, 0.4))
- 列表项入场：200ms，从右侧滑入 + 渐显

## 核心逻辑移植

### 直接移植（纯数学，改动极小）
- `bpmEstimation.ts` → `bpmEstimation.ets`
- `onsetDetection.ts` → `onsetDetection.ets`
- `noteGenerator.ts` → `noteGenerator.ets`
- `chartBuilder.ts` → `chartBuilder.ets`
- `difficultyParams.ts` → `difficultyParams.ets`
- `rpeTypes.ts` → `types/chart.ets`

改动点：
- `import` 语法微调
- 去除 Web API 依赖（无 `AudioContext`）
- 类型声明从 `.ts` 改为 `.ets`

### 需要重写（平台 API 差异）
- 音频解码：`@ohos.multimedia.media` AVMetadataExtractor 或 SoundPool
- PEZ 导出 ZIP：`@ohos.zlib` 压缩 API
- HTTP 请求：`@ohos.net.http`
- 文件读写：`@ohos.file.fs`
- 本地存储：`@ohos.data.preferences`
- 系统分享：`@ohos.app.ability.common` Want API

## 功能对齐

与安卓版一致：
- [x] 音频导入（mp3/wav/ogg/flac/m4a）
- [x] 视频转音频
- [x] 节奏分析 + BPM 检测
- [x] 难度选择 + 玩法选择
- [x] 谱面信息编辑
- [x] 背景图片导入
- [x] 谱面预览（Canvas）
- [x] PEZ 导出 + 分享到 Phira
- [x] 最近生成记忆（7天）
- [x] 更新检查
- [x] 单级返回

鸿蒙独有：
- [x] 主题模式切换（浅色/深色/跟随系统）
- [x] HarmonyOS 原生设计美学

## 构建

GitHub Actions 流水线：
1. Ubuntu runner
2. 下载 HarmonyOS SDK + 命令行工具
3. hvigor assembleHap
4. 签名（需要鸿蒙开发者证书）
5. 上传 .hap 到 Release

## 版本号

与安卓版独立：`versionHarmony` 字段在 update.json 中维护。
APP_VERSION 初始为 `0.1.0`（鸿蒙版独立版本线）。
