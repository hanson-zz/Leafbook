'use strict';
/* Leafbook 编辑器渲染逻辑 */
var S = window.LeafbookSizes;
var B = window.LeafbookBackgrounds;
var Q = window.LeafbookQuality;
var X = window.LeafbookExporter;
var api = window.leafbookAPI;

var project = null;      // 当前项目
var selected = 0;        // 当前页下标
var previewMode = 'book';
var flip = null;
var flipGuard = false;   // 程序设置翻页时避免回环
var pageFlipSrcCache = null;

function $(id) { return document.getElementById(id); }
function toast(msg) {
  var t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2600);
}
function defaultProject() {
  return {
    app: 'leafbook', version: 1,
    name: '我的电子书',
    width: 1080, height: 1440, ratioId: '3:4', ratioLabel: '3:4',
    orientation: 'portrait', background: '#ffffff',
    readerBackground: B.defaultBackground(),
    coverMode: false,
    music: null, pages: []
  };
}

/* ---------- 尺寸选择组件（新建面板与设置区共用） ---------- */
function createSizeBox(container, init) {
  var st = { ratioId: init.ratioId || '3:4', w: init.width || 1080, h: init.height || 1440 };
  container.classList.add('sizebox');
  container.innerHTML =
    '<div class="orient-row">'
    + '<button type="button" data-o="portrait">竖版</button>'
    + '<button type="button" data-o="landscape">横版</button>'
    + '<button type="button" data-o="square">方形</button></div>'
    + '<label>比例<select class="sb-ratio"></select></label>'
    + '<label>推荐像素尺寸<select class="sb-pixel"></select></label>'
    + '<div class="wh-row"><label>宽（px）<input class="sb-w" type="text" inputmode="numeric"></label>'
    + '<label>高（px）<input class="sb-h" type="text" inputmode="numeric"></label></div>'
    + '<div class="size-now"></div>';
  var ratioSel = container.querySelector('.sb-ratio');
  var pixelSel = container.querySelector('.sb-pixel');
  var wIn = container.querySelector('.sb-w'), hIn = container.querySelector('.sb-h');
  var nowEl = container.querySelector('.size-now');
  var orientBtns = container.querySelectorAll('.orient-row button');

  function curOrient() { return S.ratioById(st.ratioId).orientation || S.orientationOf(st.w, st.h); }
  function fillRatios(orient) {
    ratioSel.innerHTML = '';
    S.RATIOS.forEach(function (r) {
      if (r.id !== 'custom' && orient && r.orientation !== orient) return;
      var o = document.createElement('option'); o.value = r.id; o.textContent = r.label;
      ratioSel.appendChild(o);
    });
    ratioSel.value = st.ratioId;
  }
  function fillPixels() {
    var list = S.PIXEL_PRESETS[st.ratioId] || [];
    pixelSel.innerHTML = '';
    list.forEach(function (p) {
      var o = document.createElement('option'); o.value = p.w + 'x' + p.h;
      o.textContent = p.w + ' × ' + p.h + ' px'; pixelSel.appendChild(o);
    });
    var custom = document.createElement('option'); custom.value = 'custom'; custom.textContent = '自定义（用下方宽高）';
    pixelSel.appendChild(custom);
    var match = list.some(function (p) { return p.w === st.w && p.h === st.h; });
    pixelSel.value = match ? (st.w + 'x' + st.h) : 'custom';
    pixelSel.disabled = list.length === 0;
  }
  function sync() {
    orientBtns.forEach(function (b) { b.classList.toggle('on', b.dataset.o === curOrient()); });
    wIn.value = st.w; hIn.value = st.h;
    nowEl.textContent = S.describe(st.w, st.h);
  }
  function applyRatio(id) {
    st.ratioId = id;
    var presets = S.PIXEL_PRESETS[id];
    if (presets && presets.length) { st.w = presets[0].w; st.h = presets[0].h; }
    fillRatios(S.ratioById(id).orientation);
    fillPixels(); sync();
  }
  orientBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      var o = b.dataset.o;
      var first = S.RATIOS.filter(function (r) { return r.orientation === o; })[0];
      if (first) applyRatio(first.id);
    });
  });
  ratioSel.addEventListener('change', function () { applyRatio(ratioSel.value); });
  pixelSel.addEventListener('change', function () {
    if (pixelSel.value === 'custom') return;
    var parts = pixelSel.value.split('x'); st.w = +parts[0]; st.h = +parts[1]; sync();
  });
  function whChanged() {
    var w = parseInt(wIn.value, 10), h = parseInt(hIn.value, 10);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      st.w = w; st.h = h;
      // 宽高与某个预设比例吻合时自动对齐比例选择，否则记为自定义
      var matched = null;
      S.RATIOS.forEach(function (r) {
        if (r.ratio && Math.abs(w / h - r.ratio) < 0.01) matched = r.id;
      });
      st.ratioId = matched || 'custom';
      fillRatios(S.orientationOf(w, h)); fillPixels(); sync();
    }
  }
  wIn.addEventListener('change', whChanged);
  hIn.addEventListener('change', whChanged);

  fillRatios(curOrient()); fillPixels(); sync();

  return {
    get: function () {
      var w = parseInt(wIn.value, 10), h = parseInt(hIn.value, 10);
      var err = S.validate(w, h);
      if (err) return { error: err };
      var r = S.ratioById(st.ratioId);
      return {
        width: w, height: h, ratioId: st.ratioId,
        ratioLabel: st.ratioId === 'custom' ? S.ratioText(w, h) : r.id === 'a4p' ? 'A4竖版 1:√2' : r.id === 'a4l' ? 'A4横版 √2:1' : r.id,
        orientation: S.orientationOf(w, h)
      };
    },
    set: function (p) {
      st = { ratioId: p.ratioId || 'custom', w: p.width, h: p.height };
      fillRatios(curOrient()); fillPixels(); sync();
    }
  };
}

var newSizeBox = createSizeBox($('newSizeBox'), { ratioId: '3:4', width: 1080, height: 1440 });
var setSizeBox = createSizeBox($('setSizeBox'), { ratioId: '3:4', width: 1080, height: 1440 });

/* ---------- 预览 ---------- */
function fitSize() {
  var stage = $('stage');
  var aw = stage.clientWidth - 82, ah = stage.clientHeight - 78; // 留出书框内边距+场景边距
  var s = Math.min(aw / project.width, ah / project.height);
  return { w: Math.max(140, Math.floor(project.width * s)), h: Math.max(140, Math.floor(project.height * s)) };
}
function pageInnerHTML(p) {
  var bg = p.bg || project.background || '#fff';
  var html = '';
  if (p.image) html += '<img src="' + p.image + '" alt="">';
  if ((p.title && p.title.trim()) || (p.body && p.body.trim())) {
    html += '<div class="pv-cap">' + (p.title ? '<b>' + X.esc(p.title) + '</b>' : '')
      + (p.body ? '<span>' + X.esc(p.body) + '</span>' : '') + '</div>';
  }
  return '<div class="pv-inner" style="background:' + bg + '">' + html + '</div>';
}
function renderPreview() {
  var has = project.pages.length > 0;
  $('stageEmpty').style.display = has ? 'none' : 'block';
  $('pvCounter').textContent = has ? (selected + 1) + ' / ' + project.pages.length : '0 / 0';
  var d = fitSize();
  if (previewMode === 'book') {
    $('bookFrame').style.display = has ? 'flex' : 'none'; $('storyHost').style.display = 'none';
    $('stageHint').textContent = '书籍模式：拖动页角翻页（真实纸张卷曲效果）';
    if (flip) { try { flip.destroy(); } catch (e) {} flip = null; }
    var host = $('bookHost'); host.innerHTML = '';
    if (!has) return;
    project.pages.forEach(function (p) {
      var div = document.createElement('div');
      div.className = 'page'; div.innerHTML = pageInnerHTML(p);
      div.firstChild.style.width = '100%'; div.firstChild.style.height = '100%';
      div.firstChild.style.boxShadow = 'none';
      host.appendChild(div);
    });
    flip = new St.PageFlip(host, {
      width: d.w, height: d.h, size: 'fixed',
      minWidth: d.w, maxWidth: d.w, minHeight: d.h, maxHeight: d.h,
      showCover: !!project.coverMode, maxShadowOpacity: 0.55, mobileScrollSupport: false,
      swipeDistance: 18, clickEventZoom: false, usePortrait: true, startPage: selected
    });
    flip.loadFromHTML(host.querySelectorAll('.page'));
    flip.on('flip', function (e) {
      if (flipGuard) return;
      selectPage(e.data, false);
    });
  } else {
    $('bookFrame').style.display = 'none'; $('storyHost').style.display = 'block';
    $('stageHint').textContent = '图文模式：上下滑动逐页看（导出后在微信里同样可用）';
    var sh = $('storyHost'); sh.innerHTML = '';
    project.pages.forEach(function (p, i) {
      var cell = document.createElement('div'); cell.className = 'story-cell';
      cell.innerHTML = pageInnerHTML(p);
      var inner = cell.firstChild;
      inner.style.width = d.w + 'px'; inner.style.height = d.h + 'px';
      cell.addEventListener('click', function () { selectPage(i, false); });
      sh.appendChild(cell);
    });
    var cellEl = sh.children[selected];
    if (cellEl) cellEl.scrollIntoView();
  }
}

/* ---------- 页面列表 / 属性 ---------- */
function renderThumbs() {
  var list = $('thumbList'); list.innerHTML = '';
  $('pageCount').textContent = project.pages.length ? '（' + project.pages.length + ' 页）' : '';
  project.pages.forEach(function (p, i) {
    var div = document.createElement('div');
    div.className = 'thumb' + (i === selected ? ' sel' : '');
    if (p.image) {
      var img = document.createElement('img'); img.className = 'timg'; img.src = p.image; div.appendChild(img);
    } else {
      var ph = document.createElement('div'); ph.className = 'timg';
      ph.style.display = 'flex'; ph.style.alignItems = 'center'; ph.style.justifyContent = 'center';
      ph.style.color = '#999'; ph.style.fontSize = '12px'; ph.textContent = '空白页'; div.appendChild(ph);
    }
    var no = document.createElement('div'); no.className = 'tno'; no.textContent = '第 ' + (i + 1) + ' 页';
    div.appendChild(no);
    div.addEventListener('click', function () { selectPage(i, true); });
    list.appendChild(div);
  });
}
function renderProps() {
  var p = project.pages[selected];
  $('pgTitle').value = p ? (p.title || '') : '';
  $('pgBody').value = p ? (p.body || '') : '';
  $('pgBg').value = (p && p.bg) || project.background || '#ffffff';
  $('projBg').value = project.background || '#ffffff';
  $('musicName').textContent = project.music ? project.music.name : '未添加';
  $('sizeSummary').textContent = S.describe(project.width, project.height);
  $('coverMode').checked = !!project.coverMode;
  $('exportQuality').value = exportQualityId;
  renderBgPanel();
  updateEstimate();
}

/* ---------- 阅读背景（场景） ---------- */
function buildBgSwatches() {
  var box = $('bgPresets'); box.innerHTML = '';
  B.PRESETS.forEach(function (p) {
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'bg-swatch'; btn.dataset.preset = p.id;
    btn.innerHTML = '<span class="sw-thumb"></span>' + p.name;
    btn.querySelector('.sw-thumb').style.background = p.css;
    btn.addEventListener('click', function () {
      var rb = Object.assign({}, project.readerBackground, { type: 'preset', presetId: p.id });
      setReaderBackground(rb); toast('阅读背景：' + p.name);
    });
    box.appendChild(btn);
  });
}
function renderBgPanel() {
  if (!project) return;
  var rb = B.normalize(project.readerBackground);
  document.querySelectorAll('#bgPresets .bg-swatch').forEach(function (el) {
    el.classList.toggle('on', rb.type === 'preset' && el.dataset.preset === rb.presetId);
  });
  $('bgColor').value = rb.color;
  $('bgImageName').textContent = rb.type === 'image' ? (rb.imageName || '已导入') : '未导入';
  B.applyScene($('stageSceneFx'), rb);
}
function setReaderBackground(rb) {
  project.readerBackground = B.normalize(rb);
  renderBgPanel();
}
function renderAll() { renderThumbs(); renderProps(); renderPreview(); }
function selectPage(i, jumpFlip) {
  if (i < 0 || i >= project.pages.length) return;
  selected = i;
  renderThumbs(); renderProps();
  $('pvCounter').textContent = (selected + 1) + ' / ' + project.pages.length;
  if (previewMode === 'book' && flip && jumpFlip) {
    flipGuard = true; flip.flip(selected, 'read'); setTimeout(function () { flipGuard = false; }, 60);
  }
  if (previewMode === 'story') {
    var cellEl = $('storyHost').children[selected];
    if (cellEl) cellEl.scrollIntoView({ behavior: 'smooth' });
  }
}

/* ---------- 项目装载 ---------- */
function loadProject(p) {
  project = Object.assign(defaultProject(), p);
  project.coverMode = !!project.coverMode;
  project.readerBackground = B.normalize(project.readerBackground);
  if (!Array.isArray(project.pages)) project.pages = [];
  selected = 0;
  $('projName').value = project.name || '我的电子书';
  setSizeBox.set(project);
  renderAll();
}

/* ---------- 事件 ---------- */
$('projName').addEventListener('input', function () { project.name = $('projName').value; });
$('pgTitle').addEventListener('input', function () { var p = project.pages[selected]; if (p) { p.title = $('pgTitle').value; debouncePreview(); } });
$('pgBody').addEventListener('input', function () { var p = project.pages[selected]; if (p) { p.body = $('pgBody').value; debouncePreview(); } });
$('pgBg').addEventListener('input', function () { var p = project.pages[selected]; if (p) { p.bg = $('pgBg').value; debouncePreview(); renderThumbsSoon(); } });
$('pgBgClear').addEventListener('click', function () { var p = project.pages[selected]; if (p) { p.bg = null; renderAll(); } });
$('projBg').addEventListener('input', function () { project.background = $('projBg').value; debouncePreview(); });
var pvTimer = null;
function debouncePreview() { clearTimeout(pvTimer); pvTimer = setTimeout(renderPreview, 350); }
var thTimer = null;
function renderThumbsSoon() { clearTimeout(thTimer); thTimer = setTimeout(renderThumbs, 350); }

$('btnAddImages').addEventListener('click', async function () {
  var files = await api.importImages();
  if (!files.length) return;
  files.forEach(function (f) { project.pages.push({ image: f.dataUrl, title: '', body: '', bg: null }); });
  if (selected < 0) selected = 0;
  renderAll(); toast('已导入 ' + files.length + ' 页');
});
$('btnAddBlank').addEventListener('click', function () {
  project.pages.splice(selected + 1, 0, { image: null, title: '', body: '', bg: null });
  selected = selected + 1; renderAll();
});
$('btnDel').addEventListener('click', function () {
  if (!project.pages.length) return;
  project.pages.splice(selected, 1);
  selected = Math.max(0, Math.min(selected, project.pages.length - 1));
  renderAll();
});
$('btnUp').addEventListener('click', function () {
  if (selected <= 0) return;
  var t = project.pages[selected - 1]; project.pages[selected - 1] = project.pages[selected]; project.pages[selected] = t;
  selected--; renderAll();
});
$('btnDown').addEventListener('click', function () {
  if (selected >= project.pages.length - 1) return;
  var t = project.pages[selected + 1]; project.pages[selected + 1] = project.pages[selected]; project.pages[selected] = t;
  selected++; renderAll();
});
$('bgColor').addEventListener('input', function () {
  setReaderBackground(Object.assign({}, project.readerBackground, { type: 'color', color: $('bgColor').value }));
});
$('btnBgImage').addEventListener('click', async function () {
  var f = await api.importBackground();
  if (f) {
    setReaderBackground(Object.assign({}, project.readerBackground, { type: 'image', image: f.dataUrl, imageName: f.name }));
    toast('已导入背景图：' + f.name);
  }
});
$('btnBgImageDel').addEventListener('click', function () {
  setReaderBackground(Object.assign({}, project.readerBackground, { type: 'preset', image: null, imageName: null }));
});

$('btnMusic').addEventListener('click', async function () {
  var m = await api.importMusic();
  if (m) { project.music = m; renderProps(); toast('已添加音乐：' + m.name); }
});
$('btnMusicDel').addEventListener('click', function () { project.music = null; renderProps(); });

$('pvBook').addEventListener('click', function () { previewMode = 'book'; $('pvBook').classList.add('on'); $('pvStory').classList.remove('on'); renderPreview(); });
$('pvStory').addEventListener('click', function () { previewMode = 'story'; $('pvStory').classList.add('on'); $('pvBook').classList.remove('on'); renderPreview(); });
$('pvPrev').addEventListener('click', function () {
  if (previewMode === 'book' && flip) flip.flipPrev(); else selectPage(Math.max(0, selected - 1), true);
});
$('pvNext').addEventListener('click', function () {
  if (previewMode === 'book' && flip) flip.flipNext(); else selectPage(Math.min(project.pages.length - 1, selected + 1), true);
});

$('btnApplySize').addEventListener('click', function () {
  var r = setSizeBox.get();
  if (r.error) { toast('尺寸不对：' + r.error); return; }
  project.width = r.width; project.height = r.height; project.ratioId = r.ratioId;
  project.ratioLabel = r.ratioLabel; project.orientation = r.orientation;
  renderAll(); toast('已应用：' + S.describe(r.width, r.height));
});

$('btnSave').addEventListener('click', async function () {
  project.name = $('projName').value || project.name;
  var saved = await api.saveProject(project, project.name);
  if (saved) toast('项目已保存');
});
async function openProjectFlow() {
  var r = await api.openProject();
  if (!r) return false;
  try { loadProject(r.project); toast('已打开项目'); return true; }
  catch (e) { toast('项目文件读不了：' + e.message); return false; }
}
$('btnOpen').addEventListener('click', openProjectFlow);

/* ---------- 封面模式 ---------- */
$('coverMode').addEventListener('change', function () {
  project.coverMode = $('coverMode').checked;
  renderPreview();
  toast(project.coverMode ? '封面模式开：第一页将单独作封面' : '封面模式关');
});

/* ---------- PDF 导入（pdf.js 逐页栅格化） ---------- */
function dataUrlToBytes(dataUrl) {
  var b64 = dataUrl.split(',')[1] || '';
  var bin = atob(b64);
  var u8 = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
$('btnAddPdf').addEventListener('click', async function () {
  var f = await api.importPDF();
  if (!f) return;
  var prog = $('pdfProgress');
  try {
    if (!window.pdfjsLib) throw new Error('PDF 组件未加载');
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = '../vendor/pdf.worker.min.js';
    prog.style.display = 'block'; prog.textContent = '正在打开 PDF…';
    var pdf = await window.pdfjsLib.getDocument({ data: dataUrlToBytes(f.dataUrl) }).promise;
    var added = 0;
    for (var n = 1; n <= pdf.numPages; n++) {
      prog.textContent = '正在导入 PDF：第 ' + n + ' / ' + pdf.numPages + ' 页';
      var page = await pdf.getPage(n);
      var base = page.getViewport({ scale: 1 });
      // PDF 页按「完整显示」缩放进项目页面尺寸（居中、留白填页面背景），不裁剪不拉伸
      var fit = Math.min(project.width / base.width, project.height / base.height);
      var vp = page.getViewport({ scale: fit });
      var tmp = document.createElement('canvas');
      tmp.width = Math.max(1, Math.round(vp.width)); tmp.height = Math.max(1, Math.round(vp.height));
      await page.render({ canvasContext: tmp.getContext('2d'), viewport: vp }).promise;
      var cv = document.createElement('canvas'); cv.width = project.width; cv.height = project.height;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = project.background || '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(tmp, (cv.width - tmp.width) / 2, (cv.height - tmp.height) / 2);
      project.pages.push({ image: cv.toDataURL('image/jpeg', 0.92), title: '', body: '', bg: null });
      added++;
    }
    prog.style.display = 'none';
    renderAll(); toast('PDF 已导入 ' + added + ' 页：' + f.name);
  } catch (e) {
    prog.style.display = 'none';
    toast('PDF 导入失败：' + (e && e.message ? e.message : '文件解析不了') + '。可以先把 PDF 转成图片再导入');
  }
});

/* ---------- 导出清晰度 + 体积预估 + 导出 ---------- */
var exportQualityId = Q.DEFAULT_ID;
var prepCache = { key: null, pages: null, bytes: 0 };
function prepKey() {
  var imgLen = 0;
  project.pages.forEach(function (p) { if (p.image) imgLen += p.image.length; });
  return [exportQualityId, project.width, project.height, project.pages.length, imgLen,
    project.music ? project.music.dataUrl.length : 0].join('|');
}
function loadImageEl(src) {
  return new Promise(function (res, rej) {
    var im = new Image();
    im.onload = function () { res(im); };
    im.onerror = rej;
    im.src = src;
  });
}
// 按当前清晰度把每页图重编码：缩放进 cap 长边画布、图片完整显示居中、输出 JPEG
async function prepareExportPages() {
  var q = Q.qualityById(exportQualityId);
  var t = Q.targetSize(project.width, project.height, q.cap);
  var out = [];
  for (var i = 0; i < project.pages.length; i++) {
    var p = project.pages[i];
    if (!p.image) { out.push(p); continue; }
    try {
      var img = await loadImageEl(p.image);
      var cv = document.createElement('canvas'); cv.width = t.w; cv.height = t.h;
      var ctx = cv.getContext('2d');
      ctx.fillStyle = p.bg || project.background || '#ffffff'; ctx.fillRect(0, 0, t.w, t.h);
      var s = Math.min(t.w / img.naturalWidth, t.h / img.naturalHeight);
      var dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      ctx.drawImage(img, (t.w - dw) / 2, (t.h - dh) / 2, dw, dh);
      out.push(Object.assign({}, p, { image: cv.toDataURL('image/jpeg', q.jpegQuality) }));
    } catch (e) { out.push(p); } // 单页重编码失败就退回原图，不挡整本导出
  }
  return out;
}
async function getPrepared() {
  var key = prepKey();
  if (prepCache.key !== key) {
    var pages = await prepareExportPages();
    if (!pageFlipSrcCache) pageFlipSrcCache = await api.readPageFlip();
    var total = pageFlipSrcCache.length;
    pages.forEach(function (p) { if (p.image) total += p.image.length; });
    if (project.music) total += project.music.dataUrl.length;
    prepCache = { key: key, pages: pages, bytes: Q.estimateBytes(total) };
  }
  // 项目字段（书名、封面开关、背景等）现取现拼，缓存只存重编码后的页面与体积
  return { project: Object.assign({}, project, { pages: prepCache.pages }), bytes: prepCache.bytes };
}
function setEstText(t) {
  $('exportSize').textContent = (project && project.pages.length) ? '预计导出 ' + t : '';
  $('exportSize2').textContent = t;
}
var estTimer = null;
function updateEstimate() {
  clearTimeout(estTimer);
  estTimer = setTimeout(async function () {
    if (!project || !project.pages.length) { setEstText('—'); return; }
    try { var c = await getPrepared(); setEstText('约 ' + Q.formatSize(c.bytes)); }
    catch (e) { setEstText('—'); }
  }, 250);
}
$('exportQuality').addEventListener('change', function () {
  exportQualityId = $('exportQuality').value;
  updateEstimate();
  toast('导出清晰度：' + Q.qualityById(exportQualityId).label);
});

$('btnExport').addEventListener('click', async function () {
  if (!project.pages.length) { toast('先导入至少一页图片再导出'); return; }
  project.name = $('projName').value || project.name;
  toast('正在按「' + Q.qualityById(exportQualityId).label + '」清晰度准备导出…');
  var c = await getPrepared();
  var html = X.buildExportHTML(c.project, pageFlipSrcCache);
  var saved = await api.exportHTML(html, project.name);
  if (saved) toast('已导出 H5（约 ' + Q.formatSize(html.length) + '）：把这个 .html 改名为 index.html 上传到 GitHub Pages，即可发微信链接');
});

/* ---------- 新建 ---------- */
$('btnNew').addEventListener('click', function () { $('newDlg').style.display = 'flex'; });
$('btnNewCancel').addEventListener('click', function () { $('newDlg').style.display = project ? 'none' : 'flex'; });
$('btnNewOpen').addEventListener('click', async function () { if (await openProjectFlow()) $('newDlg').style.display = 'none'; });
$('btnCreate').addEventListener('click', function () {
  var r = newSizeBox.get();
  if (r.error) { toast('尺寸不对：' + r.error); return; }
  var p = defaultProject();
  p.name = $('newName').value || '我的电子书';
  p.width = r.width; p.height = r.height; p.ratioId = r.ratioId; p.ratioLabel = r.ratioLabel; p.orientation = r.orientation;
  loadProject(p);
  $('newDlg').style.display = 'none';
  toast('新项目已创建，点「导入图片」开始');
});

window.addEventListener('resize', debouncePreview);

/* ---------- 启动 ---------- */
buildBgSwatches();
loadProject(defaultProject());
$('newDlg').style.display = 'flex';
