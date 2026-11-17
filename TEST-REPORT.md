# Leafbook 制作器 v1.2 本地测试报告

测试时间：2026-11-17（Linux VM，Node）
运行命令：`node test/logic-test.js`（即 `npm test`）

## 通过（38 项）

- JS 语法：`node --check` 通过 src/main.js、preload.js、renderer.js、sizes.js、backgrounds.js、quality.js、exporter.js（7 项）
- package.json 可解析（JSON 有效），版本号为 1.2.0（2 项）
- 尺寸模块（4 项）：比例预设齐全（3:4 / 4:3 / 16:9 / 9:16 / A4竖 / A4横 / 1:1 / 自定义）；
  像素预设与比例挂钩（9:16→1080×1920、A4竖→1240×1754、1:1→1080×1080）；
  描述文案正确；自定义宽高校验生效
- 导出逻辑（8 项）：用 3 张 1×1 PNG + 假音乐 dataURL 构造 1080×1920 竖版项目，断言通过：
  - 含正确尺寸（data-page-width/height、PW/PH、注释中的 1080x1920）
  - 含「开启音乐/暂停音乐」与内嵌音频；无音乐项目不渲染按钮与 audio 标签
  - 内嵌 StPageFlip 源码（vendor/page-flip@2.0.7，MIT）且含 `new St.PageFlip` / `loadFromHTML`
  - 书籍页 3 个 + 图文页 3 个，图片 dataURL 共 6 处（双模式各一份）
  - 含 Book/Story 切换与页码「1 / 3」；图片 CSS 为 object-fit:contain（不裁剪）
  - 页面标题做了 HTML 转义（防注入）
- 阅读背景与新阅读器（8 项，v1.1）：
  - 5 个预设（sakura 樱花庭院 / wooddesk 深色木桌 / lake 湖畔晨光 / paper 纯色纸纹 / night 夜读）齐全且均为多层渐变
  - 每个预设的场景 CSS 都完整进入导出 HTML（data-bg-preset + CSS 原文各一份）
  - 自定义纯色背景（#123456）进入导出（data-bg-type="color"）
  - 自定义背景图 dataURL 内嵌导出，且场景层带 blur 虚化处理
  - 老项目无 readerBackground 字段时默认樱花庭院，不崩
  - 顶栏含书图标、书名与音乐胶囊（music-pill / 背景音乐）
  - 底部含圆形上一页/下一页按钮（nav-circle）与深色胶囊页码（counter-pill）
  - 书本外框 book-frame 及其大投影 CSS 在导出中
- v1.2 新增（9 项）：
  - 清晰度预设值正确：高清 JPEG 0.85 / 长边 1700、标准 0.75 / 1400、小文件 0.6 / 1100（src/quality.js），未知 id 回退标准
  - 长边缩放只缩不放（2480×3508 → 1202×1700），体积格式化输出 MB
  - 封面模式开：导出含 `showCover:true`；关或缺省：不含
  - 导出含翻页纸声：`id="soundBtn"` 开关 + Web Audio `AudioContext` / `createBuffer` 合成噪声（无音频素材）
  - 导出含全屏按钮 `id="fsBtn"`（requestFullscreen / exitFullscreen）
  - 导出含键盘翻页（keydown + ArrowRight / ArrowLeft）
  - vendor pdf.js 齐全：pdf.min.js > 200KB、pdf.worker.min.js > 500KB（实测约 313KB / 1.1MB，pdfjs-dist@3.11.174），含 pdfjsLib 全局与 Apache-2.0 许可文件
  - PDF 导入接线齐全：index.html 引用 vendor/pdf.min.js 且有「导入 PDF」按钮；renderer 用 pdfjsLib + GlobalWorkerOptions.workerSrc + getDocument；main/preload 有 import-pdf / importPDF
- 示例导出文件：test/sample-export.html（59,415 字节，樱花庭院场景）

## 本地无法验证（需后续环节）

- **PDF 导入的 GUI 流程未实测**：本机无 Electron 图形环境，pdf.js 在编辑器里
  逐页栅格化、进度提示、失败提示只做了接线级断言（vendor 文件、API 引用、
  IPC 通道），未在真实 App 窗口里打开一个 PDF 验证。
- **导出清晰度的实际重编码未实测**：重编码走浏览器 Canvas（渲染进程），
  Node 测试只覆盖预设数值与长边缩放公式；预估体积为 dataURL 长度近似值。
- **封面模式 / 翻页音效 / 全屏的真实观感未验**：导出 HTML 里的标记与脚本已断言，
  但 showCover 的双页观感、纸声听感、全屏行为需在浏览器/微信里实机确认。
- **DMG 构建**：本机是 Linux，无法打 macOS DMG；靠 GitHub Actions（macos-latest）
  跑 `.github/workflows/build-dmg.yml` 验证，本地未声称已构建。
- **编辑器 GUI 实跑**：无 Mac 图形环境，Electron 界面未实机打开验证；
  逻辑层（尺寸、背景、导出、清晰度预设）已测，界面接线按代码审查确认。
- **微信真机**：导出 H5 在 iPhone / 安卓微信内的音乐播放、翻页手感、
  场景背景与书框的实际观感未验证，需发布到 GitHub Pages 后真机测试。
- 图标 build/icon.png 为程序生成的占位图（绿底书+叶），可后续换正式设计图。
