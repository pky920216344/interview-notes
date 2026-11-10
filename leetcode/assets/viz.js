/*
 * 图解的纯数据层：不碰 DOM，浏览器里给 story.js 用，Node 里给 difftest.mjs 对拍用。
 *
 * 一个条目的 trace.js 定义：
 *   var STORY_INPUT = { ... };                      // 图解用的固定示例输入
 *   function trace(input) { return { frames: [...], result: <最优解的返回值> }; }
 * 帧 = { at, key, panels }，只在 3~6 个关键时刻拍：
 *   at     对应的 Java 代码锚点：行内文字片段（须唯一匹配一行）或行号，可以是数组，图解卡片上显示第一行
 *   key    这张图的一句话说明
 *   panels 面板数组，由下面的 cells / table / vars 构造
 * trace 要真的把最优解跑一遍并返回 result，difftest 用随机输入拿它和 Java 的结果对拍。
 * 高亮语义（marks / cls）：cur 当前、win 窗口内、bad 冲突、done 最终结果、dim 已丢弃、new 新写入、chg 刚变化、hit 刚被查询
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Viz = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** 单元格序列：数组、字符串、一维 DP 表。 */
  function cells(items, opts) {
    opts = opts || {};
    var marks = opts.marks || {};
    return {
      type: 'cells',
      title: opts.title || '',
      items: items.map(function (v, i) { return { v: String(v), cls: marks[i] || '' }; }),
      pointers: opts.pointers || [],   // [{ at, label, cls }]
      range: opts.range || null,       // { from, to, label, cls }
      hideIndex: !!opts.hideIndex
    };
  }

  /** 键值表（哈希表、map、计数表）：rows = [{ k, v, cls }]。 */
  function table(title, rows, opts) {
    opts = opts || {};
    return { type: 'table', title: title || '', hint: opts.hint || '', rows: rows };
  }

  /** 变量面板：items = [{ name, v, cls }]。 */
  function vars(items) {
    return { type: 'vars', items: items };
  }

  /**
   * 链表：values 按版面从左到右排；edges 缺省时画成 0→1→…→n-1 的一条链，也可显式给出任意箭头 [[from, to, cls?], …]
   * （比如反转之后向左指的箭头）；nulls 是 next 为空的结点下标，后面画一个 ∅（edges 缺省时默认最后一个结点）；
   * pointers 是挂在结点下方的小标签 [{ at, label, cls }]。
   */
  function list(values, opts) {
    opts = opts || {};
    var n = values.length;
    var edges = opts.edges;
    if (!edges) { edges = []; for (var i = 0; i + 1 < n; i++) edges.push([i, i + 1]); }
    var marks = opts.marks || {};
    return {
      type: 'list',
      title: opts.title || '',
      items: values.map(function (v, i) { return { v: String(v), cls: marks[i] || '' }; }),
      edges: edges.map(function (e) { return { from: e[0], to: e[1], cls: e[2] || '' }; }),
      nulls: opts.nulls || (opts.edges ? [] : (n ? [n - 1] : [])),
      pointers: opts.pointers || []
    };
  }

  /**
   * 二叉树：levelOrder 是力扣的层序数组（null 表示空位）；marks 的键是层序下标；
   * labels 是挂在结点下方的小标签 [{ at, label, cls }]，at 也是层序下标。
   */
  function tree(levelOrder, opts) {
    opts = opts || {};
    return { type: 'tree', title: opts.title || '', nodes: levelOrder.map(function (v) { return v === null || v === undefined ? null : String(v); }),
      marks: opts.marks || {}, labels: opts.labels || [] };
  }

  /**
   * 二维表格（矩阵、DP 表）：rows 是二维数组；marks 的键是 "行,列"；rowLabels / colLabels 画在表头；
   * corner 是左上角的说明文字。
   */
  function grid(rows, opts) {
    opts = opts || {};
    return { type: 'grid', title: opts.title || '', rows: rows.map(function (r) { return r.map(String); }), marks: opts.marks || {},
      rowLabels: opts.rowLabels || null, colLabels: opts.colLabels || null, corner: opts.corner || '' };
  }

  function frame(at, key, panels) {
    return { at: at, key: key, panels: panels };
  }

  /** 把 at 解析成 1 起始的行号数组；文字片段必须唯一匹配一行，否则 strict 时抛错（difftest 用它校验锚点）。 */
  function resolveAt(at, codeLines, strict) {
    var list = Array.isArray(at) ? at : (at == null ? [] : [at]);
    var out = [];
    list.forEach(function (a) {
      if (typeof a === 'number') { out.push(a); return; }
      var hits = [];
      codeLines.forEach(function (line, i) { if (line.indexOf(a) !== -1) hits.push(i + 1); });
      if (hits.length === 1) out.push(hits[0]);
      else if (strict) throw new Error('锚点 ' + JSON.stringify(a) + ' 匹配到 ' + hits.length + ' 行');
    });
    return out;
  }

  return { cells: cells, table: table, vars: vars, list: list, tree: tree, grid: grid, frame: frame, resolveAt: resolveAt };
});
