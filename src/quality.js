/* Leafbook 导出清晰度预设（UMD：编辑器 + Node 测试共用）。
   导出前在渲染进程把每页图按预设重编码为 JPEG：
   - quality：JPEG 质量（0~1）
   - cap：页面长边像素上限（页面画布按比例缩放，长边不超过 cap） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LeafbookQuality = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PRESETS = [
    { id: 'hd',    label: '高清',   jpegQuality: 0.85, cap: 1700 },
    { id: 'std',   label: '标准',   jpegQuality: 0.75, cap: 1400 },
    { id: 'small', label: '小文件', jpegQuality: 0.6,  cap: 1100 }
  ];
  var DEFAULT_ID = 'std';

  function qualityById(id) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
    return PRESETS[1];
  }

  // 按 cap 计算重编码后的页面画布尺寸（只缩不放，长边不超过 cap）
  function targetSize(w, h, cap) {
    var longSide = Math.max(w, h);
    if (!longSide || longSide <= cap) return { w: Math.round(w), h: Math.round(h) };
    var s = cap / longSide;
    return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
  }

  // dataURL 长度合计 → 预计文件大小的字节数粗估（base64 约 3/4 为二进制体积，
  // 这里直接按字符串长度近似展示，够给用户判断量级）
  function estimateBytes(totalDataUrlLength, extraBytes) {
    return Math.round(totalDataUrlLength * 0.99) + (extraBytes || 0);
  }

  function formatSize(bytes) {
    if (!Number.isFinite(bytes) || bytes < 0) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }

  return {
    PRESETS: PRESETS,
    DEFAULT_ID: DEFAULT_ID,
    qualityById: qualityById,
    targetSize: targetSize,
    estimateBytes: estimateBytes,
    formatSize: formatSize
  };
});
