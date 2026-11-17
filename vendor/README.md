# vendor 说明

- `page-flip.browser.min.js`：StPageFlip 翻页库，来自 npm 包 `page-flip@2.0.7`
  （GitHub: Nodlik/StPageFlip），MIT 许可，许可全文见 `page-flip-LICENSE.txt`。
- `pdf.min.js` + `pdf.worker.min.js`：PDF.js 3.11.174，来自 npm 包
  `pdfjs-dist@3.11.174`（Mozilla），Apache-2.0 许可，许可全文见 `pdfjs-LICENSE.txt`。
  只在制作器里用：把导入的 PDF 逐页栅格化成图片页；导出的 H5 不含 pdf.js。
- 本地内置、不外链 CDN：制作器离线可用，导出的 H5 也把 StPageFlip 源码内嵌进
  单个 HTML，在微信里打开不依赖任何外部服务器。
