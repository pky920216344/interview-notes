/* 总览页：搜索，按难度 / 详解状态 / 标签 / 套路筛选。数据来自 index-data.js（file:// 下也能用）。 */
(function () {
  'use strict';
  var D = window.INDEX;
  var rowsEl = document.getElementById('rows');
  var q = document.getElementById('q');
  var tagSel = document.getElementById('tag');
  var algoSel = document.getElementById('algo');
  var LV = { 1: '简单', 2: '中等', 3: '困难' };

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var tagCount = {};
  D.rows.forEach(function (r) { r.g.forEach(function (t) { tagCount[t] = (tagCount[t] || 0) + 1; }); });
  Object.keys(tagCount).sort(function (a, b) { return tagCount[b] - tagCount[a]; }).forEach(function (t) {
    var o = document.createElement('option');
    o.value = t; o.textContent = t + '（' + tagCount[t] + '）';
    tagSel.appendChild(o);
  });

  // 套路下拉：计数口径与筛选一致——主套路或辅套路命中都算
  var algoCount = {};
  D.rows.forEach(function (r) {
    if (r.a) algoCount[r.a] = (algoCount[r.a] || 0) + 1;
    (r.x || []).forEach(function (t) { algoCount[t] = (algoCount[t] || 0) + 1; });
  });
  Object.keys(algoCount).sort(function (a, b) { return algoCount[b] - algoCount[a]; }).forEach(function (t) {
    var o = document.createElement('option');
    o.value = t; o.textContent = t + '（' + algoCount[t] + '）';
    algoSel.appendChild(o);
  });

  var doneTotal = D.rows.filter(function (r) { return r.w; }).length;
  document.getElementById('p-done').textContent = doneTotal;
  document.getElementById('p-total').textContent = D.total;
  document.getElementById('p-bar').style.width = (doneTotal / D.total * 100).toFixed(2) + '%';

  // 套路指南面板：选中套路时展开四段式说明（定义/怎么做/常见变体/代表题）
  var guideEl = document.getElementById('tech-guide');
  var byKey = {};
  D.rows.forEach(function (r) { byKey[r.k] = r; });
  function renderGuide(algo) {
    var g = (D.tech || {})[algo];
    if (!algo) {
      // 未选套路：给一条可见提示，指路「通用方法」在哪里
      guideEl.hidden = false;
      guideEl.innerHTML = '<p class="tg-hint">在左侧「套路」下拉里选一项（比如「动态规划」），这里会展开该套路的通用方法：是什么、怎么做、常见变体、代表题。</p>';
      return;
    }
    if (!g) { guideEl.hidden = true; guideEl.innerHTML = ''; return; }
    var reps = (g.rep || []).map(function (k) {
      var r = byKey[k];
      return r ? '<a href="entries/' + k + '.html">' + esc(r.t) + '</a>' : '';
    }).filter(Boolean).join('　');
    guideEl.innerHTML =
      '<h3>' + esc(algo) + '</h3>' +
      '<p class="tg-def">' + esc(g.def) + '</p>' +
      '<p class="tg-sec">怎么做</p>' +
      '<ol class="tg-how">' + g.how.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<p class="tg-sec">常见变体</p><p>' + esc(g.var) + '</p>' +
      '<p class="tg-sec">代表题</p><p class="tg-rep">' + reps + '</p>';
    guideEl.hidden = false;
  }

  function rowHtml(r) {
    var title = r.w ? '<a href="entries/' + r.k + '.html">' + esc(r.t) + '</a>' : '<span>' + esc(r.t) + '</span>';
    var algo = r.a ? '<span class="algo-badge">' + esc(r.a) + '</span>' : '—';
    return '<tr class="' + (r.w ? 'done' : 'pending') + '">' +
      '<td class="num">' + r.r + '</td>' +
      '<td class="fid">' + esc(r.f) + '</td>' +
      '<td class="t">' + title + '</td>' +
      '<td><span class="lv lv-' + r.l + '">' + LV[r.l] + '</span></td>' +
      '<td class="num">' + r.q + '</td>' +
      '<td class="al">' + algo + '</td>' +
      '<td class="st ' + (r.w ? 'ok' : 'none') + '">' + (r.w ? '已完成' : '待制作') + '</td></tr>';
  }

  function checkedValues(name) {
    return Array.prototype.map.call(document.querySelectorAll('input[name=' + name + ']:checked'), function (i) { return i.value; });
  }

  function render() {
    var kw = q.value.trim().toLowerCase();
    var lvs = checkedValues('lv');
    var doneMode = checkedValues('done')[0] || 'all';
    var tag = tagSel.value;
    var algo = algoSel.value;
    renderGuide(algo);
    var out = [];
    D.rows.forEach(function (r) {
      if (lvs.indexOf(String(r.l)) === -1) return;
      if (doneMode !== 'all' && String(r.w) !== doneMode) return;
      if (tag && r.g.indexOf(tag) === -1) return;
      if (algo && r.a !== algo && (r.x || []).indexOf(algo) === -1) return;
      if (kw && r.t.toLowerCase().indexOf(kw) === -1 && r.f.toLowerCase().indexOf(kw) === -1) return;
      out.push(rowHtml(r));
    });
    rowsEl.innerHTML = out.join('');
    document.getElementById('count').textContent = '显示 ' + out.length + ' / ' + D.total;
    document.getElementById('empty').hidden = out.length !== 0;
  }

  q.addEventListener('input', render);
  [].forEach.call(document.querySelectorAll('input[type=checkbox],input[type=radio]'), function (i) { i.addEventListener('change', render); });
  tagSel.addEventListener('change', render);
  algoSel.addEventListener('change', render);
  render();
})();
