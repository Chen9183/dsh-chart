/* DSH 图表渲染 v2：```mermaid 代码块 → 图表卡片，卡片右上角可在「图表 / 表格」两种视图间切换。
 * 用本地 mermaid 11（取自 RikkaHub 的 assets），不联网。*/
(function () {
  if (window.__dshChart) return;
  window.__dshChart = true;
  var ready = false;

  var DIAGRAM_HEAD = /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|mindmap|timeline|journey|quadrantChart|xychart-beta|gitGraph|sankey-beta|block-beta|packet-beta|architecture-beta|requirementDiagram|C4Context)\b/;

  var ICON_CHART = '<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="1.5" y="9" width="3" height="5.5" rx="0.6"/><rect x="6.5" y="5.5" width="3" height="9" rx="0.6"/><rect x="11.5" y="2" width="3" height="12.5" rx="0.6"/></svg>';
  var ICON_TABLE = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true"><rect x="1.6" y="2.6" width="12.8" height="10.8" rx="1.2"/><path d="M1.6 6.2h12.8M1.6 9.8h12.8M6.2 6.2v7.2"/></svg>';

  function looksLikeDiagram(code) {
    var text = (code.textContent || '').trim();
    if (!text) return false;
    var cls = String(code.className || '') + ' ' + String((code.parentElement && code.parentElement.className) || '') + ' ' + String((code.closest('[data-code-wrap]') && code.closest('[data-code-wrap]').className) || '');
    if (/language-(mermaid|chart|mmd)/.test(cls)) return true;
    // 没有语言标记时：必须是多行代码块，且第一行就是图表声明
    if (text.indexOf('\n') < 0) return false;
    var firstLine = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean)[0] || '';
    return DIAGRAM_HEAD.test(firstLine);
  }

  // ---- 从源码里抽数据，生成表格 ----
  function parseData(src) {
    var out = { title: '', cols: [], rows: [] };
    if (/^\s*xychart-beta/.test(src)) {
      var tm = src.match(/title\s+"([^"]*)"/);
      if (tm) out.title = tm[1];
      var xm = src.match(/x-axis\s+\[([^\]]*)\]/);
      var labels = xm ? xm[1].split(',').map(function (s) { return s.trim().replace(/^"|"$/g, ''); }) : [];
      var ym = src.match(/y-axis\s+"([^"]*)"/);
      var yname = ym ? ym[1].replace(/[（(].*?[)）]/g, '').trim() : '数值';
      var series = [];
      var re = /(bar|line)\s+\[([^\]]*)\]/g, m;
      while ((m = re.exec(src))) {
        var vals = m[2].split(',').map(function (s) { return s.trim(); });
        series.push({ name: yname, values: vals });
      }
      if (series.length > 1) series.forEach(function (s2, i2) { s2.name = yname + ' ' + (i2 + 1); });
      if (!series.length) return null;
      out.cols = ['项目'].concat(series.map(function (s) { return s.name; }));
      var n = labels.length || series[0].values.length;
      for (var i = 0; i < n; i++) {
        out.rows.push([labels[i] || String(i + 1)].concat(series.map(function (s) { return s.values[i] !== undefined ? s.values[i] : ''; })));
      }
      return out.rows.length ? out : null;
    }
    if (/^\s*pie/.test(src)) {
      var t2 = src.match(/title\s+(.+)$/m);
      if (t2) out.title = t2[1].trim().replace(/^"|"$/g, '');
      out.cols = ['项目', '数值'];
      src.split('\n').forEach(function (line) {
        var mm = line.match(/^\s*"([^"]+)"\s*:\s*([\d.]+)/);
        if (mm) out.rows.push([mm[1], mm[2]]);
      });
      return out.rows.length ? out : null;
    }
    return null;
  }

  function buildTable(data) {
    var t = document.createElement('table');
    t.style.cssText = 'width:100%;border-collapse:collapse;font-size:14px';
    var thead = '<thead><tr>' + data.cols.map(function (c, i) {
      return '<th style="text-align:' + (i === 0 ? 'left' : 'right') + ';padding:8px 10px;color:#9aa4b2;font-weight:600;border-bottom:1px solid #2b3440">' + esc(c) + '</th>';
    }).join('') + '</tr></thead>';
    var tbody = '<tbody>' + data.rows.map(function (r, ri) {
      return '<tr style="background:' + (ri % 2 ? '#171c22' : 'transparent') + '">' + r.map(function (c, i) {
        return '<td style="text-align:' + (i === 0 ? 'left' : 'right') + ';padding:9px 10px;border-bottom:1px solid #1d242c;color:' + (i === 0 ? '#e6e6e6' : '#cfe1ff') + '">' + esc(c) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
    t.innerHTML = thead + tbody;
    return t;
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  var ICON_CODE = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M5.5 4 2 8l3.5 4M10.5 4 14 8l-3.5 4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function buildCard(svgHtml, data, badge, src) {
    var card = document.createElement('div');
    card.className = 'dsh-chart-card';
    card.style.cssText = 'margin:10px 0;border-radius:14px;background:#14181d;border:1px solid #262f3a;overflow:hidden';

    var head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #232c36';

    var title = document.createElement('div');
    title.textContent = (data && data.title) ? data.title : '';
    title.style.cssText = 'flex:1;font-size:15px;font-weight:600;color:#e6e6e6;line-height:1.35;min-width:0';
    head.appendChild(title);
    if (badge) {
      var bd = document.createElement('span');
      bd.textContent = badge;
      bd.title = 'mermaid 语法校验没通过，这是兼容模式画出来的，结果可能和预期有出入';
      bd.style.cssText = 'flex:none;font-size:11px;padding:2px 7px;border-radius:999px;background:#3a2f14;color:#e0b341;border:1px solid #5a4a1c;white-space:nowrap';
      head.appendChild(bd);
    }

    // 图
    var body = document.createElement('div');
    body.style.cssText = 'padding:10px 8px;overflow-x:auto';
    body.innerHTML = svgHtml;
    var svgEl = body.querySelector('svg');
    if (svgEl) {
      // 又宽又扁的图（流程图/时序图）不要按宽度压扁：保持高度，横向滑动
      var vbRaw = (svgEl.getAttribute('viewBox') || '').trim();
      var vb = vbRaw ? vbRaw.split(/[\s,]+/).map(parseFloat) : [];
      var vw = vb.length === 4 ? vb[2] : (parseFloat(svgEl.getAttribute('width')) || 0);
      var vh = vb.length === 4 ? vb[3] : (parseFloat(svgEl.getAttribute('height')) || 0);
      var ratio = (vw > 0 && vh > 0) ? vw / vh : 0;
      svgEl.removeAttribute('height');
      if (ratio > 2.2) {
        svgEl.style.width = 'auto';
        svgEl.style.height = '340px';
        svgEl.style.minWidth = '0';
        svgEl.style.maxWidth = 'none';
        svgEl.style.maxHeight = 'none';
      } else {
        svgEl.style.width = '100%';
        svgEl.style.minWidth = '460px';
        svgEl.style.height = 'auto';
        svgEl.style.maxHeight = '60vh';
      }
    }

    // 表
    var tableBox = document.createElement('div');
    tableBox.style.cssText = 'padding:6px 10px 12px;display:none;overflow-x:auto';
    if (data && data.rows.length) tableBox.appendChild(buildTable(data));

    // 原文（不渲染的源码）
    var srcBox = document.createElement('div');
    srcBox.style.cssText = 'padding:10px 12px 14px;display:none;overflow-x:auto';
    var pre = document.createElement('pre');
    pre.style.cssText = 'margin:0;font:12.5px/1.65 ui-monospace,Menlo,monospace;color:#b9c6d6;white-space:pre;tab-size:2';
    pre.textContent = src || '';
    srcBox.appendChild(pre);

    var hasTable = !!(data && data.rows.length);
    var btnChart = mkBtn(ICON_CHART, '图表', true);
    var btnTable = mkBtn(ICON_TABLE, '表格', false);
    var btnSrc = mkBtn(ICON_CODE, '原文', false);
    if (!hasTable) { btnTable.style.display = 'none'; }

    var all = { chart: btnChart, table: btnTable, source: btnSrc };
    function setView(v) {
      if (v === 'table' && !hasTable) v = 'chart';
      body.style.display = v === 'chart' ? '' : 'none';
      tableBox.style.display = v === 'table' ? '' : 'none';
      srcBox.style.display = v === 'source' ? '' : 'none';
      Object.keys(all).forEach(function (k) {
        var on = k === v;
        all[k].style.color = on ? '#e6e6e6' : '#7d8794';
        all[k].style.background = on ? '#273140' : 'transparent';
      });
    }
    btnChart.onclick = function () { setView('chart'); };
    btnTable.onclick = function () { setView('table'); };
    btnSrc.onclick = function () { setView('source'); };
    head.appendChild(btnChart);
    head.appendChild(btnTable);
    head.appendChild(btnSrc);

    card.appendChild(head);
    card.appendChild(body);
    card.appendChild(tableBox);
    card.appendChild(srcBox);
    setView('chart');
    return card;
  }

  // ---------------- 自绘图表（不依赖 mermaid，稳定且支持分组柱/圆角/亮色） ----------------
  var PALETTE = ['#4da3ff', '#4dd08a', '#ffb74d', '#f06292', '#ab7bf7', '#4dd0e1'];

  function fmtNum(v) {
    if (Math.abs(v) >= 10000) return (v / 1000).toFixed(0) + 'k';
    if (Math.abs(v) >= 100) return String(Math.round(v));
    return String(Math.round(v * 10) / 10);
  }

  function parseXychart(src) {
    var title = (src.match(/title\s+"([^"]*)"/) || [])[1] || '';
    var labels = [];
    var xm = src.match(/x-axis\s+\[([^\]]*)\]/);
    if (xm) labels = xm[1].split(',').map(function (t) { return t.trim().replace(/^"|"$/g, ''); });
    var yline = src.match(/y-axis\s+"([^"]*)"\s*(-?[\d.]+)?\s*-->\s*(-?[\d.]+)?/);
    var yname = yline ? yline[1] : '';
    var ymin = yline && yline[2] ? parseFloat(yline[2]) : 0;
    var ymax = yline && yline[3] ? parseFloat(yline[3]) : null;
    var series = [], re = /(bar|line)\s+\[([^\]]*)\]/g, m;
    while ((m = re.exec(src))) {
      series.push({ type: m[1], values: m[2].split(',').map(function (v) { return parseFloat(v); }) });
    }
    if (!series.length) return null;
    return { title: title, labels: labels, yname: yname, ymin: ymin, ymax: ymax, series: series };
  }

  function niceMax(v) {
    if (!(v > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / p;
    var m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return m * p;
  }

  function svgXY(p) {
    var W = 720, H = 380, L = 56, R = 18, T = 16, B = 52;
    var iw = W - L - R, ih = H - T - B;
    var all = [];
    p.series.forEach(function (s) { all = all.concat(s.values.filter(function (v) { return !isNaN(v); })); });
    var maxV = p.ymax != null ? p.ymax : niceMax(Math.max.apply(null, all.concat([0])));
    var minV = p.ymin != null ? p.ymin : 0;
    if (maxV <= minV) maxV = minV + 1;
    var n = p.labels.length || p.series[0].values.length;
    var y = function (v) { return T + ih - (v - minV) / (maxV - minV) * ih; };
    var s = [];
    s.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;max-height:55vh">');
    var steps = 4;
    for (var i = 0; i <= steps; i++) {
      var v = minV + (maxV - minV) * i / steps;
      var yy = y(v).toFixed(1);
      s.push('<line x1="' + L + '" y1="' + yy + '" x2="' + (W - R) + '" y2="' + yy + '" stroke="' + (i === 0 ? '#4b596a' : '#2f3a47') + '" stroke-width="1"/>');
      s.push('<text x="' + (L - 8) + '" y="' + (+yy + 4) + '" fill="#b6c2cf" font-size="12" text-anchor="end">' + fmtNum(v) + '</text>');
    }
    if (p.yname) {
      s.push('<text x="' + L + '" y="' + (T - 4) + '" fill="#b6c2cf" font-size="12" text-anchor="start">' + esc(p.yname) + '</text>');
    }
    var slot = iw / n;
    var bars = p.series.filter(function (x) { return x.type === 'bar'; });
    var lines = p.series.filter(function (x) { return x.type === 'line'; });
    var bw = Math.min(34, slot * 0.62 / Math.max(1, bars.length));
    bars.forEach(function (ser, si) {
      for (var k = 0; k < n; k++) {
        var v2 = ser.values[k];
        if (isNaN(v2)) continue;
        var cx = L + slot * (k + 0.5) - (bars.length * (bw + 6) - 6) / 2 + si * (bw + 6);
        var y0 = y(Math.max(minV, 0)), y1 = y(v2);
        var hh = Math.abs(y1 - y0);
        s.push('<rect x="' + cx.toFixed(1) + '" y="' + Math.min(y0, y1).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + Math.max(2, hh).toFixed(1) + '" rx="5" fill="' + PALETTE[si % PALETTE.length] + '"/>');
      }
    });
    lines.forEach(function (ser, si) {
      var pts = [];
      for (var k = 0; k < n; k++) {
        var v3 = ser.values[k];
        if (isNaN(v3)) continue;
        pts.push((L + slot * (k + 0.5)).toFixed(1) + ',' + y(v3).toFixed(1));
      }
      if (pts.length > 1) {
        s.push('<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + PALETTE[(bars.length + si) % PALETTE.length] + '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>');
      }
      pts.forEach(function (pt) {
        var xy = pt.split(',');
        s.push('<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="3" fill="#0f1216" stroke="' + PALETTE[(bars.length + si) % PALETTE.length] + '" stroke-width="2"/>');
      });
    });
    for (var k2 = 0; k2 < n; k2++) {
      var lab = p.labels[k2] || String(k2 + 1);
      if (lab.length > 6) lab = lab.slice(0, 6) + '…';
      s.push('<text x="' + (L + slot * (k2 + 0.5)).toFixed(1) + '" y="' + (H - B + 22) + '" fill="#c9d5e1" font-size="12" text-anchor="middle">' + esc(lab) + '</text>');
    }
    s.push('</svg>');
    return s.join('');
  }

  function parsePie(src) {
    var items = [], re = /^\s*"([^"]+)"\s*:\s*([\d.]+)/gm, m;
    while ((m = re.exec(src))) items.push({ label: m[1], value: parseFloat(m[2]) });
    return items.length ? items : null;
  }

  function svgPie(items) {
    var W = 560, H = 340;
    var total = items.reduce(function (a, b) { return a + b.value; }, 0) || 1;
    var colors = items.map(function (it, i) { return PALETTE[i % PALETTE.length]; });
    var cx = 170, cy = H / 2, r = 118;
    var s = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block;max-height:55vh">'];
    var ang = -Math.PI / 2;
    items.forEach(function (it, i) {
      var a = it.value / total * Math.PI * 2;
      var x1 = cx + r * Math.cos(ang), y1 = cy + r * Math.sin(ang);
      var x2 = cx + r * Math.cos(ang + a), y2 = cy + r * Math.sin(ang + a);
      var large = a > Math.PI ? 1 : 0;
      if (items.length === 1) {
        s.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + colors[i] + '"/>');
      } else {
        s.push('<path d="M' + cx + ',' + cy + ' L' + x1.toFixed(1) + ',' + y1.toFixed(1) + ' A' + r + ',' + r + ' 0 ' + large + ' 1 ' + x2.toFixed(1) + ',' + y2.toFixed(1) + ' Z" fill="' + colors[i] + '"/>');
      }
      var mid = ang + a / 2, tx = cx + r * 0.62 * Math.cos(mid), ty = cy + r * 0.62 * Math.sin(mid);
      var pct = Math.round(it.value / total * 100);
      s.push('<text x="' + tx.toFixed(1) + '" y="' + (ty + 4).toFixed(1) + '" fill="#0f1216" font-size="13" font-weight="700" text-anchor="middle">' + pct + '%</text>');
      ang += a;
    });
    var ly = cy - items.length * 13;
    items.forEach(function (it, i) {
      s.push('<rect x="' + (W - 168) + '" y="' + (ly + i * 26) + '" width="12" height="12" rx="3" fill="' + colors[i] + '"/>');
      s.push('<text x="' + (W - 150) + '" y="' + (ly + i * 26 + 11) + '" fill="#e2ecf7" font-size="13">' + esc(it.label) + '</text>');
    });
    s.push('</svg>');
    return s.join('');
  }

  // 能自绘就自绘；返回 null 时交给 mermaid
  function buildNative(src) {
    var t = src.trim();
    if (/^xychart-beta\b/.test(t)) {
      var p = parseXychart(src);
      return p ? svgXY(p) : null;
    }
    if (/^pie\b/.test(t)) {
      var items = parsePie(src);
      return items ? svgPie(items) : null;
    }
    return null;
  }

  function errCard(err, src) {
    var d = document.createElement('div');
    d.style.cssText = 'margin:8px 0;padding:10px 12px;border-radius:12px;background:#2a1d1d;border:1px solid #5a2c2c;color:#e8b4b4;font:12px/1.5 monospace;white-space:pre-wrap;word-break:break-all';
    d.textContent = '[图表] 渲染失败: ' + (err && err.message ? err.message : String(err)) + '\n' + String(src).slice(0, 160);
    return d;
  }

  function mkBtn(icon, aria, active) {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', aria);
    b.title = aria;
    b.innerHTML = icon;
    b.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border:0;border-radius:8px;padding:0;cursor:pointer;color:' + (active ? '#e6e6e6' : '#7d8794') + ';background:' + (active ? '#273140' : 'transparent');
    return b;
  }

  var pendingQueue = [];
  var rendering = false;

  function cleanupTemp() {
    try {
      document.querySelectorAll('body > div[id^="dshmmd"], body > svg[id^="dshmmd"]').forEach(function (n) { n.remove(); });
    } catch (e) {}
  }

  // 只画视口附近的图，离屏的先跳过（滚动到再画）
  function inViewport(el, margin) {
    try {
      var r = el.getBoundingClientRect();
      var vh = window.innerHeight || 800;
      return r.bottom > -margin && r.top < vh + margin;
    } catch (e) { return true; }
  }

  // ---------------- 渲染缓存（宿主侧落盘，页面重开直接取，不用重跑 mermaid） ----------------
  var CACHE_API = '/dsh-chart-cache/';
  var CACHE_VER = 'v1';   // 换主题/渲染逻辑时改这里，旧缓存自动失效

  // 源码 → 稳定 key（FNV-1a 两次不同种子，拼 16 位十六进制）
  function cacheKey(src) {
    var h1 = 0x811c9dc5, h2 = 0x01000193;
    var s = CACHE_VER + '|' + src;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      h1 = (h1 ^ c) >>> 0; h1 = Math.imul(h1, 0x01000193) >>> 0;
      h2 = (h2 + c) >>> 0; h2 = Math.imul(h2 ^ (h2 >>> 13), 0x27d4eb2d) >>> 0;
    }
    return 'c' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  }

  // 同一张 svg 铺多次时，id 会重复（marker 引用会指错），插入前换成本次唯一的 id
  function uniqueSvg(svg) {
    try {
      var m = /<svg[^>]*\sid="([^"]+)"/.exec(svg);
      if (!m) return svg;
      var oldId = m[1];
      var fresh = 'dshmmd' + Math.random().toString(36).slice(2);
      return svg.split('id="' + oldId + '"').join('id="' + fresh + '"')
                .split('#' + oldId).join('#' + fresh);
    } catch (e) { return svg; }
  }

  function readCache(key) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = setTimeout(function () { if (!done) { done = true; resolve(null); } }, 1500);
      try {
        fetch(CACHE_API + key, { cache: 'no-store' }).then(function (r) {
          if (!r.ok) return null;
          return r.text();
        }).then(function (text) {
          if (done) return;
          done = true; clearTimeout(timer);
          if (!text) { resolve(null); return; }
          try {
            var obj = JSON.parse(text);
            resolve(obj && obj.svg ? obj : null);
          } catch (e) {
            resolve(text.length > 120 ? { svg: text, badge: '' } : null);   // 兼容裸 svg
          }
        }).catch(function () {
          if (done) return;
          done = true; clearTimeout(timer); resolve(null);
        });
      } catch (e) {
        if (!done) { done = true; clearTimeout(timer); resolve(null); }
      }
    });
  }

  function writeCache(key, svg, badge) {
    try {
      fetch(CACHE_API + key, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ v: 1, ver: CACHE_VER, svg: svg, badge: badge || '' })
      }).catch(function () {});
    } catch (e) {}
  }

  function clearCacheRemote() {
    try {
      return fetch(CACHE_API + 'clear', { method: 'POST', cache: 'no-store' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  function schedule(code) {
    if (!ready || !code || !code.isConnected) return;
    var host = code.closest('[data-code-wrap]') || code.closest('pre');
    if (!host || host.dataset.dshChart) return;   // 行内 <code>（正文里的 `xychart-beta`）直接跳过
    if (!looksLikeDiagram(code)) return;
    if (!inViewport(host, 600)) return;           // 离屏的先不画，等滚到附近再说
    // 流式输出时代码块内容一直在变，等它稳定 450ms 没有再变才画
    var text = (code.textContent || '').trim();
    if (!text) return;
    if (code.__dshSig !== text) {
      code.__dshSig = text;
      if (code.__dshTimer) clearTimeout(code.__dshTimer);
      code.__dshTimer = setTimeout(function () { schedule(code); }, 800);
      return;
    }
    if (pendingQueue.indexOf(code) >= 0) return;
    pendingQueue.push(code);
    drain();
  }

  function drain() {
    if (rendering || !ready) return;
    var code = pendingQueue.shift();
    if (!code) return;
    if (!code.isConnected) { drain(); return; }
    var host = code.closest('[data-code-wrap]') || code.closest('pre');
    if (!host || host.dataset.dshChart) { drain(); return; }
    if (!looksLikeDiagram(code)) { drain(); return; }
    if (!inViewport(host, 600)) { drain(); return; }
    var src = (code.textContent || '').trim();
    if (!src) { drain(); return; }
    // 流式途中拿到的可能是半截内容：以「最后一行是 %%」为写完整标记，没见到就等。
    // 兼容旧消息（页面加载时就已存在的完整内容）：3 秒后也放行。
    if (!/^\s*%%\s*$/m.test(src)) {
      if (!code.__dshSeen) code.__dshSeen = Date.now();
      if (Date.now() - code.__dshSeen < 3000) { drain(); return; }
    }
    if (src.length < 24 || (src.indexOf('\n') < 0 && src.length < 64)) { drain(); return; }
    host.dataset.dshChart = 'pending';
    rendering = true;
    var data = parseData(src);
    var nativeSvg = null;
    try { nativeSvg = buildNative(src); } catch (e) { nativeSvg = null; }
    // 柱状/折线/饼图只走自绘，绝不回落 mermaid（mermaid 的 pie 图例颜色有 bug）
    var forceNative = /^(pie|xychart-beta)\b/.test(src.trim());
    if (forceNative && !nativeSvg) {
      // 内容还没写完整（或真的解析不了）：保留原代码块，不报错
      var tries0 = parseInt(host.dataset.dshTries || '0', 10) + 1;
      host.dataset.dshTries = String(tries0);
      if (tries0 > 6) { host.dataset.dshChart = 'skip'; }
      else { delete host.dataset.dshChart; }
      rendering = false;
      setTimeout(drain, 600);
      return;
    }
    var id = 'dshmmd' + Math.random().toString(36).slice(2);
    var srcForRender = src.replace(/^\s*%%\s*$/gm, '').replace(/^\s*title\s+.*$/m, '').replace(/^(\s*pie)\s+title\s+.*$/m, '$1');
    var ckey = cacheKey(srcForRender || src);

    function insert(svgText, badge) {
      host.replaceWith(buildCard(uniqueSvg(svgText), data, badge || '', src));
    }

    function finish() {
      rendering = false;
      setTimeout(drain, 1000);
    }

    function fail(err) {
      var tries = parseInt(host.dataset.dshTries || '0', 10) + 1;
      host.dataset.dshTries = String(tries);
      console.warn('[dsh-chart] 渲染失败:', err && err.message ? err.message : err);
      cleanupTemp();
      if (tries <= 6) {
        delete host.dataset.dshChart;
        setTimeout(drain, 800);
      } else {
        host.dataset.dshChart = 'skip';   // 放弃，代码块原样保留
      }
    }

    (async function run() {
      // 1) 缓存命中：直接把上次画好的图铺上去，不再跑 mermaid
      var cached = await readCache(ckey);
      if (cached && cached.svg) {
        insert(cached.svg, cached.badge);
        cleanupTemp();
        finish();
        return;
      }
      // 2) 没缓存：正常渲染一遍，画完写进缓存
      try {
        var precheck;
        try { precheck = window.mermaid.parse(srcForRender); } catch (e) { precheck = Promise.reject(e); }
        var svg = '';
        var badge = '';
        try {
          await precheck;
          // mermaid 语法通过：标准图，用自绘样式画
          svg = nativeSvg || (await window.mermaid.render(id, srcForRender)).svg;
        } catch (err) {
          // mermaid 语法没通过：兼容模式自绘，并标明可能有问题
          if (!nativeSvg) throw err;
          svg = nativeSvg;
          badge = '⚠ 语法不标准';
        }
        if (!svg || /class="error-icon"|Syntax error in text|Parse error in text/i.test(svg) || svg.length < 120) {
          host.dataset.dshChart = 'err';
          host.replaceWith(errCard('mermaid 返回了错误图', src));
          cleanupTemp();
          finish();
          return;
        }
        insert(svg, badge);
        cleanupTemp();
        writeCache(ckey, svg, badge);   // 存进缓存，页面重开时直接取
        finish();
      } catch (err) {
        fail(err);
        finish();
      }
    })();
  }

  function scanAll() {
    var codes = Array.prototype.slice.call(document.querySelectorAll('code')).reverse();
    for (var i = 0; i < codes.length; i++) schedule(codes[i]);
  }

  function init() {
    if (!window.mermaid) return;
    try {
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'loose',
        suppressErrorRendering: true,
        theme: 'dark',
        fontFamily: 'system-ui, "PingFang SC", sans-serif',
        flowchart: { htmlLabels: true, curve: 'basis' },
        themeVariables: {
          background: 'transparent',
          primaryColor: '#4da3ff',
          primaryTextColor: '#ffffff',
          primaryBorderColor: '#9ccbff',
          secondaryColor: '#4dd08a',
          secondaryBorderColor: '#8ee7b4',
          tertiaryColor: '#ffb74d',
          tertiaryBorderColor: '#ffd08a',
          lineColor: '#c9d6e4',
          textColor: '#eef4fa',
          mainBkg: '#1f2b38',
          nodeBorder: '#8cc6ff',
          clusterBkg: '#182029',
          clusterBorder: '#4b596a',
          edgeLabelBackground: '#1b2430',
          titleColor: '#ffffff',
          pie1: '#4da3ff', pie2: '#ffb74d', pie3: '#4dd08a', pie4: '#f06292',
          pie5: '#ab7bf7', pie6: '#4dd0e1', pie7: '#ffd54f', pie8: '#8d9bff',
          pie9: '#ff8a65', pie10: '#9ccc65', pie11: '#ba68c8', pie12: '#64b5f6'
        }
      });
    } catch (e) { console.warn('[dsh-chart] init', e); }
    ready = true;
    try { document.querySelectorAll('.error-icon, svg.error-icon').forEach(function (e) { e.remove(); }); } catch (e) {}
    scanAll();
  }

  function notice(msg, bad) {  // 只在失败时用，成功不弹
    try {
      var d = document.createElement('div');
      d.textContent = '[dsh-chart] ' + msg;
      d.style.cssText = 'position:fixed;left:8px;right:8px;top:8px;z-index:2147483647;padding:6px 10px;border-radius:8px;font:12px monospace;color:#fff;background:' + (bad ? '#b3261e' : '#1f6f3f');
      document.body.appendChild(d);
      setTimeout(function () { d.remove(); }, 6000);
    } catch (e) {}
  }

  function load() {
    if (window.mermaid) { init(); return; }
    try {
      var s = document.createElement('script');
      s.textContent = MERMAID_SOURCE;
      document.head.appendChild(s);
    } catch (e) { notice('mermaid 注入失败: ' + e.message, true); return; }
    if (window.mermaid) init();
  }

  // ---- 客户端命令：/rechart 重新画一遍、/rechart-clear 清缓存再画 ----
  // 注册方式照 dsh-pet（新版）那套：模块 exports.inject 里声明 commandUi 依赖，
  // apply 里用 ctx.get('commandUi') 拿服务，命令注册挂在 ctx.effect 上自动随插件卸载释放。
  var COMMAND_INJECT = ['commandUi'];

  // 图标不是必须的：拿不到图标包就注册无图标命令（跟 dsh-pet 的处理一致）
  var commandPrimitives = null;
  try {
    if (typeof require === 'function') commandPrimitives = require('@deepseek-ai/dsh-client-ui-primitives');
  } catch (e) {
    commandPrimitives = null;
  }

  function commandIcon() {
    var p = commandPrimitives;
    if (!p) return undefined;
    return p.IconChartOutlineRegular || p.IconDataBarVerticalOutlineRegular || p.IconGaugeOutlineRegular || undefined;
  }

  function reRenderAll() {
    // 整页重载最干净：会话在服务端，重载后所有图表按缓存/当前内容重画一遍
    setTimeout(function () { location.reload(); }, 60);
  }

  function clearCacheAndRedraw() {
    clearCacheRemote().then(function (res) {
      var n = res && typeof res.removed === 'number' ? res.removed : null;
      notice(n === null ? '图表缓存已清，正在重画…' : '已清掉 ' + n + ' 张图表缓存，正在重画…', false);
      setTimeout(function () { location.reload(); }, 700);
    });
  }

  function registerCommands(commandUi) {
    var disposers = [];
    var icon = commandIcon();

    function add(name, label, description, run) {
      var contribution = {
        name: name,
        label: label,
        description: description,
        available: function () { return true; },
        ui: { kind: 'action', run: run }
      };
      if (icon) contribution.icon = icon;   // 没有图标包就不带 icon 字段
      disposers.push(commandUi.register(contribution));
    }

    add(
      'rechart',
      function () { return '重新渲染图表'; },
      function () { return '把当前会话里的所有图表重新画一遍（有缓存就直接用缓存）'; },
      function () { reRenderAll(); }
    );
    add(
      'rechart-clear',
      function () { return '清除图表缓存'; },
      function () { return '清空图表渲染缓存，然后重新画一遍'; },
      function () { clearCacheAndRedraw(); }
    );

    return function () {
      for (var i = 0; i < disposers.length; i++) {
        try { disposers[i](); } catch (e) {}
      }
      disposers.length = 0;
    };
  }

  function apply(ctx) {
    ctx.effect(function () {
      var commandUi = ctx.get && ctx.get('commandUi');
      if (!commandUi || typeof commandUi.register !== 'function') {
        console.warn('[dsh-chart] 命令不可用：commandUi 服务缺失（图表本身照常渲染）');
        return function () {};
      }
      try {
        return registerCommands(commandUi);
      } catch (e) {
        console.warn('[dsh-chart] 注册 /rechart 命令失败：' + (e && e.message ? e.message : e));
        return function () {};
      }
    }, 'dsh-chart: /rechart 命令');
  }

  // 这些区域里的变动（代码块、文件预览、输入框、图表卡片）不触发整页重扫
  var NOT_MESSAGE_TEXT = 'pre, code, [data-code-wrap], textarea, input, select, .dsh-chart-card';

  // 变动是不是全在代码块里（流式输出就是这样长出来的）：那就不用整页重扫
  function onlyInCode(records) {
    for (var i = 0; i < records.length; i++) {
      var t = records[i].target;
      var el = t && (t.nodeType === 1 ? t : t.parentElement);
      if (!el || !el.closest) return false;
      if (!el.closest(NOT_MESSAGE_TEXT)) return false;
    }
    return true;
  }

  // 整页扫描节流：文件预览/流式输出会一口气灌几千个节点进来，逐个重扫会把主线程打死
  var scanTimer = null;
  function queueScan() {
    if (scanTimer) return;
    scanTimer = setTimeout(function () {
      scanTimer = null;
      if (ready) scanAll();
    }, 200);
  }

  var pageObserver = new MutationObserver(function (records) {
    if (!ready) return;
    if (onlyInCode(records)) return;
    queueScan();
  });
  pageObserver.observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  var scrollTimer = null;
  window.addEventListener('scroll', function () {
    if (!ready) return;
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(scanAll, 250);
  }, { passive: true });

  // 兜底慢扫：只在看着页面时低频跑一遍（漏掉的图表迟早补上）
  setInterval(function () {
    if (!ready || document.hidden) return;
    queueScan();
  }, 30000);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();

  // 客户端模块导出（build.mjs 打成的 __ModuleLoader__ 模块）：
  // inject 里声明 commandUi，DSH 才会在服务就绪后调用 apply 注册 /rechart
  try {
    if (typeof exports === 'object' && exports) {
      exports.apply = apply;
      exports.inject = COMMAND_INJECT;
    }
  } catch (e) {}
})();