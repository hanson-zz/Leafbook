'use strict';
/* Leafbook 逻辑测试：尺寸模块 + 导出 HTML 断言。运行：npm test */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
let passed = 0;
function ok(name, fn) { fn(); passed++; console.log('  ✓ ' + name); }

console.log('1) JS 语法检查');
['src/main.js', 'src/preload.js', 'src/renderer.js', 'src/sizes.js', 'src/backgrounds.js', 'src/quality.js', 'src/exporter.js'].forEach(f => {
  execFileSync(process.execPath, ['--check', path.join(root, f)]);
  passed++; console.log('  ✓ node --check ' + f);
});

console.log('2) JSON 有效性');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
passed++; console.log('  ✓ package.json 可解析');
ok('版本号为 1.2.1', () => assert.strictEqual(pkg.version, '1.2.1'));

console.log('3) 尺寸模块');
const S = require(path.join(root, 'src/sizes.js'));
ok('比例预设齐全', () => {
  const ids = S.RATIOS.map(r => r.id);
  ['3:4', '4:3', '16:9', '9:16', 'a4p', 'a4l', '1:1', 'custom'].forEach(id =>
    assert(ids.includes(id), '缺比例 ' + id));
});
ok('像素预设挂钩比例', () => {
  assert(S.PIXEL_PRESETS['9:16'].some(p => p.w === 1080 && p.h === 1920));
  assert(S.PIXEL_PRESETS['a4p'].some(p => p.w === 1240 && p.h === 1754));
  assert(S.PIXEL_PRESETS['1:1'].some(p => p.w === 1080 && p.h === 1080));
});
ok('尺寸描述文案', () => {
  assert.strictEqual(S.describe(1080, 1920), '页面尺寸：1080 × 1920 px · 9:16 竖版');
  assert.strictEqual(S.describe(1920, 1080), '页面尺寸：1920 × 1080 px · 16:9 横版');
  assert.strictEqual(S.describe(1080, 1080), '页面尺寸：1080 × 1080 px · 1:1 方形');
});
ok('自定义尺寸校验', () => {
  assert.strictEqual(S.validate(1080, 1920), null);
  assert(S.validate(50, 1920)); assert(S.validate(1080.5, 1920)); assert(S.validate(NaN, 100));
});

console.log('4) 导出 HTML');
const X = require(path.join(root, 'src/exporter.js'));
const pageFlipSource = fs.readFileSync(path.join(root, 'vendor/page-flip.browser.min.js'), 'utf8');
assert(pageFlipSource.includes('PageFlip'), 'vendor 库应包含 PageFlip');

// 3 张 1x1 透明 PNG
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const project = {
  name: '测试电子书', width: 1080, height: 1920, ratioId: '9:16', ratioLabel: '9:16',
  orientation: 'portrait', background: '#ffffff',
  readerBackground: { type: 'preset', presetId: 'sakura', color: '#f5e6da', image: null, imageName: null },
  music: { name: 'Brainstorm.m4a', dataUrl: 'data:audio/mp4;base64,AAAA' },
  pages: [0, 1, 2].map(i => ({ image: png, title: '第' + (i + 1) + '页标题', body: '说明', bg: null }))
};
const html = X.buildExportHTML(project, pageFlipSource);
ok('导出含正确页面尺寸/比例', () => {
  assert(html.includes('data-page-width="1080"') && html.includes('data-page-height="1920"'));
  assert(html.includes('var PW=1080,PH=1920'));
  assert(html.includes('1080x1920'));
});
ok('导出含音乐按钮与音频', () => {
  assert(html.includes('开启音乐') && html.includes('暂停音乐'));
  assert(html.includes('id="bgm"') && html.includes('data:audio/mp4'));
});
ok('导出内嵌 StPageFlip 真实翻页代码', () => {
  assert(html.includes('PageFlip') && html.includes('new St.PageFlip'));
  assert(html.includes('loadFromHTML'));
});
ok('导出含 3 页（书籍+图文双份）', () => {
  assert.strictEqual((html.match(/class="page"/g) || []).length, 3);
  assert.strictEqual((html.match(/class="story-page"/g) || []).length, 3);
  assert.strictEqual((html.match(/data:image\/png/g) || []).length, 6);
});
ok('导出含 Book/Story 切换与页码', () => {
  assert(html.includes('btnBook') && html.includes('btnStory') && html.includes('1 / 3'));
});
ok('图片 object-fit:contain 不裁剪', () => {
  assert(html.includes('object-fit:contain'));
});
ok('无音乐项目不渲染音乐按钮', () => {
  const h2 = X.buildExportHTML({ ...project, music: null }, pageFlipSource);
  assert(!h2.includes('id="musicBtn"') && !h2.includes('<audio id="bgm"'));
});
ok('标题转义防注入', () => {
  const h3 = X.buildExportHTML({ ...project, pages: [{ image: null, title: '<script>x', body: '', bg: null }] }, pageFlipSource);
  assert(h3.includes('&lt;script&gt;'));
});

console.log('5) 阅读背景与新阅读器（v1.1）');
const B = require(path.join(root, 'src/backgrounds.js'));
ok('背景预设齐全且都是渐变场景', () => {
  const ids = B.PRESETS.map(p => p.id);
  ['sakura', 'wooddesk', 'lake', 'paper', 'night'].forEach(id =>
    assert(ids.includes(id), '缺背景预设 ' + id));
  B.PRESETS.forEach(p => assert(p.css.includes('gradient'), p.id + ' 应为渐变场景'));
});
ok('每个预设都会进入导出场景层', () => {
  B.PRESETS.forEach(p => {
    const h = X.buildExportHTML({ ...project, readerBackground: { type: 'preset', presetId: p.id } }, pageFlipSource);
    assert(h.includes('data-bg-preset="' + p.id + '"'), p.id + ' 未写入 data-bg-preset');
    assert(h.includes(B.cssForPreset(p.id)), p.id + ' 的场景 CSS 未进入导出');
    assert(h.includes('id="sceneFx"'), '缺场景层');
  });
});
ok('自定义纯色背景进入导出', () => {
  const h = X.buildExportHTML({ ...project, readerBackground: { type: 'color', color: '#123456' } }, pageFlipSource);
  assert(h.includes('data-bg-type="color"'));
  assert(h.includes('background:#123456'));
});
ok('自定义背景图 dataURL 内嵌导出且带虚化', () => {
  const bgImg = 'data:image/jpeg;base64,/9j/FAKEBGIMAGE';
  const h = X.buildExportHTML({ ...project, readerBackground: { type: 'image', image: bgImg, imageName: 'bg.jpg' } }, pageFlipSource);
  assert(h.includes('data-bg-type="image"'));
  assert(h.includes(bgImg), '背景图 dataURL 未内嵌');
  assert(h.includes('blur('), '背景图应带模糊处理');
});
ok('无 readerBackground 时默认樱花庭院', () => {
  const { readerBackground, ...noBg } = project;
  const h = X.buildExportHTML(noBg, pageFlipSource);
  assert(h.includes('data-bg-preset="sakura"'));
});
ok('顶栏含书图标+书名+音乐胶囊', () => {
  assert(html.includes('class="top-bar"') && html.includes('book-ico'));
  assert(html.includes('测试电子书'));
  assert(html.includes('id="musicBtn"') && html.includes('music-pill') && html.includes('背景音乐'));
});
ok('底部含圆形前后按钮+胶囊页码', () => {
  assert(html.includes('id="prevBtn"') && html.includes('id="nextBtn"'));
  assert((html.match(/nav-circle/g) || []).length >= 2);
  assert(html.includes('counter-pill') && html.includes('id="counter"'));
});
ok('书本带皮面外框与投影', () => {
  assert(html.includes('book-frame'));
  assert(html.includes('box-shadow:0 34px 64px'));
});

console.log('6) v1.2：PDF 导入 / 封面 / 音效 / 全屏 / 清晰度');
const Q = require(path.join(root, 'src/quality.js'));
ok('清晰度预设值正确（高清/标准/小文件）', () => {
  assert.strictEqual(Q.qualityById('hd').jpegQuality, 0.85);
  assert.strictEqual(Q.qualityById('hd').cap, 1700);
  assert.strictEqual(Q.qualityById('std').jpegQuality, 0.75);
  assert.strictEqual(Q.qualityById('std').cap, 1400);
  assert.strictEqual(Q.qualityById('small').jpegQuality, 0.6);
  assert.strictEqual(Q.qualityById('small').cap, 1100);
  assert.strictEqual(Q.qualityById('nope').id, 'std'); // 未知 id 回退标准
});
ok('清晰度长边缩放与体积格式化', () => {
  assert.deepStrictEqual(Q.targetSize(2480, 3508, 1700), { w: 1202, h: 1700 });
  assert.deepStrictEqual(Q.targetSize(1080, 1440, 1700), { w: 1080, h: 1440 }); // 只缩不放
  assert(Q.formatSize(2.5 * 1024 * 1024).includes('MB'));
});
ok('封面模式开：导出含 showCover:true', () => {
  const h = X.buildExportHTML({ ...project, coverMode: true }, pageFlipSource);
  assert(h.includes('showCover:true'));
});
ok('封面模式关/缺省：导出不含 showCover:true', () => {
  assert(!X.buildExportHTML({ ...project, coverMode: false }, pageFlipSource).includes('showCover:true'));
  const { coverMode, ...noCover } = { ...project, coverMode: true };
  assert(!X.buildExportHTML(noCover, pageFlipSource).includes('showCover:true'));
});
ok('导出含翻页纸声（Web Audio 合成 + 开关按钮）', () => {
  assert(html.includes('id="soundBtn"'));
  assert(html.includes('AudioContext') && html.includes('function rustle()'));
  assert(html.includes('createBuffer')); // 噪声缓冲合成、无音频素材
});
ok('导出含全屏按钮', () => {
  assert(html.includes('id="fsBtn"') && html.includes('requestFullscreen') && html.includes('exitFullscreen'));
});
ok('导出含键盘左右翻页', () => {
  assert(html.includes('keydown') && html.includes('ArrowRight') && html.includes('ArrowLeft'));
});
ok('vendor pdf.js 文件齐全且体积可信', () => {
  const min = fs.statSync(path.join(root, 'vendor/pdf.min.js')).size;
  const worker = fs.statSync(path.join(root, 'vendor/pdf.worker.min.js')).size;
  assert(min > 200 * 1024, 'pdf.min.js 过小：' + min);
  assert(worker > 500 * 1024, 'pdf.worker.min.js 过小：' + worker);
  assert(fs.readFileSync(path.join(root, 'vendor/pdf.min.js'), 'utf8').includes('pdfjsLib'));
  assert(fs.readFileSync(path.join(root, 'vendor/pdfjs-LICENSE.txt'), 'utf8').includes('Apache License'));
});
ok('PDF 导入接线齐全（界面/渲染/主进程）', () => {
  const idx = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
  const ren = fs.readFileSync(path.join(root, 'src/renderer.js'), 'utf8');
  const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  const pre = fs.readFileSync(path.join(root, 'src/preload.js'), 'utf8');
  assert(idx.includes('vendor/pdf.min.js') && idx.includes('btnAddPdf'));
  assert(ren.includes('pdfjsLib') && ren.includes('GlobalWorkerOptions.workerSrc') && ren.includes('getDocument'));
  assert(main.includes("'import-pdf'") && pre.includes('importPDF'));
});

fs.writeFileSync(path.join(root, 'test/sample-export.html'), html, 'utf8');
console.log('\n全部通过：' + passed + ' 项。示例导出已写 test/sample-export.html（' + html.length + ' 字节）');
