/* Leafbook 页面尺寸 / 比例预设（编辑器与导出共用，UMD：浏览器 + Node 均可加载） */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LeafbookSizes = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 比例预设：value = 宽/高
  var RATIOS = [
    { id: '3:4',    label: '3:4 竖版',   ratio: 3 / 4,        orientation: 'portrait' },
    { id: '4:3',    label: '4:3 横版',   ratio: 4 / 3,        orientation: 'landscape' },
    { id: '16:9',   label: '16:9 横版',  ratio: 16 / 9,       orientation: 'landscape' },
    { id: '9:16',   label: '9:16 竖版',  ratio: 9 / 16,       orientation: 'portrait' },
    { id: 'a4p',    label: 'A4 竖版 (1:√2)', ratio: 1 / Math.SQRT2, orientation: 'portrait' },
    { id: 'a4l',    label: 'A4 横版 (√2:1)', ratio: Math.SQRT2,     orientation: 'landscape' },
    { id: '1:1',    label: '1:1 方形',   ratio: 1,            orientation: 'square' },
    { id: 'custom', label: '自定义',     ratio: null,         orientation: null }
  ];

  // 与比例挂钩的推荐像素尺寸（选比例后可选）
  var PIXEL_PRESETS = {
    '3:4':  [ { w: 1080, h: 1440 }, { w: 1240, h: 1653 }, { w: 900, h: 1200 } ],
    '4:3':  [ { w: 1440, h: 1080 }, { w: 1600, h: 1200 }, { w: 1200, h: 900 } ],
    '16:9': [ { w: 1920, h: 1080 }, { w: 1280, h: 720 } ],
    '9:16': [ { w: 1080, h: 1920 }, { w: 1125, h: 2000 }, { w: 720, h: 1280 } ],
    'a4p':  [ { w: 1240, h: 1754 }, { w: 2480, h: 3508 } ],
    'a4l':  [ { w: 1754, h: 1240 }, { w: 3508, h: 2480 } ],
    '1:1':  [ { w: 1080, h: 1080 }, { w: 1440, h: 1440 } ],
    'custom': []
  };

  function ratioById(id) {
    for (var i = 0; i < RATIOS.length; i++) if (RATIOS[i].id === id) return RATIOS[i];
    return RATIOS[RATIOS.length - 1];
  }

  function orientationOf(w, h) {
    if (w === h) return 'square';
    return w > h ? 'landscape' : 'portrait';
  }

  function orientationLabel(o) {
    return o === 'landscape' ? '横版' : (o === 'square' ? '方形' : '竖版');
  }

  // 把比例格式化为简洁字符串，如 9:16 / 3:4 / 1.41:1
  function ratioText(w, h) {
    function gcd(a, b) { return b ? gcd(b, a % b) : a; }
    var g = gcd(Math.round(w), Math.round(h));
    var sw = Math.round(w) / g, sh = Math.round(h) / g;
    if (sw <= 32 && sh <= 32) return sw + ':' + sh;
    var r = w / h;
    return (r >= 1 ? r.toFixed(2) + ':1' : '1:' + (1 / r).toFixed(2));
  }

  function describe(w, h) {
    return '页面尺寸：' + w + ' × ' + h + ' px · ' + ratioText(w, h) + ' ' + orientationLabel(orientationOf(w, h));
  }

  function validate(w, h) {
    if (!Number.isFinite(w) || !Number.isFinite(h)) return '宽和高必须是数字';
    if (Math.round(w) !== w || Math.round(h) !== h) return '宽和高必须是整数像素';
    if (w < 100 || h < 100) return '宽和高不能小于 100 px';
    if (w > 6000 || h > 6000) return '宽和高不能大于 6000 px';
    return null;
  }

  return {
    RATIOS: RATIOS,
    PIXEL_PRESETS: PIXEL_PRESETS,
    ratioById: ratioById,
    orientationOf: orientationOf,
    orientationLabel: orientationLabel,
    ratioText: ratioText,
    describe: describe,
    validate: validate
  };
});
