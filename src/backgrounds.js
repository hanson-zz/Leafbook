/* Leafbook 阅读背景（场景）模块：编辑器预览与导出 H5 共用同一套定义，UMD。
   项目字段 project.readerBackground = {
     type: 'preset' | 'color' | 'image',
     presetId: 预设 id, color: '#rrggbb',
     image: dataURL | null, imageName: string | null
   }
   预设场景全部用多层 CSS 渐变拼出虚化的实景感，不依赖任何外部图片。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LeafbookBackgrounds = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var PRESETS = [
    {
      id: 'sakura', name: '樱花庭院', dark: false,
      css: 'radial-gradient(ellipse 60% 45% at 12% 6%, rgba(255,178,203,.95), rgba(255,178,203,0) 62%),'
        + 'radial-gradient(ellipse 52% 40% at 90% 10%, rgba(255,208,222,.9), rgba(255,208,222,0) 60%),'
        + 'radial-gradient(ellipse 55% 52% at 86% 88%, rgba(163,196,138,.78), rgba(163,196,138,0) 66%),'
        + 'radial-gradient(ellipse 46% 42% at 8% 92%, rgba(188,214,158,.72), rgba(188,214,158,0) 62%),'
        + 'radial-gradient(ellipse 70% 55% at 50% 55%, rgba(255,244,230,.55), rgba(255,244,230,0) 70%),'
        + 'linear-gradient(158deg, #fdf3ec 0%, #f7ddd3 34%, #e3ebcf 74%, #cbdfba 100%)'
    },
    {
      id: 'wooddesk', name: '深色木桌', dark: true,
      css: 'radial-gradient(ellipse 95% 68% at 50% 26%, rgba(150,106,62,.55), rgba(150,106,62,0) 70%),'
        + 'repeating-linear-gradient(93deg, rgba(0,0,0,.17) 0 2px, rgba(0,0,0,0) 2px 92px),'
        + 'repeating-linear-gradient(90deg, #4b3320 0 138px, #543a24 138px 276px, #452f1d 276px 414px),'
        + 'linear-gradient(180deg, #5c3f27 0%, #3a2716 58%, #281809 100%)'
    },
    {
      id: 'lake', name: '湖畔晨光', dark: false,
      css: 'radial-gradient(ellipse 52% 38% at 79% 14%, rgba(255,213,138,.96), rgba(255,213,138,0) 62%),'
        + 'radial-gradient(ellipse 72% 55% at 18% 88%, rgba(88,138,190,.55), rgba(88,138,190,0) 66%),'
        + 'radial-gradient(ellipse 80% 46% at 50% 108%, rgba(70,110,160,.5), rgba(70,110,160,0) 70%),'
        + 'linear-gradient(180deg, #bcd9ee 0%, #f4d9a9 42%, #a9c5df 72%, #7ea2c7 100%)'
    },
    {
      id: 'paper', name: '纯色纸纹', dark: false,
      css: 'radial-gradient(ellipse 82% 62% at 30% 18%, rgba(255,255,255,.75), rgba(255,255,255,0) 62%),'
        + 'repeating-linear-gradient(0deg, rgba(178,148,108,.055) 0 2px, rgba(178,148,108,0) 2px 5px),'
        + 'repeating-linear-gradient(90deg, rgba(178,148,108,.04) 0 2px, rgba(178,148,108,0) 2px 6px),'
        + 'linear-gradient(150deg, #f8f2e4 0%, #f0e5cf 55%, #e8dabf 100%)'
    },
    {
      id: 'night', name: '夜读', dark: true,
      css: 'radial-gradient(ellipse 72% 50% at 50% 26%, rgba(96,108,132,.55), rgba(96,108,132,0) 70%),'
        + 'radial-gradient(ellipse 60% 45% at 82% 90%, rgba(52,60,84,.5), rgba(52,60,84,0) 66%),'
        + 'linear-gradient(180deg, #24262e 0%, #14151b 58%, #0c0d11 100%)'
    }
  ];

  var DEFAULT_PRESET = 'sakura';

  function presetById(id) {
    for (var i = 0; i < PRESETS.length; i++) if (PRESETS[i].id === id) return PRESETS[i];
    return PRESETS[0];
  }
  function cssForPreset(id) { return presetById(id).css; }

  function defaultBackground() {
    return { type: 'preset', presetId: DEFAULT_PRESET, color: '#f5e6da', image: null, imageName: null };
  }

  function normalize(rb) {
    var d = defaultBackground();
    if (!rb || typeof rb !== 'object') return d;
    var out = {
      type: rb.type === 'color' || rb.type === 'image' ? rb.type : 'preset',
      presetId: presetById(rb.presetId || DEFAULT_PRESET).id,
      color: typeof rb.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(rb.color) ? rb.color : d.color,
      image: typeof rb.image === 'string' && rb.image.indexOf('data:image/') === 0 ? rb.image : null,
      imageName: typeof rb.imageName === 'string' ? rb.imageName : null
    };
    if (out.type === 'image' && !out.image) out.type = 'preset';
    return out;
  }

  // hex 颜色相对亮度（0~1），用于判断场景明暗
  function luminance(hex) {
    var m = /^#?([0-9a-fA-F]{6})$/.exec(hex || '');
    if (!m) return 0.5;
    var n = parseInt(m[1], 16);
    var r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // 场景是深色还是浅色（决定顶栏/按钮文字用白还是深色）
  function isDark(rb) {
    var b = normalize(rb);
    if (b.type === 'image') return true; // 图片层会压暗处理
    if (b.type === 'color') return luminance(b.color) < 0.55;
    return !!presetById(b.presetId).dark;
  }

  /* 场景层（fx 层）的 style.cssText：图层比容器略大（inset:-24px），
     自定义图片带模糊+压暗，模糊边缘被放大溢出藏住，书本始终清晰可读。 */
  function layerStyle(rb) {
    var b = normalize(rb);
    if (b.type === 'image') {
      return 'background-image:url("' + b.image + '");background-size:cover;background-position:center;'
        + 'filter:blur(7px) brightness(.8) saturate(1.06);transform:scale(1.07);';
    }
    if (b.type === 'color') return 'background:' + b.color + ';';
    return 'background:' + cssForPreset(b.presetId) + ';';
  }

  // 把场景应用到某个 fx 层元素（编辑器预览用；导出端直接把 layerStyle 写进 HTML）
  function applyScene(fxEl, rb) {
    if (!fxEl) return;
    fxEl.style.cssText = layerStyle(rb);
  }

  return {
    PRESETS: PRESETS,
    DEFAULT_PRESET: DEFAULT_PRESET,
    presetById: presetById,
    cssForPreset: cssForPreset,
    defaultBackground: defaultBackground,
    normalize: normalize,
    luminance: luminance,
    isDark: isDark,
    layerStyle: layerStyle,
    applyScene: applyScene
  };
});
