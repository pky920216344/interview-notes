/*
 * 图解渲染（纯静态、零依赖）：把 trace 产出的关键帧画成一排卡片，每张卡 = 编号 + 一句话说明 + 图 + 对应的代码行。
 * 不做播放、单步、改输入（ADR 0003）。面板类型：cells（数组/字符串）、table（键值表）、vars（变量）。
 */
(function () {
  'use strict';

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }
  /** 'win cur' -> ' is-win is-cur' */
  function clsOf(c) {
    if (!c) return '';
    return ' ' + c.split(/\s+/).filter(Boolean).map(function (x) { return 'is-' + x; }).join(' ');
  }

  var CELL_W = 42, GAP = 6, STEP = CELL_W + GAP, CELL_H = 44, RANGE_ROW = 38, INDEX_ROW = 20, PTR_ROW = 24;

  function cellsPanel(p, hint) {
    var root = el('div', 'w w-cells');
    root.appendChild(el('div', 'w-title', p.title || ''));
    var scroll = el('div', 'cells-scroll');
    var track = el('div', 'cells-track');
    scroll.appendChild(track);
    root.appendChild(scroll);

    var top = hint.anyRange ? RANGE_ROW : 4;           // 各张卡片统一预留，卡片高度才齐
    track.style.height = (top + CELL_H + INDEX_ROW + hint.maxStack * PTR_ROW + 6) + 'px';
    track.style.width = Math.max(0, p.items.length * STEP - GAP) + 'px';

    p.items.forEach(function (it, i) {
      var c = el('div', 'cell' + clsOf(it.cls));
      c.style.left = (i * STEP) + 'px';
      c.style.top = top + 'px';
      c.appendChild(el('span', 'cv', it.v));
      if (!p.hideIndex) c.appendChild(el('span', 'ci', String(i)));
      track.appendChild(c);
    });

    var r = p.range;
    if (r && r.to >= r.from && r.from >= 0 && r.to < p.items.length) {
      var range = el('div', 'cells-range show' + clsOf(r.cls));
      range.style.left = (r.from * STEP - 3) + 'px';
      range.style.width = ((r.to - r.from + 1) * STEP - GAP + 6) + 'px';
      range.appendChild(el('span', 'cells-range-label', r.label || ''));
      track.appendChild(range);
    }

    var perAt = {};
    (p.pointers || []).forEach(function (q) {
      if (q.at < 0 || q.at >= p.items.length) return;
      var row = perAt[q.at] || 0;
      perAt[q.at] = row + 1;
      var node = el('div', 'ptr' + clsOf(q.cls), q.label);
      node.style.left = (q.at * STEP + CELL_W / 2) + 'px';
      node.style.top = (top + CELL_H + INDEX_ROW + row * PTR_ROW) + 'px';
      track.appendChild(node);
    });
    return root;
  }

  function tablePanel(p) {
    var root = el('div', 'w w-table');
    var title = el('div', 'w-title', p.title || '');
    if (p.hint) title.appendChild(el('span', 'w-hint', p.hint));
    root.appendChild(title);
    var list = el('div', 'chips');
    p.rows.forEach(function (r) {
      var c = el('div', 'chip' + clsOf(r.cls));
      c.appendChild(el('span', 'chip-k', r.k));
      c.appendChild(el('span', 'chip-v', r.v));
      list.appendChild(c);
    });
    if (!p.rows.length) list.appendChild(el('span', 'chips-empty', '（空）'));
    root.appendChild(list);
    return root;
  }

  function varsPanel(p) {
    var root = el('div', 'w w-vars');
    p.items.forEach(function (it) {
      var v = el('div', 'var' + clsOf(it.cls));
      v.appendChild(el('span', 'var-n', it.name));
      v.appendChild(el('span', 'var-v', String(it.v)));
      root.appendChild(v);
    });
    return root;
  }

  // ---------- SVG 小工具 ----------
  var SVGNS = 'http://www.w3.org/2000/svg';
  var svgSeq = 0;
  function svg(tag, attrs, text) {
    var n = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }
  function svgCls(base, c) {
    return base + clsOf(c);
  }
  /** 指针小标签：挂在 (cx, top) 下方，三角形朝上。返回占用的宽度。 */
  function ptag(parent, cx, top, label, cls) {
    var w = Math.max(30, label.length * 7.4 + 14);
    var g = svg('g', { 'class': svgCls('ptag', cls) });
    g.appendChild(svg('path', { d: 'M' + cx + ' ' + (top - 5) + ' L' + (cx - 5) + ' ' + top + ' L' + (cx + 5) + ' ' + top + ' Z' }));
    g.appendChild(svg('rect', { x: cx - w / 2, y: top, width: w, height: 20, rx: 4 }));
    g.appendChild(svg('text', { x: cx, y: top + 14 }, label));
    parent.appendChild(g);
  }

  // ---------- 面板：list（链表，带箭头） ----------
  var L_W = 46, L_H = 34, L_GAP = 40, L_PAD = 12, L_PTR_ROW = 26;

  function listPanel(p) {
    var root = el('div', 'w w-list');
    root.appendChild(el('div', 'w-title', p.title || ''));
    var n = p.items.length;
    var id = 'lk' + (++svgSeq);

    var maxSpan = 0;
    p.edges.forEach(function (e) {
      var d = Math.abs(e.to - e.from);
      if (d > 1 || e.to < e.from) maxSpan = Math.max(maxSpan, d);
    });
    var top = maxSpan > 0 ? 22 + Math.min(maxSpan, 5) * 12 : 10;      // 弧线要从结点上方绕过去
    var perAt = {}, maxStack = 0;
    (p.pointers || []).forEach(function (q) { perAt[q.at] = (perAt[q.at] || 0) + 1; maxStack = Math.max(maxStack, perAt[q.at]); });
    var W = L_PAD * 2 + n * L_W + Math.max(0, n - 1) * L_GAP + 34;
    var H = top + L_H + (maxStack ? 12 + maxStack * L_PTR_ROW : 10);

    var s = svg('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img' });
    var defs = svg('defs');
    ['', 'bad', 'new', 'win'].forEach(function (c) {
      var m = svg('marker', { id: id + '-' + (c || 'def'), viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
      m.appendChild(svg('path', { d: 'M0 0 L10 5 L0 10 z', 'class': 'mk' + (c ? ' is-' + c : '') }));
      defs.appendChild(m);
    });
    s.appendChild(defs);

    function x(i) { return L_PAD + i * (L_W + L_GAP); }
    var midY = top + L_H / 2;

    p.edges.forEach(function (e) {
      var mk = 'url(#' + id + '-' + (/\bbad\b/.test(e.cls) ? 'bad' : /\bnew\b/.test(e.cls) ? 'new' : /\bwin\b/.test(e.cls) ? 'win' : 'def') + ')';
      var d;
      if (e.to === e.from + 1) {
        d = 'M' + (x(e.from) + L_W) + ' ' + midY + ' L' + (x(e.to) - 3) + ' ' + midY;
      } else {
        var sx = x(e.from) + L_W / 2 + (e.to < e.from ? -6 : 6), tx = x(e.to) + L_W / 2 + (e.to < e.from ? 6 : -6);
        var h = 14 + 10 * Math.min(Math.abs(e.to - e.from), 5);
        d = 'M' + sx + ' ' + top + ' C' + sx + ' ' + (top - h) + ' ' + tx + ' ' + (top - h) + ' ' + tx + ' ' + (top - 3);
      }
      s.appendChild(svg('path', { d: d, 'class': svgCls('ledge', e.cls), 'marker-end': mk }));
    });

    (p.nulls || []).forEach(function (i) {
      s.appendChild(svg('path', { d: 'M' + (x(i) + L_W) + ' ' + midY + ' L' + (x(i) + L_W + 14) + ' ' + midY, 'class': 'ledge null', 'marker-end': 'url(#' + id + '-def)' }));
      s.appendChild(svg('text', { x: x(i) + L_W + 24, y: midY + 1, 'class': 'lnull' }, '∅'));
    });

    p.items.forEach(function (it, i) {
      var g = svg('g', { 'class': svgCls('lg', it.cls) });
      g.appendChild(svg('rect', { x: x(i), y: top, width: L_W, height: L_H, rx: 6 }));
      g.appendChild(svg('text', { x: x(i) + L_W / 2, y: midY + 1 }, it.v));
      s.appendChild(g);
    });

    var seen = {};
    (p.pointers || []).forEach(function (q) {
      if (q.at < 0 || q.at >= n) return;
      var row = seen[q.at] || 0;
      seen[q.at] = row + 1;
      ptag(s, x(q.at) + L_W / 2, top + L_H + 10 + row * L_PTR_ROW, q.label, q.cls);
    });

    var holder = el('div', 'svg-scroll');
    holder.appendChild(s);
    root.appendChild(holder);
    return root;
  }

  // ---------- 面板：tree（二叉树，输入是力扣层序数组） ----------
  var T_DX = 40, T_DY = 54, T_R = 17, T_PAD = 20;

  function parseTree(arr) {
    if (!arr.length || arr[0] === null) return [];
    var root = { idx: 0, v: arr[0] }, q = [root], all = [root], i = 1;
    while (q.length && i < arr.length) {
      var cur = q.shift();
      if (i < arr.length) { if (arr[i] !== null) { cur.l = { idx: i, v: arr[i] }; q.push(cur.l); all.push(cur.l); } i++; }
      if (i < arr.length) { if (arr[i] !== null) { cur.r = { idx: i, v: arr[i] }; q.push(cur.r); all.push(cur.r); } i++; }
    }
    return all;
  }

  function treePanel(p) {
    var root = el('div', 'w w-tree');
    root.appendChild(el('div', 'w-title', p.title || ''));
    var all = parseTree(p.nodes);
    if (!all.length) { root.appendChild(el('span', 'chips-empty', '（空树）')); return root; }
    var col = 0, maxDepth = 0;
    (function walk(n, d) {
      if (!n) return;
      walk(n.l, d + 1);
      n.col = col++; n.depth = d; maxDepth = Math.max(maxDepth, d);
      walk(n.r, d + 1);
    })(all[0], 0);
    var byIdx = {};
    all.forEach(function (n) { n.cx = T_PAD + n.col * T_DX; n.cy = T_PAD + n.depth * T_DY; byIdx[n.idx] = n; });
    var hasLabels = (p.labels || []).length > 0;
    var W = T_PAD * 2 + (col - 1) * T_DX + 20, H = T_PAD * 2 + maxDepth * T_DY + (hasLabels ? 30 : 6);
    var s = svg('svg', { width: W, height: H, viewBox: '0 0 ' + W + ' ' + H, role: 'img' });

    all.forEach(function (n) {
      [n.l, n.r].forEach(function (c) {
        if (c) s.appendChild(svg('line', { x1: n.cx, y1: n.cy, x2: c.cx, y2: c.cy, 'class': 'tedge' }));
      });
    });
    all.forEach(function (n) {
      var g = svg('g', { 'class': svgCls('tg', p.marks[n.idx]) });
      g.appendChild(svg('circle', { cx: n.cx, cy: n.cy, r: T_R }));
      g.appendChild(svg('text', { x: n.cx, y: n.cy + 1 }, String(n.v)));
      s.appendChild(g);
    });
    (p.labels || []).forEach(function (q) {
      var n = byIdx[q.at];
      if (n) ptag(s, n.cx, n.cy + T_R + 8, q.label, q.cls);
    });
    var holder = el('div', 'svg-scroll');
    holder.appendChild(s);
    root.appendChild(holder);
    return root;
  }

  // ---------- 面板：grid（矩阵、DP 表） ----------
  function gridPanel(p) {
    var root = el('div', 'w w-grid');
    root.appendChild(el('div', 'w-title', p.title || ''));
    var rows = p.rows, cols = rows.length ? rows[0].length : 0;
    var hasR = !!p.rowLabels, hasC = !!p.colLabels;
    var g = el('div', 'grid');
    g.style.gridTemplateColumns = 'repeat(' + (cols + (hasR ? 1 : 0)) + ', 36px)';
    if (hasC) {
      if (hasR) g.appendChild(el('div', 'gl', p.corner || ''));
      for (var c = 0; c < cols; c++) g.appendChild(el('div', 'gl', p.colLabels[c] == null ? '' : p.colLabels[c]));
    }
    rows.forEach(function (row, r) {
      if (hasR) g.appendChild(el('div', 'gl', p.rowLabels[r] == null ? '' : p.rowLabels[r]));
      row.forEach(function (v, c) { g.appendChild(el('div', 'gc' + clsOf(p.marks[r + ',' + c]), v)); });
    });
    var holder = el('div', 'svg-scroll');
    holder.appendChild(g);
    root.appendChild(holder);
    return root;
  }

  var PANELS = { cells: cellsPanel, table: tablePanel, vars: varsPanel, list: listPanel, tree: treePanel, grid: gridPanel };

  /** 各面板位置上的固定尺寸：所有卡片取最大值，保证一排卡片对齐。 */
  function computeHints(frames) {
    var hints = [];
    frames.forEach(function (f) {
      f.panels.forEach(function (p, i) {
        var h = hints[i] || (hints[i] = { anyRange: false, maxStack: 1 });
        if (p.type !== 'cells') return;
        if (p.range) h.anyRange = true;
        var cnt = {};
        (p.pointers || []).forEach(function (q) {
          cnt[q.at] = (cnt[q.at] || 0) + 1;
          if (cnt[q.at] > h.maxStack) h.maxStack = cnt[q.at];
        });
      });
    });
    return hints;
  }

  function renderStory(root, frames, codeLines) {
    var hints = computeHints(frames);
    frames.forEach(function (f, i) {
      var card = el('figure', 'story-card');
      var head = el('div', 'story-head');
      head.appendChild(el('span', 'story-n', String(i + 1)));
      head.appendChild(el('span', 'story-cap', f.key));
      card.appendChild(head);
      var body = el('div', 'story-body');
      f.panels.forEach(function (p, k) {
        var make = PANELS[p.type];
        if (make) body.appendChild(make(p, hints[k] || { anyRange: false, maxStack: 1 }));
      });
      card.appendChild(body);
      var lines = window.Viz.resolveAt(f.at, codeLines, false);
      if (lines.length) card.appendChild(el('div', 'story-code', codeLines[lines[0] - 1].trim()));
      root.appendChild(card);
    });
  }

  window.renderStory = renderStory;
})();
