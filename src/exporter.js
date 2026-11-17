/* Leafbook 导出器：把项目生成单个自包含 H5 HTML（图片/音乐/StPageFlip 全部内嵌）。
   UMD：编辑器里 window.LeafbookExporter，Node 测试里 require()。
   阅读场景（背景）定义来自 backgrounds.js（浏览器里先加载，Node 里 require）。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./backgrounds.js'));
  else root.LeafbookExporter = factory(root.LeafbookBackgrounds);
})(typeof self !== 'undefined' ? self : this, function (B) {
  'use strict';

  // 兜底：万一背景模块缺失，用一个浅色默认场景，不能让导出崩
  if (!B || !B.normalize) {
    B = {
      normalize: function () { return { type: 'preset', presetId: 'sakura', color: '#f5e6da', image: null, imageName: null }; },
      layerStyle: function () { return 'background:#f3e9dc;'; },
      isDark: function () { return false; }
    };
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pageInner(page, projectBg) {
    var bg = page.bg || projectBg || '#ffffff';
    var html = '';
    if (page.image) {
      html += '<img class="pg-img" src="' + page.image + '" alt="">'; // dataURL，无需转义
    } else {
      html += '<div class="pg-empty">（空白页）</div>';
    }
    if ((page.title && page.title.trim()) || (page.body && page.body.trim())) {
      html += '<div class="pg-caption">'
        + (page.title ? '<div class="pg-title">' + esc(page.title) + '</div>' : '')
        + (page.body ? '<div class="pg-body">' + esc(page.body) + '</div>' : '')
        + '</div>';
    }
    return '<div class="pg-inner" style="background:' + esc(bg) + '">' + html + '</div>';
  }

  /**
   * @param {object} project {name,width,height,ratioLabel,orientation,background,
   *   readerBackground:{type,presetId,color,image,imageName},coverMode:boolean,
   *   music:{name,dataUrl}|null,pages:[{image,title,body,bg}]}
   * @param {string} pageFlipSource StPageFlip 库源码（内嵌进导出文件，不外链）
   * @returns {string} 完整 HTML
   */
  function buildExportHTML(project, pageFlipSource) {
    var W = Math.round(project.width), H = Math.round(project.height);
    var bg = project.background || '#f2efe9';
    var name = project.name || 'Leafbook 电子书';
    var pages = project.pages || [];
    var rb = B.normalize(project.readerBackground);
    var dark = B.isDark(rb);
    var sceneStyle = B.layerStyle(rb); // dataURL 已在其中，无需再转义

    var bookPages = pages.map(function (p) {
      return '<div class="page">' + pageInner(p, bg) + '</div>';
    }).join('\n');
    var storyPages = pages.map(function (p) {
      return '<section class="story-page">' + pageInner(p, bg) + '</section>';
    }).join('\n');

    var audioTag = project.music && project.music.dataUrl
      ? '<audio id="bgm" loop preload="auto" src="' + project.music.dataUrl + '"></audio>'
      : '';
    // 音乐胶囊：♪ 背景音乐 + 状态（开启音乐 / 暂停音乐），与参考图一致
    var musicBtn = project.music && project.music.dataUrl
      ? '<button id="musicBtn" class="music-pill" type="button" aria-label="背景音乐开关">'
        + '<span class="m-note">♪</span><span class="m-name">背景音乐</span>'
        + '<span class="m-state" id="musicState">开启音乐</span></button>'
      : '';

    // 翻页音效开关 + 全屏按钮（常驻顶栏右侧，音效为合成纸声、无音频素材）
    var soundBtn = '<button id="soundBtn" class="icon-pill" type="button" aria-label="翻页音效开关" title="翻页音效">🔊</button>';
    var fsBtn = '<button id="fsBtn" class="icon-pill" type="button" aria-label="全屏" title="全屏">⛶</button>';
    // 封面模式：第一页单独作封面（StPageFlip showCover）
    var coverCfg = project.coverMode ? 'showCover:true,' : '';

    var css = [
      '*{margin:0;padding:0;box-sizing:border-box}',
      'html,body{height:100%;overscroll-behavior:none}',
      'body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#fff;display:flex;flex-direction:column;overflow:hidden;-webkit-tap-highlight-color:transparent;position:relative;background:#241c14}',
      /* 场景背景层：铺满全屏，书本浮在场景上 */
      '#scene{position:fixed;inset:0;z-index:0;overflow:hidden}',
      '#sceneFx{position:absolute;inset:-24px}',
      '#app{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;min-height:0}',
      /* 顶栏：左 书图标+书名，右 模式切换 + 音乐胶囊 */
      'header.top-bar{display:flex;align-items:center;justify-content:space-between;padding:12px 14px 6px;gap:10px;flex-wrap:wrap}',
      '.ttl-wrap{display:flex;align-items:center;gap:9px;min-width:0}',
      '.book-ico{flex:none;width:34px;height:34px;border-radius:10px;background:rgba(20,14,8,.42);border:1px solid rgba(255,255,255,.35);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;font-size:18px}',
      'header .ttl{font-size:17px;font-weight:700;letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-shadow:0 2px 10px rgba(0,0,0,.45)}',
      'body.scene-light .ttl{color:#402d1d;text-shadow:0 1px 8px rgba(255,255,255,.65)}',
      'body.scene-light .book-ico{background:rgba(255,252,246,.55);border-color:rgba(90,60,30,.25)}',
      '.top-right{display:flex;align-items:center;gap:8px;margin-left:auto}',
      '.seg{display:flex;background:rgba(20,14,8,.42);border:1px solid rgba(255,255,255,.28);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);border-radius:999px;padding:2px}',
      '.seg button{border:0;background:transparent;color:#fff;padding:5px 12px;border-radius:999px;font-size:12.5px;cursor:pointer}',
      'body.scene-light .seg button{color:#402d1d}',
      '.seg button.on{background:#fff;color:#222;font-weight:600}',
      '.music-pill{display:flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.55);background:rgba(20,14,8,.42);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#fff;border-radius:999px;padding:8px 14px;font-size:13.5px;font-weight:600;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.25)}',
      'body.scene-light .music-pill{background:rgba(255,252,246,.55);color:#402d1d;border-color:rgba(90,60,30,.3)}',
      '.music-pill .m-note{font-size:15px}',
      '.music-pill .m-state{font-size:11.5px;font-weight:500;opacity:.85;border-left:1px solid rgba(127,127,127,.5);padding-left:7px}',
      '.music-pill.playing{background:#e8590c;border-color:#e8590c;color:#fff}',
      '.icon-pill{flex:none;width:38px;height:38px;border-radius:50%;border:1px solid rgba(255,255,255,.55);background:rgba(20,14,8,.42);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);color:#fff;font-size:16px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.25)}',
      'body.scene-light .icon-pill{background:rgba(255,252,246,.55);border-color:rgba(90,60,30,.3)}',
      '.icon-pill.off{opacity:.55}',
      'main{flex:1;display:flex;align-items:center;justify-content:center;min-height:0;width:100%}',
      '#bookWrap{display:flex;align-items:center;justify-content:center;width:100%;height:100%;padding:4px}',
      /* 书本外框：棕色皮面封面边 + 纸边厚度 + 大面积柔和投影（只作用于外层容器，不碰 StPageFlip 内部 DOM） */
      '.book-frame{position:relative;padding:11px 13px 15px;border-radius:7px 16px 16px 7px;background:linear-gradient(148deg,#815231 0%,#5f3a21 38%,#71482a 68%,#4c2c17 100%);box-shadow:0 34px 64px rgba(15,8,3,.5),0 12px 24px rgba(15,8,3,.38),inset 0 2px 3px rgba(255,235,200,.35),inset 0 -4px 7px rgba(0,0,0,.45)}',
      '.book-frame::before{content:"";position:absolute;left:7px;right:7px;bottom:5px;height:9px;border-radius:0 0 8px 8px;background:repeating-linear-gradient(to bottom,#f6f0e0 0 1px,#d8cfb8 1px 2px);opacity:.9;pointer-events:none}',
      '.book-frame::after{content:"";position:absolute;top:6px;bottom:12px;left:5px;width:3px;border-radius:3px;background:linear-gradient(rgba(255,240,210,.28),rgba(0,0,0,.18));pointer-events:none}',
      '#book{position:relative;z-index:1;filter:drop-shadow(0 6px 14px rgba(0,0,0,.28))}',
      '.page{background:#fff;overflow:hidden}',
      '.pg-inner{position:relative;width:100%;height:100%;overflow:hidden}',
      '.pg-img{width:100%;height:100%;object-fit:contain;display:block}',
      '.pg-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#999;font-size:14px}',
      '.pg-caption{position:absolute;left:0;right:0;bottom:0;padding:26px 14px 12px;background:linear-gradient(transparent,rgba(0,0,0,.62));color:#fff}',
      '.pg-title{font-size:17px;font-weight:700;line-height:1.35}',
      '.pg-body{font-size:13px;line-height:1.55;opacity:.92;margin-top:3px;white-space:pre-wrap}',
      '#storyWrap{display:none;width:100%;height:100%;overflow-y:auto;scroll-snap-type:y mandatory;-webkit-overflow-scrolling:touch}',
      '.story-page{scroll-snap-align:start;width:100%;height:100%;display:flex;align-items:center;justify-content:center}',
      '.story-page .pg-inner{flex:none;border-radius:3px;box-shadow:0 0 0 7px #654325,0 26px 52px rgba(15,8,3,.5)}',
      /* 底部：圆形上一页 / 深色胶囊页码 / 圆形下一页（同参考图） */
      'footer{display:flex;align-items:center;justify-content:center;gap:18px;padding:8px 12px calc(14px + env(safe-area-inset-bottom))}',
      '.nav-circle{flex:none;width:48px;height:48px;border-radius:50%;border:1px solid rgba(255,255,255,.4);background:rgba(20,14,8,.46);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);color:#fff;font-size:21px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 18px rgba(0,0,0,.3)}',
      'body.scene-light .nav-circle{background:rgba(52,36,20,.5)}',
      '.nav-circle:active{transform:scale(.94)}',
      '.counter-pill{min-width:86px;text-align:center;padding:9px 18px;border-radius:999px;background:rgba(20,14,8,.46);border:1px solid rgba(255,255,255,.22);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);color:#fff;font-size:14.5px;letter-spacing:.14em;box-shadow:0 6px 18px rgba(0,0,0,.25)}',
      'body.scene-light .counter-pill{background:rgba(52,36,20,.5)}',
      '.hint{text-align:center;font-size:12px;opacity:.75;padding:2px 0 0;text-shadow:0 1px 6px rgba(0,0,0,.4)}',
      'body.scene-light .hint{color:#5a4230;text-shadow:0 1px 6px rgba(255,255,255,.6)}'
    ].join('\n');

    var js = [
      'var PW=' + W + ',PH=' + H + ',TOTAL=' + pages.length + ';',
      'var mode="book",flip=null,cur=1;',
      // 预留书框内边距（约 26px 宽 / 26px 高）与边距，保证整本含框放得下
      'function fitSize(){var aw=document.querySelector("main").clientWidth-44,ah=document.querySelector("main").clientHeight-40;var s=Math.min(aw/PW,ah/PH);return{w:Math.max(110,Math.floor(PW*s)),h:Math.max(110,Math.floor(PH*s))};}',
      'function setCounter(n){cur=n;document.getElementById("counter").textContent=n+" / "+TOTAL;}',
      'function initBook(){var d=fitSize();var el=document.getElementById("book");el.innerHTML=document.getElementById("bookSrc").innerHTML;flip=new St.PageFlip(el,{width:d.w,height:d.h,size:"fixed",minWidth:d.w,maxWidth:d.w,minHeight:d.h,maxHeight:d.h,' + coverCfg + 'maxShadowOpacity:0.55,mobileScrollSupport:false,swipeDistance:18,clickEventZoom:false,usePortrait:true,startPage:cur-1});flip.loadFromHTML(document.querySelectorAll("#book .page"));flip.on("flip",function(e){setCounter(e.data+1);rustle();});}',
      'function sizeStory(){var d=fitSize();document.querySelectorAll(".story-page .pg-inner").forEach(function(n){n.style.width=d.w+"px";n.style.height=d.h+"px";});}',
      'function setMode(m){mode=m;document.getElementById("btnBook").classList.toggle("on",m==="book");document.getElementById("btnStory").classList.toggle("on",m==="story");document.getElementById("bookWrap").style.display=m==="book"?"flex":"none";document.getElementById("storyWrap").style.display=m==="story"?"block":"none";document.getElementById("hintBook").style.display=m==="book"?"block":"none";document.getElementById("hintStory").style.display=m==="story"?"block":"none";if(m==="book"){initBook();}else{sizeStory();var sp=document.querySelectorAll(".story-page");if(sp[cur-1])sp[cur-1].scrollIntoView();}}',
      'document.getElementById("btnBook").addEventListener("click",function(){setMode("book");});',
      'document.getElementById("btnStory").addEventListener("click",function(){setMode("story");});',
      'document.getElementById("prevBtn").addEventListener("click",function(){if(mode==="book"&&flip)flip.flipPrev();else{var t=Math.max(1,cur-1);var sp=document.querySelectorAll(".story-page");if(sp[t-1])sp[t-1].scrollIntoView({behavior:"smooth"});}});',
      'document.getElementById("nextBtn").addEventListener("click",function(){if(mode==="book"&&flip)flip.flipNext();else{var t=Math.min(TOTAL,cur+1);var sp=document.querySelectorAll(".story-page");if(sp[t-1])sp[t-1].scrollIntoView({behavior:"smooth"});}});',
      'var sw=document.getElementById("storyWrap");sw.addEventListener("scroll",function(){if(mode!=="story")return;var idx=Math.round(sw.scrollTop/Math.max(1,sw.clientHeight));setCounter(Math.min(TOTAL,Math.max(1,idx+1)));});',
      'var bgm=document.getElementById("bgm"),mb=document.getElementById("musicBtn"),ms=document.getElementById("musicState");',
      'if(mb&&bgm){mb.addEventListener("click",function(){if(bgm.paused){bgm.play().then(function(){mb.classList.add("playing");if(ms)ms.textContent="暂停音乐";}).catch(function(){mb.classList.remove("playing");if(ms)ms.textContent="开启音乐";});}else{bgm.pause();mb.classList.remove("playing");if(ms)ms.textContent="开启音乐";}});}',
      'var rt;window.addEventListener("resize",function(){clearTimeout(rt);rt=setTimeout(function(){if(mode==="book")initBook();else sizeStory();},200);});',
      /* 翻页纸声：Web Audio 合成的短促噪声（带通滤波 + 包络衰减），无音频素材；
         AudioContext 只能在用户首次交互后创建/恢复（浏览器与微信的自动播放规则） */
      'var actx=null,soundOn=true;',
      'function ensureAudio(){if(!actx){try{actx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){actx=null;}}if(actx&&actx.state==="suspended")actx.resume();}',
      'document.addEventListener("pointerdown",ensureAudio);',
      'function rustle(){if(!soundOn||!actx||actx.state!=="running")return;var dur=0.26,sr=actx.sampleRate,len=Math.floor(sr*dur),buf=actx.createBuffer(1,len,sr),d=buf.getChannelData(0);for(var i=0;i<len;i++){var t=i/len;d[i]=(Math.random()*2-1)*Math.pow(1-t,1.7)*(0.35+0.65*Math.sin(Math.PI*t));}var src=actx.createBufferSource();src.buffer=buf;var f=actx.createBiquadFilter();f.type="bandpass";f.frequency.value=850+Math.random()*750;f.Q.value=0.8;var g=actx.createGain();var t0=actx.currentTime;g.gain.setValueAtTime(0.0001,t0);g.gain.exponentialRampToValueAtTime(0.2,t0+0.045);g.gain.exponentialRampToValueAtTime(0.0001,t0+dur);src.connect(f);f.connect(g);g.connect(actx.destination);src.start();}',
      'var sb=document.getElementById("soundBtn");sb.addEventListener("click",function(){soundOn=!soundOn;sb.textContent=soundOn?"🔊":"🔇";sb.classList.toggle("off",!soundOn);if(soundOn){ensureAudio();rustle();}});',
      /* 全屏切换 */
      'document.getElementById("fsBtn").addEventListener("click",function(){if(document.fullscreenElement){document.exitFullscreen();}else if(document.documentElement.requestFullscreen){document.documentElement.requestFullscreen().catch(function(){});}});',
      /* 键盘左右箭头翻页（书籍模式） */
      'document.addEventListener("keydown",function(e){if(mode!=="book"||!flip)return;if(e.key==="ArrowRight"){flip.flipNext();}else if(e.key==="ArrowLeft"){flip.flipPrev();}});',
      'setMode("book");setCounter(1);'
    ].join('\n');

    return '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n'
      + '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">\n'
      + '<meta name="apple-mobile-web-app-capable" content="yes">\n'
      + '<title>' + esc(name) + '</title>\n'
      + '<!-- Leafbook 导出 · 页面尺寸 ' + W + 'x' + H + ' px · ' + esc(project.ratioLabel || '') + ' · ' + pages.length + ' 页 · 阅读背景 ' + esc(rb.type + (rb.type === 'preset' ? ':' + rb.presetId : '')) + ' -->\n'
      + '<style>\n' + css + '\n</style>\n</head>\n'
      + '<body class="' + (dark ? 'scene-dark' : 'scene-light') + '" data-page-width="' + W + '" data-page-height="' + H + '" data-bg-type="' + rb.type + '"' + (rb.type === 'preset' ? ' data-bg-preset="' + esc(rb.presetId) + '"' : '') + '>\n'
      + '<div id="scene" aria-hidden="true"><div id="sceneFx" style="' + sceneStyle + '"></div></div>\n'
      + '<div id="app">'
      + '<header class="top-bar"><div class="ttl-wrap"><span class="book-ico">📖</span><div class="ttl">' + esc(name) + '</div></div>'
      + '<div class="top-right">' + musicBtn + soundBtn + fsBtn
      + '<div class="seg"><button id="btnBook" class="on" type="button">书籍</button><button id="btnStory" type="button">图文</button></div></div></header>\n'
      + '<main><div id="bookWrap"><div class="book-frame" id="bookFrame"><div id="book"></div></div></div>'
      + '<div id="storyWrap">' + storyPages + '</div></main>\n'
      + '<div class="hint" id="hintBook">拖动页角或点箭头翻页</div>'
      + '<div class="hint" id="hintStory" style="display:none">上下滑动看下一页</div>\n'
      + '<footer><button class="nav-circle" id="prevBtn" type="button" aria-label="上一页">←</button>'
      + '<span class="counter-pill" id="counter">1 / ' + pages.length + '</span>'
      + '<button class="nav-circle" id="nextBtn" type="button" aria-label="下一页">→</button></footer>\n'
      + '</div>\n'
      + audioTag + '\n'
      + '<div id="bookSrc" style="display:none">' + bookPages + '</div>\n'
      + '<script>\n' + pageFlipSource + '\n</script>\n'
      + '<script>\n' + js + '\n</script>\n</body>\n</html>';
  }

  return { buildExportHTML: buildExportHTML, esc: esc };
});
