// 交八字：填生辰 → 在手机上用谷雨的公钥加密 → 作为一条 issue 交进私有仓库；
// 第二天同一台手机打开，点「签到」→ 在那条 issue 下留一条「签到」评论。
// 钥匙（只能读写这个仓库 issue 的 GitHub 令牌）放在群里那条链接的 #k= 后面，不进代码仓库。
(function () {
  'use strict';
  const C = window.SHENGCHEN;
  const $ = (id) => document.getElementById(id);
  const LS_LIST = 'shengchen.list.v1', LS_KEY = 'shengchen.key';
  const SHI = '子丑寅卯辰巳午未申酉戌亥';
  const WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水',
    寅: '木', 卯: '木', 巳: '火', 午: '火', 辰: '土', 戌: '土', 丑: '土', 未: '土', 申: '金', 酉: '金', 亥: '水', 子: '水' };
  const WXC = { 木: '#1e8e47', 火: '#c93a28', 土: '#8a5416', 金: '#c29200', 水: '#1f6dbf' };
  const POS = ['年柱', '月柱', '日柱', '时柱'];

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 无痕模式等：只存在这一页里 */ } },
  };
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const p2 = (n) => String(n).padStart(2, '0');
  // 签到一律按北京时间，不看手机设的时区。?t=2026-10-25T10:05 是给谷雨看的预览：假装那个北京时间，点签到也不会真交
  const OPEN = C.signinOpen || '10:00';
  const PREVIEW = (new URLSearchParams(location.search).get('t') || '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/);
  function bjNow() {
    if (PREVIEW) return { day: PREVIEW[1], hm: PREVIEW[2] };
    const s = new Date(Date.now() + 8 * 3600e3).toISOString();
    return { day: s.slice(0, 10), hm: s.slice(11, 16) };
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- 钥匙 ----------
  const hashKey = (location.hash.match(/k=([A-Za-z0-9_]+)/) || [])[1];
  if (hashKey) store.set(LS_KEY, hashKey);
  addEventListener('hashchange', () => location.reload());
  const token = hashKey || store.get(LS_KEY, '');

  // ---------- 加密：nacl.box 一次性密钥（相当于 sealed box），只有谷雨的私钥能开 ----------
  function b64e(u8) { let s = ''; for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]); return btoa(s); }
  function b64d(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  function seal(obj) {
    const eph = nacl.box.keyPair(), n = nacl.randomBytes(24);
    const c = nacl.box(new TextEncoder().encode(JSON.stringify(obj)), n, b64d(C.pub), eph.secretKey);
    const all = new Uint8Array(32 + 24 + c.length);
    all.set(eph.publicKey); all.set(n, 32); all.set(c, 56);
    return 'SEALED1:' + b64e(all);
  }

  // ---------- 交给 GitHub：网不好、太多人同时交就等一下再试 ----------
  async function api(path, body) {
    for (let i = 0; i < 5; i++) {
      let r;
      try {
        r = await fetch('https://api.github.com/repos/' + C.repo + path, {
          method: 'POST',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } catch (e) { if (i === 4) throw new Error('net'); await sleep(1500 * (i + 1)); continue; }
      if (r.ok) return r.json();
      const j = await r.json().catch(() => ({}));
      const limited = r.status === 429 || (r.status === 403 && /rate limit/i.test(j.message || ''));
      if (limited && i < 4) { await sleep(Math.max((+r.headers.get('retry-after') || 0) * 1000, 5000 * (i + 1))); continue; }
      if (r.status === 401 || r.status === 403 || r.status === 404) throw new Error('key');
      if (r.status >= 500 && i < 4) { await sleep(2000 * (i + 1)); continue; }
      throw new Error('http' + r.status);
    }
    throw new Error('net');
  }
  function errText(e) {
    if (e.message === 'key') return '链接过期了或者不对，找谷雨老师要一个新链接。';
    if (e.message === 'net') return '网不太好，没交上去，再点一次试试。';
    return '没交上去（' + e.message + '），再点一次；还不行就截图发给谷雨老师。';
  }

  // ---------- 下拉框 ----------
  const opt = (v, t) => '<option value="' + v + '">' + t + '</option>';
  const thisYear = new Date().getFullYear();
  function fillDate(y, m, d) {
    let h = opt('', '年');
    for (let i = thisYear; i >= 1940; i--) h += opt(i, i + ' 年');
    y.innerHTML = h;
    h = opt('', '月');
    for (let i = 1; i <= 12; i++) h += opt(i, i + ' 月');
    m.innerHTML = h;
    const days = () => {
      const keep = d.value, n = y.value && m.value ? new Date(+y.value, +m.value, 0).getDate() : 31;
      let s = opt('', '日');
      for (let i = 1; i <= n; i++) s += opt(i, i + ' 日');
      d.innerHTML = s;
      if (keep && +keep <= n) d.value = keep;
    };
    days();
    y.addEventListener('change', days); m.addEventListener('change', days);
  }
  fillDate($('y'), $('m'), $('d'));
  fillDate($('ly'), $('lm'), $('ld'));
  (function () {
    let h = opt('', '几点');
    for (let i = 0; i < 24; i++) h += opt(i, p2(i) + ' 点 · ' + SHI[Math.floor((i + 1) / 2) % 12] + '时');
    $('hh').innerHTML = h;
    h = opt('', '几分（可不选）');
    for (let i = 0; i < 60; i++) h += opt(i, p2(i) + ' 分');
    $('mi').innerHTML = h;
    h = opt('', '省份（可不选）');
    REGIONS.forEach((p, i) => { h += opt(i, p.n); });
    $('prov').innerHTML = h + opt('x', '港澳台 / 海外');
  })();
  function fillCity() {
    const pv = $('prov').value, isX = pv === 'x';
    $('abroad').classList.toggle('hidden', !isX);
    $('cityRow').classList.toggle('hidden', pv === '' || isX);
    if (pv === '' || isX) return;
    $('city').innerHTML = REGIONS[+pv].c.map((c, i) => opt(i, c.n)).join('');
    fillArea();
  }
  function fillArea() {
    const c = REGIONS[+$('prov').value].c[+$('city').value];
    $('area').innerHTML = opt('', '区县（可不选）') + c.a.map((a, i) => opt(i, a.n)).join('');
  }
  $('prov').addEventListener('change', fillCity);
  $('city').addEventListener('change', fillArea);
  fillCity();
  // 没选的下拉框显示成灰字
  document.querySelectorAll('select').forEach((s) => {
    const f = () => s.classList.toggle('ph', s.value === '');
    s.addEventListener('change', f); f();
  });
  $('unk').addEventListener('change', () => { $('hh').disabled = $('mi').disabled = $('unk').checked; preview(); });

  // ---------- 读表、排八字预览 ----------
  function place() {
    const pv = $('prov').value;
    if (pv === '') return { place: '', lon: null, pk: null };
    if (pv === 'x') { const t = $('abroad').value.trim(); return { place: t ? '港澳台/海外·' + t : '港澳台/海外', lon: null, pk: ['x', t] }; }
    const p = REGIONS[+pv], c = p.c[+$('city').value], ai = $('area').value;
    if (ai !== '') { const a = c.a[+ai]; return { place: p.n + '·' + c.n + '·' + a.n, lon: a.g ? a.g[0] : null, pk: [+pv, +$('city').value, +ai] }; }
    const ls = c.a.filter((a) => a.g).map((a) => a.g[0]);
    return { place: p.n + '·' + c.n, lon: ls.length ? Math.round(ls.reduce((s, x) => s + x, 0) / ls.length * 1000) / 1000 : null, pk: [+pv, +$('city').value, ''] };
  }
  function read() {
    const y = $('y').value, m = $('m').value, d = $('d').value, unk = $('unk').checked;
    const hh = $('hh').value, mi = $('mi').value || '0';
    const f = { nick: $('nick').value.trim(), q: $('q').value.trim(), unk, ...place() };
    if (!y || !m || !d) return { ...f, need: '出生日期还没选完。' };
    if (!unk && hh === '') return { ...f, need: '选一下几点出生；不记得就勾「不记得几点出生」。' };
    f.date = y + '-' + p2(m) + '-' + p2(d);
    f.time = unk ? '' : p2(hh) + ':' + p2(mi);
    const clock = { y: +y, m: +m, d: +d, hh: unk ? 12 : +hh, mi: unk ? 0 : +mi };
    const r = BaziCore.computeChart({ clock, gender: '坤', ...(f.lon != null ? { lon: f.lon, trueSolar: true } : { trueSolar: false }), ziShiSect: 'wenzhen' });
    f.pillars = [r.pillars.year, r.pillars.month, r.pillars.day, unk ? '' : r.pillars.hour];
    f.solar = f.lon != null && !unk ? p2(r.trueSolarClock.hh) + ':' + p2(r.trueSolarClock.mi) : '';
    f.dst = !unk && BaziCore.inChinaDst(clock);
    return f;
  }
  function gzHtml(g) {
    if (!g) return '<div class="gz ph">？</div>';
    return '<div class="gz">' + [...g].map((c) => '<span style="color:' + WXC[WX[c]] + '">' + c + '</span>').join('<br>') + '</div>';
  }
  function pillarsHtml(ps) {
    return POS.map((p, i) => '<div><div class="pos">' + p + '</div>' + gzHtml(ps[i]) + '</div>').join('');
  }
  function preview() {
    const f = read();
    if (f.need) {
      $('pv').innerHTML = POS.map((p) => '<div><div class="pos">' + p + '</div><div class="gz ph">？</div></div>').join('');
      $('pvNote').textContent = '填好日期和时间，这里自己出来';
      return;
    }
    $('pv').innerHTML = pillarsHtml(f.pillars);
    const notes = [];
    if (f.unk) notes.push('时柱先空着，问到出生时间再补');
    else if (f.solar) notes.push('按出生地的太阳时 ' + f.solar + ' 排');
    if (f.dst) notes.push('1986–1991 年夏天出生的，家里记的可能是当年的夏令时，谷雨老师会帮你核对');
    $('pvNote').textContent = notes.join('；');
  }
  ['y', 'm', 'd', 'hh', 'mi', 'prov', 'city', 'area'].forEach((id) => $(id).addEventListener('change', preview));
  $('abroad').addEventListener('input', preview);

  // ---------- 我交过的 ----------
  let list = store.get(LS_LIST, []);
  let editing = null;
  const save = () => store.set(LS_LIST, list);
  function whenText(r) {
    const [y, m, d] = r.date.split('-').map(Number);
    return y + ' 年 ' + m + ' 月 ' + d + ' 日 · ' + (r.unk ? '时辰不详' : r.time) + (r.place ? '<br>' + esc(r.place) : '');
  }
  let shown = '';
  const phase = () => { const t = bjNow(); return t.day + (t.hm >= OPEN ? '+' : '-'); };
  function render() {
    const t = bjNow(), open = t.hm >= OPEN;
    shown = phase();
    $('mine').innerHTML = list.map((r, i) => {
      let state;
      if (r.signed === t.day) state = '<div class="state ok">已签到 ✓ 谷雨老师知道你来了' + (PREVIEW ? '（预览，没有真签）' : '') + '</div>';
      else if (t.day > r.day && open) state = '<div class="acts"><button class="btn ok" data-sign="' + i + '">我到了，签到 ✓</button></div><div class="err" id="se' + i + '"></div>';
      else if (t.day > r.day) state = '<div class="state">今天上午 <b>' + OPEN + '</b> 开始签到（北京时间），<br>到点这里会出现签到按钮。</div>';
      else state = '<div class="state">明天上午 <b>' + OPEN + '</b> 起（北京时间），再扫一次码或者点开这条链接，<b>点「签到」</b>。签了到的盘，谷雨老师才会在课上讲。</div>';
      return '<section class="win"><div class="bar"><span>已交给谷雨老师.exe</span><span class="btns"><i></i><i></i><i></i></span></div><div class="body">' +
        '<div class="stamp">✓ 交好了</div><div class="who">' + esc(r.nick) + '</div><div class="when">' + whenText(r) + '</div>' +
        '<div class="pillars">' + pillarsHtml(r.pillars) + '</div>' + state +
        '<button class="link soft" data-edit="' + i + '">填错了？重新填</button></div></section>';
    }).join('');
    $('mine').querySelectorAll('[data-sign]').forEach((b) => { b.onclick = () => signIn(+b.dataset.sign, b); });
    $('mine').querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => edit(+b.dataset.edit); });
    const showForm = !list.length || editing;
    $('form').classList.toggle('hidden', !showForm || !$('lost').classList.contains('hidden'));
    $('mine').classList.toggle('hidden', !!editing);
    $('cancelEdit').classList.toggle('hidden', !editing);
    $('toLost').classList.toggle('hidden', !!list.length);
    $('send').textContent = editing ? '改好了，重新交 ▶' : '交给谷雨老师 ▶';
  }

  async function send() {
    $('err').textContent = '';
    const f = read();
    if (!f.nick) { $('err').textContent = '先写一下怎么称呼你。'; $('nick').focus(); return; }
    if (f.need) { $('err').textContent = f.need; return; }
    const b = $('send'); b.disabled = true; b.textContent = '加密、交上去……';
    try {
      const body = { v: 1, type: 'sub', nick: f.nick, date: f.date, time: f.time, unk: f.unk, place: f.place, lon: f.lon, q: f.q,
        pillars: f.pillars.join(' ').trim(), dst: f.dst, at: new Date().toISOString(), replaces: editing ? editing.n : null };
      const iss = await api('/issues', { title: '生辰', body: seal(body) });
      const rec = { n: iss.number, nick: f.nick, date: f.date, time: f.time, unk: f.unk, place: f.place, pk: f.pk, q: f.q, pillars: f.pillars, day: bjNow().day, signed: null };
      if (editing) { rec.signed = editing.signed; list = list.filter((r) => r.n !== editing.n); }
      list.push(rec); save(); editing = null; render(); scrollTo(0, 0);
    } catch (e) {
      $('err').textContent = errText(e);
    } finally { b.disabled = false; render(); }
  }

  async function signIn(i, b) {
    const r = list[i]; b.disabled = true; b.textContent = '签到中……';
    if (PREVIEW) { r.signed = bjNow().day; render(); return; }
    try {
      await api('/issues/' + r.n + '/comments', { body: '签到 ' + new Date().toISOString() });
      r.signed = bjNow().day; save(); render();
    } catch (e) { b.disabled = false; b.textContent = '我到了，签到 ✓'; $('se' + i).textContent = errText(e); }
  }

  function setSel(id, v) { $(id).value = v; $(id).dispatchEvent(new Event('change')); }
  function edit(i) {
    const r = list[i]; editing = r;
    $('nick').value = r.nick; $('q').value = r.q || '';
    const [y, m, d] = r.date.split('-').map(Number);
    setSel('y', y); setSel('m', m); setSel('d', d);
    $('unk').checked = !!r.unk; $('unk').dispatchEvent(new Event('change'));
    if (!r.unk) { const [hh, mi] = r.time.split(':').map(Number); setSel('hh', hh); setSel('mi', mi); }
    const pk = r.pk;
    if (!pk) setSel('prov', '');
    else if (pk[0] === 'x') { setSel('prov', 'x'); $('abroad').value = pk[1] || ''; }
    else { setSel('prov', pk[0]); setSel('city', pk[1]); setSel('area', pk[2]); }
    preview(); render(); scrollTo(0, 0);
  }
  $('cancelEdit').onclick = () => { editing = null; render(); scrollTo(0, 0); };
  $('send').onclick = send;

  // ---------- 换了手机：按称呼＋生日签到 ----------
  $('toLost').onclick = () => { $('lost').classList.remove('hidden'); $('form').classList.add('hidden'); scrollTo(0, 0); };
  $('lBack').onclick = () => { $('lost').classList.add('hidden'); render(); scrollTo(0, 0); };
  $('lSend').onclick = async () => {
    const nick = $('lNick').value.trim(), y = $('ly').value, m = $('lm').value, d = $('ld').value;
    $('lErr').textContent = '';
    if (!nick) { $('lErr').textContent = '写一下称呼。'; return; }
    if (!y || !m || !d) { $('lErr').textContent = '出生日期还没选完。'; return; }
    if (bjNow().hm < OPEN) { $('lErr').textContent = '签到上午 ' + OPEN + ' 才开始（北京时间），到点再点。'; return; }
    const b = $('lSend'); b.disabled = true; b.textContent = '签到中……';
    try {
      if (!PREVIEW) await api('/issues', { title: '签到', body: seal({ v: 1, type: 'checkin', nick, date: y + '-' + p2(m) + '-' + p2(d), at: new Date().toISOString() }) });
      b.classList.add('hidden');
      $('lErr').innerHTML = '<div class="state ok">签到好了 ✓ 谷雨老师那边会对上你的盘</div>';
    } catch (e) { b.disabled = false; b.textContent = '签到 ✓'; $('lErr').textContent = errText(e); }
  };

  // ---------- 开场 ----------
  if (!token) { $('noKey').classList.remove('hidden'); return; }
  preview(); render();
  // 页面一直开着的：到了 10 点、过了零点，自己换成签到按钮
  setInterval(() => { if (phase() !== shown && !editing) render(); }, 20000);
})();
