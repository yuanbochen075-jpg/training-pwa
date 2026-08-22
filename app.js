/* app.js — 训练助手 PWA */
(function () {
  'use strict';

  // ---------- 工具 ----------
  function pad(n) { return String(n).padStart(2, '0'); }
  function todayStr() { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseDate(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }
  function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function diffDays(a, b) { return Math.round((parseDate(b) - parseDate(a)) / 86400000); }
  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(id) { return document.getElementById(id); }

  const PLAN = window.PLAN;
  if (!PLAN) { document.body.innerHTML = '<p style="padding:20px">plan-data.js 加载失败</p>'; return; }

  // ---------- 状态 ----------
  const dateOverride = qs('date');
  const currentDate = /^\d{4}-\d{2}-\d{2}$/.test(dateOverride || '') ? dateOverride : todayStr();
  const start = PLAN.programStart;
  const daysSinceStart = diffDays(start, currentDate);
  const weekIdx = Math.floor(daysSinceStart / 7) + 1;
  const dayIdx = (daysSinceStart % 7) + 1;
  let allDays = [];
  PLAN.weeks.forEach(function (w) { w.days.forEach(function (d) { allDays.push(d); }); });
  const todayPlan = allDays.find(function (d) { return d.date === currentDate; });
  const weekPlan = PLAN.weeks[weekIdx - 1] || null;

  let checkins = {}, sleeps = {}, tests = {}, exercises = {}, dayItems = {}, coros = null, settings = {};
  let privKey = null;

  // ---------- 加密辅助 ----------
  async function encryptCheckin(d) { return privKey ? CryptoBox.encryptFields(d, privKey, ['mast', 'weight', 'note']) : d; }
  async function decryptCheckin(d) { return privKey ? CryptoBox.decryptFields(d, privKey) : d; }
  async function encryptSleep(d) { return privKey ? CryptoBox.encryptFields(d, privKey, ['deep', 'light', 'rem', 'note']) : d; }
  async function decryptSleep(d) { return privKey ? CryptoBox.decryptFields(d, privKey) : d; }

  // ---------- 数据保存 ----------
  async function saveCheckin() { await API.save('checkin', currentDate, await encryptCheckin(checkins[currentDate])); }
  async function saveSleep(date, data) { await API.save('sleep', date, await encryptSleep(data)); }
  async function saveTests() { for (const k of Object.keys(tests)) await API.save('test', k, tests[k]); }
  async function saveExercise(id, data) { await API.save('exercise', id, data); }
  async function removeExercise(id) { await API.remove('exercise', id); }
  async function saveDayItems(date, arr) { await API.save('dayItem', date, arr); }
  async function saveCoros(snap) { await API.saveCoros(snap); }

  // ---------- 登录 / 启动 ----------
  function showOverlay(id) { const o = $(id); if (o) o.classList.remove('hidden'); }
  function hideOverlay(id) { const o = $(id); if (o) o.classList.add('hidden'); }

  async function boot() {
    setupTabs();
    renderHeader();
    bindAuth();
    bindPrivacy();
    if (API.isCloud() && !API.session()) {
      showOverlay('loginOverlay');
      $('loginHint').textContent = '云端模式：登录你的账号（没有就先注册）';
      return;
    }
    await loadAllData();
    const needPriv = settings.privacy && !privKey;
    if (needPriv) { showOverlay('privacyOverlay'); return; }
    finishBoot();
  }

  async function loadAllData() {
    const d = await API.loadAll();
    checkins = d.checkins || {};
    sleeps = d.sleep || {};
    tests = d.tests || {};
    exercises = d.exercises || {};
    dayItems = d.dayItems || {};
    coros = d.coros || null;
    settings = d.settings || {};
    if (privKey) {
      const dc = {}, ds = {};
      for (const k of Object.keys(checkins)) dc[k] = await decryptCheckin(checkins[k]);
      for (const k of Object.keys(sleeps)) ds[k] = await decryptSleep(sleeps[k]);
      checkins = dc; sleeps = ds;
    }
  }

  function finishBoot() {
    updateServerHint();
    updateSleepBanner();
    switchTab(sleeps[currentDate] ? 'today' : 'sleep');
    renderToday();
    renderNextPreview();
    fillCheckinForm();
    renderWeekCheckins();
    renderSleepForm();
    renderSleepAutoEval();
    renderSleepHistory();
    renderSleepWeekAvg();
    renderStats();
    renderTestForm();
    renderTestProgress();
    renderCoros();
    renderExercises();
    renderSettings();
    renderReminders();
    renderAccount();
    bindEvents();
    scheduleReminders();
    registerSW();
  }
  // ---------- 登录 ----------
  let authBound = false;
  function bindAuth() {
    if (authBound) return;
    authBound = true;
    $('btnLogin').addEventListener('click', async function () {
      const msg = $('loginMsg');
      try {
        await API.signIn($('loginEmail').value.trim(), $('loginPass').value);
        msg.textContent = '登录成功';
        hideOverlay('loginOverlay');
        await boot();
      } catch (e) { msg.className = 'form-msg err'; msg.textContent = '登录失败：' + e.message; }
    });
    $('btnSignup').addEventListener('click', async function () {
      const msg = $('loginMsg');
      try {
        await API.signUp($('loginEmail').value.trim(), $('loginPass').value);
        if (API.session()) {
          msg.textContent = '注册成功';
          hideOverlay('loginOverlay');
          await boot();
        } else {
          msg.style.color = '#4ade80'; msg.className = 'form-msg'; msg.textContent = '✔ 注册成功！确认邮件已发送到 ' + $('loginEmail').value.trim() + '，去邮箱点确认链接后回来登录';
        }
      } catch (e) { msg.className = 'form-msg err'; msg.textContent = '注册失败：' + e.message; }
    });
    $('btnLocalMode').addEventListener('click', function () { hideOverlay('loginOverlay'); boot(); });
  }

  // ---------- 隐私密码 ----------
  async function setPrivacy(pass) {
    const salt = CryptoBox.newSalt();
    const key = await CryptoBox.deriveKey(pass, salt);
    const check = await CryptoBox.encryptText('OK', key);
    settings.privacy = { salt: salt, check: check };
    await API.saveSetting('privacy', settings.privacy);
    privKey = key;
    await loadAllData();
  }
  async function unlockPrivacy(pass) {
    const p = settings.privacy;
    const key = await CryptoBox.deriveKey(pass, p.salt);
    const ok = await CryptoBox.decryptText(p.check, key);
    if (ok !== 'OK') throw new Error('隐私密码错误');
    privKey = key;
    await loadAllData();
  }
  let privacyBound = false;
  function bindPrivacy() {
    if (privacyBound) return;
    privacyBound = true;
    $('btnUnlock').addEventListener('click', async function () {
      const msg = $('privMsg');
      try {
        if (settings.privacy) await unlockPrivacy($('privPass').value);
        else await setPrivacy($('privPass').value);
        msg.textContent = '✔ 已解锁';
        hideOverlay('privacyOverlay');
        finishBoot();
      } catch (e) { msg.className = 'form-msg err'; msg.textContent = e.message; }
    });
    $('btnSkipPriv').addEventListener('click', function () { hideOverlay('privacyOverlay'); finishBoot(); });
  }

  // ---------- 标签 ----------
  function setupTabs() {
    document.querySelectorAll('.tab').forEach(function (btn) {
      btn.addEventListener('click', function () { switchTab(btn.getAttribute('data-tab')); });
    });
  }
  function switchTab(name) {
    document.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === name); });
    document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + name); });
  }
  function updateServerHint() {
    const h = $('serverHint');
    if (!h) return;
    h.textContent = API.isCloud()
      ? '云端模式 · 数据自动同步（' + (API.session() ? API.session().user.email : '未登录') + '）'
      : '本地模式 · 数据保存在本机浏览器';
  }
  function updateSleepBanner() {
    const b = $('sleepBanner');
    if (!b) return;
    b.style.display = sleeps[currentDate] ? 'none' : 'flex';
  }

  // ---------- 头部 ----------
  function renderHeader() {
    const d = parseDate(currentDate);
    const dow = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    $('dateLine').textContent = currentDate + ' 周' + dow;
    if (daysSinceStart < 0) { $('weekLine').textContent = '计划尚未开始（2026-08-22 起算）'; $('phaseLine').textContent = ''; }
    else if (weekIdx > PLAN.totalWeeks) { $('weekLine').textContent = '24周计划已完成，进入长期耐力周期'; $('phaseLine').textContent = ''; }
    else { $('weekLine').textContent = '第 ' + weekIdx + ' / ' + PLAN.totalWeeks + ' 周 · 第 ' + dayIdx + ' 天'; $('phaseLine').textContent = '阶段：' + (weekPlan ? weekPlan.phase : ''); }
  }

  // ---------- 睡眠状态与自动调整 ----------
  function fmtMin(min) {
    if (min == null || isNaN(min)) return '—';
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return h + 'h' + String(m).padStart(2, '0') + 'm';
  }
  function minFromHM(s) { if (!s) return null; const p = String(s).split(':').map(Number); return (p.length < 2 || isNaN(p[0]) || isNaN(p[1])) ? null : p[0] * 60 + p[1]; }
  function rangeMin(bedtime, wake) { const b = minFromHM(bedtime), w = minFromHM(wake); if (b == null || w == null) return null; let d = w - b; if (d <= 0) d += 1440; return d; }
  function autoSleepScore(s) {
    const range = rangeMin(s.bedtime, s.wake);
    const deep = Number(s.deep) || 0, light = Number(s.light) || 0, rem = Number(s.rem) || 0;
    const stages = deep + light + rem;
    const total = range != null ? range : stages;
    if (!total) return { score: null, parts: [] };
    const parts = [];
    const durScore = Math.max(0, Math.min(10, 10 - Math.max(0, 450 - total) / 30));
    parts.push({ name: '时长', weight: 0.4, score: durScore, text: fmtMin(total) });
    let bedScore = 5;
    const b = minFromHM(s.bedtime);
    if (b != null) { const target = 23 * 60; let diff = Math.abs(b - target); if (diff > 720) diff = 1440 - diff; bedScore = diff <= 30 ? 10 : diff <= 60 ? 7 : diff <= 120 ? 4 : 2; }
    parts.push({ name: '入睡', weight: 0.2, score: bedScore, text: s.bedtime || '' });
    let weightSum = 0.6;
    if (stages > 0) {
      const deepPct = deep / stages * 100, remPct = rem / stages * 100;
      const pctScore = function (pct, lo, hi, llo, lhi) { if (pct >= lo && pct <= hi) return 10; if (pct >= llo && pct <= lhi) return 7; return 3; };
      parts.push({ name: '深睡', weight: 0.2, score: pctScore(deepPct, 13, 23, 10, 25), text: Math.round(deepPct) + '%' });
      parts.push({ name: 'REM', weight: 0.2, score: pctScore(remPct, 20, 25, 15, 28), text: Math.round(remPct) + '%' });
      weightSum = 1;
    }
    const score = parts.reduce(function (acc, p) { return acc + p.score * p.weight; }, 0) / weightSum;
    return { score: Math.round(score * 10) / 10, parts: parts };
  }
  function sleepStatus() {
    const s = sleeps[currentDate];
    if (!s) return { level: 'none', label: '未记录睡眠', detail: '', auto: null, personal: null, combined: null };
    const auto = autoSleepScore(s);
    const personal = Number(s.state) || Number(s.quality) || 0;
    const autoScore = auto.score != null ? auto.score : personal;
    const combined = Math.round((autoScore * 0.6 + personal * 0.4) * 10) / 10;
    let level, label;
    if (combined < 5 || autoScore <= 3 || (personal > 0 && personal <= 2)) { level = 'low'; label = '恢复不足'; }
    else if (combined < 7) { level = 'light'; label = '轻度疲劳'; }
    else { level = 'full'; label = '恢复良好'; }
    return { level: level, label: label, auto: autoScore, personal: personal, combined: combined };
  }
  function adjustedDay(plan, status) {
    if (!plan || status.level === 'none' || status.level === 'full') return plan;
    const low = status.level === 'low';
    const copy = JSON.parse(JSON.stringify(plan));
    if (low) {
      if (copy.type === 'speed' || copy.type === 'speedEnd') { copy.title = '恢复不足 · 改为轻松有氧'; copy.main = [{ name: 'Zone2慢跑', detail: '30-40min，心率120-130，不冲刺、不跳深' }]; copy.note = '睡眠不足：自动降级为轻松有氧'; }
      else if (copy.type === 'lower') { copy.title = '恢复不足 · 下肢轻力量'; copy.main = [{ name: '杠铃深蹲', detail: '3×5 @70%计划重量' }, { name: '相扑硬拉', detail: '2×5 @70%' }, { name: '保加利亚分腿蹲', detail: '2×8每侧 轻' }]; copy.note = '睡眠不足：减量减重，不做跳深/大重量'; }
      else if (copy.type === 'upper') { copy.title = '恢复不足 · 上肢轻量'; copy.main = copy.main.slice(0, 4).map(function (m) { return { name: m.name, detail: m.detail + '（减量30%）' }; }); copy.note = '睡眠不足：组数/重量减30%'; }
      else if (copy.type === 'aerobic' || copy.type === 'longAerobic') { copy.main = [{ name: 'Zone2慢跑', detail: '30min，心率120-130' }]; copy.note = '睡眠不足：缩短时长、降低心率'; }
      else if (copy.type === 'test') { copy.note = (copy.note ? copy.note + ' | ' : '') + '睡眠不足：建议推迟测试'; }
    } else {
      copy.note = (copy.note ? copy.note + ' | ' : '') + '轻度疲劳：总量减20-30%、取消最大冲刺/跳深、重量降一档';
      if (copy.type === 'speed' || copy.type === 'speedEnd') copy.main = copy.main.filter(function (m) { return !/跳深|跳箱/.test(m.name); }).map(function (m) { return { name: m.name, detail: m.detail + '（强度降一档）' }; });
      if (copy.type === 'lower' || copy.type === 'upper') copy.main = copy.main.map(function (m) { return { name: m.name, detail: m.detail + '（重量-10~15%）' }; });
    }
    return copy;
  }
  // ---------- 今日 ----------
  function renderToday() {
    if (!todayPlan) { $('todayBody').innerHTML = '<div class="empty">计划未开始</div>'; return; }
    const st = sleepStatus();
    const p = adjustedDay(todayPlan, st);
    const badge = p.type === 'rest' ? '<span class="badge rest">休息</span>' : p.type === 'test' ? '<span class="badge test">测试</span>' : '<span class="badge">训练</span>';
    let html = '<div class="card-title">' + esc(p.title) + badge + '</div>';
    html += '<div class="kv"><b>今日状态：</b><span class="val">' + esc(st.label) + (st.level === 'low' || st.level === 'light' ? ' · 计划已自动调整' : '') + '</span></div>';
    if (st.level !== 'none') html += '<div class="kv"><b>评测：</b><span class="val">自动 ' + (st.auto != null ? st.auto : '—') + ' · 个人 ' + (st.personal || '—') + ' · 综合 ' + (st.combined != null ? st.combined : '—') + '</span></div>';
    html += '<div class="venue">' + esc(p.venue) + ' · ' + esc(p.duration) + ' · ' + esc(p.phase) + '</div>';
    if (p.warmup) html += '<div class="kv"><b>热身：</b><span class="val">' + esc(p.warmup) + '</span></div>';
    if (p.main && p.main.length) {
      html += '<ul class="exercise-list">';
      p.main.forEach(function (m) { html += '<li><span class="exercise-name">' + esc(m.name) + '</span><span class="exercise-detail">' + esc(m.detail) + '</span></li>'; });
      html += '</ul>';
    }
    if (p.note) html += '<div class="note">💡 ' + esc(p.note) + '</div>';
    $('todayBody').innerHTML = html;

    const s = p.sleep || PLAN.sleepRule;
    $('sleepBody').innerHTML = '<div class="kv"><b>入睡：</b><span class="val">' + esc(s.bedtime) + '</span>　<b>起床：</b><span class="val">' + esc(s.wake) + '</span></div><div class="kv"><b>目标：</b><span class="val">' + esc(s.hours) + ' · ' + esc(s.nap) + '</span></div>';

    const sex = p.sex || { allowed: false, reason: '' };
    const weekMast = weekMastCount();
    const remain = Math.max(0, PLAN.sexWeeklyLimit - weekMast);
    $('sexTitle').textContent = '🔞 手淫规则' + (sex.allowed ? ' · 今晚允许' : ' · 今天不建议');
    $('sexBody').innerHTML = '<div class="kv"><b>今天：</b><span class="val">' + (sex.allowed ? '允许（建议睡前，别影响睡眠）' : '禁止/不建议') + '</span></div><div class="kv"><b>原因：</b><span class="val">' + esc(sex.reason) + '</span></div><div class="kv"><b>本周额度：</b><span class="val">已用 ' + weekMast + ' / ' + PLAN.sexWeeklyLimit + '，剩余 ' + remain + '</span></div>';

    let fhtml = '';
    (p.foods || []).forEach(function (f) { fhtml += '<div class="kv"><b>' + esc(f.when) + '：</b><span class="val">' + esc(f.items) + '</span></div>'; });
    $('foodBody').innerHTML = fhtml || '<div class="empty">无</div>';

    const rules = ['酒精=0（含药酒）', '手淫每周≤' + PLAN.sexWeeklyLimit + '次，训练日/测试前48h禁止', '睡眠 23:00-07:00，午休≤20min', '体重 67-70kg，蛋白质110-135g/天', '膝/腰疼痛立即降档'];
    $('ruleBody').innerHTML = rules.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('');

    renderDayCustom();
  }

  function renderDayCustom() {
    const box = $('dayCustomBox');
    if (!box) return;
    const items = dayItems[currentDate] || [];
    const list = Object.keys(exercises);
    let html = '';
    if (list.length) {
      html += '<select id="dc-select"><option value="">选择运动库项目…</option>';
      list.forEach(function (id) { const e = exercises[id]; html += '<option value="' + esc(id) + '">' + esc(e.name) + '（' + esc(e.cat) + '）</option>'; });
      html += '</select> <button class="btn" id="btn-dc-add">加入今天</button>';
    } else {
      html += '<div class="empty">运动库还没有项目，去「运动库」添加</div>';
    }
    if (items.length) {
      html += '<ul class="exercise-list">';
      items.forEach(function (it, i) {
        html += '<li><span class="exercise-name">' + esc(it.name) + '</span><span class="exercise-detail">' + esc(it.detail || '') + ' <button class="btn mini" data-rm="' + i + '">移除</button></span></li>';
      });
      html += '</ul>';
    }
    box.innerHTML = html;
    const addBtn = $('btn-dc-add');
    if (addBtn) addBtn.addEventListener('click', async function () {
      const sel = $('dc-select');
      const id = sel.value;
      if (!id) return;
      const e = exercises[id];
      const arr = (dayItems[currentDate] || []).concat([{ name: e.name, detail: e.detail || '', cat: e.cat || '', color: e.color || '' }]);
      dayItems[currentDate] = arr;
      await saveDayItems(currentDate, arr);
      renderDayCustom();
    });
    box.querySelectorAll('[data-rm]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const arr = (dayItems[currentDate] || []).filter(function (_, i) { return i !== Number(btn.getAttribute('data-rm')); });
        dayItems[currentDate] = arr;
        await saveDayItems(currentDate, arr);
        renderDayCustom();
      });
    });
  }

  function renderNextPreview() {
    const card = $('nextCard');
    if (!card) return;
    const show = qs('next') === '1' || new Date().getHours() >= 18;
    const next = allDays.find(function (d) { return d.date === addDays(currentDate, 1); });
    if (!show || !next) { card.style.display = 'none'; return; }
    card.style.display = '';
    let html = '<div class="kv"><b>' + esc(next.title) + '</b><span class="val"> ' + esc(next.venue) + ' · ' + esc(next.duration) + '</span></div>';
    if (next.main && next.main.length) {
      html += '<ul class="exercise-list">';
      next.main.forEach(function (m) { html += '<li><span class="exercise-name">' + esc(m.name) + '</span><span class="exercise-detail">' + esc(m.detail) + '</span></li>'; });
      html += '</ul>';
    }
    const sex = next.sex || {};
    html += '<div class="kv"><b>手淫：</b><span class="val">' + (sex.allowed ? '允许' : '不建议') + '</span></div>';
    if (next.note) html += '<div class="note">💡 ' + esc(next.note) + '</div>';
    $('nextBody').innerHTML = html;
  }

  // ---------- 睡眠 ----------
  function renderSleepForm() {
    const s = sleeps[currentDate] || {};
    $('sl-date').value = currentDate;
    $('sl-bedtime').value = s.bedtime || '23:30';
    $('sl-wake').value = s.wake || '07:00';
    $('sl-deep').value = s.deep != null ? s.deep : 90;
    $('sl-light').value = s.light != null ? s.light : 240;
    $('sl-rem').value = s.rem != null ? s.rem : 90;
    $('sl-state').value = (s.state != null ? s.state : (s.quality != null ? s.quality : 7));
    $('sl-note').value = s.note || '';
  }
  function readSleepForm() {
    return {
      bedtime: $('sl-bedtime').value,
      wake: $('sl-wake').value,
      deep: Math.max(0, parseInt($('sl-deep').value, 10) || 0),
      light: Math.max(0, parseInt($('sl-light').value, 10) || 0),
      rem: Math.max(0, parseInt($('sl-rem').value, 10) || 0),
      state: Math.max(1, Math.min(10, parseInt($('sl-state').value, 10) || 7)),
      quality: Math.max(1, Math.min(10, parseInt($('sl-state').value, 10) || 7)),
      note: $('sl-note').value.trim()
    };
  }
  function renderSleepAutoEval() {
    const box = $('sleepAutoEval');
    if (!box) return;
    const s = readSleepForm();
    const res = autoSleepScore(s);
    if (res.score == null) { box.innerHTML = '自动评测：—（请填写入睡/起床时间）'; return; }
    const grade = res.score >= 8 ? '优秀' : res.score >= 6 ? '尚可' : '较差';
    const personal = Number(s.state) || 0;
    const combined = Math.round((res.score * 0.6 + personal * 0.4) * 10) / 10;
    box.innerHTML = '自动评测：<b>' + res.score + '/10（' + grade + '）</b>　个人状态：' + personal + '　综合：' + combined + '<br>' + res.parts.map(function (p) { return p.name + ' ' + p.score + '分'; }).join(' · ');
  }
  async function onSaveSleep() {
    const date = $('sl-date').value;
    const msg = $('sleepMsg');
    if (!date) { msg.textContent = '请选择日期'; msg.className = 'form-msg err'; return; }
    sleeps[date] = readSleepForm();
    renderSleepAutoEval();
    try { await saveSleep(date, sleeps[date]); msg.textContent = '✔ 已保存' + (API.isCloud() ? '并同步云端' : '（本机）'); msg.className = 'form-msg'; }
    catch (e) { msg.textContent = '保存失败：' + e.message; msg.className = 'form-msg err'; }
    renderSleepHistory(); renderSleepWeekAvg(); updateSleepBanner(); renderToday(); renderNextPreview(); switchTab('today');
  }
  function renderSleepHistory() {
    const box = $('sleepHistory');
    const dates = Object.keys(sleeps).sort().reverse().slice(0, 7);
    if (!dates.length) { box.innerHTML = '<div class="empty">暂无记录</div>'; return; }
    let html = '<table><tr><th>日期</th><th>入睡-起床</th><th>范围</th><th>深睡</th><th>浅睡</th><th>REM</th><th>个人</th></tr>';
    dates.forEach(function (date) {
      const s = sleeps[date];
      html += '<tr><td>' + esc(date) + '</td><td>' + esc(s.bedtime || '') + '-' + esc(s.wake || '') + '</td><td>' + fmtMin(rangeMin(s.bedtime, s.wake)) + '</td><td>' + fmtMin(s.deep) + '</td><td>' + fmtMin(s.light) + '</td><td>' + fmtMin(s.rem) + '</td><td>' + esc(s.state != null ? s.state : (s.quality != null ? s.quality : '')) + '</td></tr>';
    });
    html += '</table>';
    box.innerHTML = html;
  }
  function renderSleepWeekAvg() {
    const box = $('sleepWeekAvg');
    if (!weekPlan) { box.innerHTML = '<div class="empty">—</div>'; return; }
    let n = 0, rangeSum = 0, deepSum = 0, lightSum = 0, remSum = 0, qualitySum = 0, qn = 0, bedSum = 0, bedN = 0;
    weekPlan.days.forEach(function (d) {
      const s = sleeps[d.date];
      if (!s) return;
      n++;
      const r = rangeMin(s.bedtime, s.wake);
      if (r != null) rangeSum += r;
      deepSum += Number(s.deep) || 0; lightSum += Number(s.light) || 0; remSum += Number(s.rem) || 0;
      const pv = Number(s.state) || Number(s.quality) || 0;
      if (pv) { qualitySum += pv; qn++; }
      const b = minFromHM(s.bedtime);
      if (b != null) { bedSum += b; bedN++; }
    });
    if (!n) { box.innerHTML = '<div class="empty">本周暂无睡眠记录</div>'; return; }
    const stageSum = deepSum + lightSum + remSum || 1;
    const avgBed = bedN ? Math.round(bedSum / bedN) : null;
    const bedHM = avgBed != null ? Math.floor(avgBed / 60) + ':' + String(Math.round(avgBed % 60)).padStart(2, '0') : '—';
    box.innerHTML = '<div class="kv"><b>记录天数：</b><span class="val">' + n + ' / 7</span></div>' +
      '<div class="kv"><b>平均睡眠范围：</b><span class="val">' + fmtMin(n ? rangeSum / n : null) + '</span></div>' +
      '<div class="kv"><b>平均分期：</b><span class="val">深睡 ' + fmtMin(deepSum / n) + '（' + Math.round(deepSum / stageSum * 100) + '%） · 浅睡 ' + fmtMin(lightSum / n) + '（' + Math.round(lightSum / stageSum * 100) + '%） · REM ' + fmtMin(remSum / n) + '（' + Math.round(remSum / stageSum * 100) + '%）</span></div>' +
      '<div class="kv"><b>平均个人状态：</b><span class="val">' + (qn ? (qualitySum / qn).toFixed(1) : '—') + ' / 10</span></div>' +
      '<div class="kv"><b>平均入睡：</b><span class="val">' + bedHM + '</span></div>';
  }
  // ---------- 打卡 ----------
  function weekMastCount() {
    let sum = 0;
    if (!weekPlan) return 0;
    weekPlan.days.forEach(function (d) { const c = checkins[d.date]; if (c && c.mast) sum += Number(c.mast) || 0; });
    return sum;
  }
  function fillCheckinForm() {
    const c = checkins[currentDate] || {};
    $('ck-training').checked = !!c.training;
    $('ck-pelvic').checked = !!c.pelvic;
    $('ck-sleep').checked = !!c.sleep;
    $('ck-alcohol').checked = !!c.alcohol;
    $('ck-morning').checked = !!c.morning;
    $('ck-mast').value = c.mast != null ? c.mast : 0;
    $('ck-weight').value = c.weight || '';
    $('ck-rpe').value = c.rpe || '';
    $('ck-note').value = c.note || '';
  }
  function readCheckinForm() {
    return {
      training: $('ck-training').checked, pelvic: $('ck-pelvic').checked, sleep: $('ck-sleep').checked,
      alcohol: $('ck-alcohol').checked, morning: $('ck-morning').checked,
      mast: Math.max(0, parseInt($('ck-mast').value, 10) || 0),
      weight: $('ck-weight').value.trim(), rpe: $('ck-rpe').value.trim(), note: $('ck-note').value.trim()
    };
  }
  async function onSaveCheckin() {
    const msg = $('checkinMsg');
    checkins[currentDate] = readCheckinForm();
    try { await saveCheckin(); msg.textContent = '✔ 已保存' + (API.isCloud() ? '并同步云端' : '（本机）'); msg.className = 'form-msg'; }
    catch (e) { msg.textContent = '保存失败：' + e.message; msg.className = 'form-msg err'; }
    renderWeekCheckins(); renderToday(); renderStats();
  }
  function renderWeekCheckins() {
    const box = $('weekCheckins');
    if (!weekPlan) { box.innerHTML = '<div class="empty">—</div>'; return; }
    let html = '<table><tr><th>日期</th><th>训练</th><th>睡眠</th><th>晨勃</th><th>手淫</th><th>RPE</th></tr>';
    weekPlan.days.forEach(function (d) {
      const c = checkins[d.date] || {};
      const tick = function (v) { return v ? '✔' : '·'; };
      html += '<tr><td>' + esc(d.date.slice(5)) + '</td><td>' + tick(c.training) + '</td><td>' + tick(c.sleep) + '</td><td>' + tick(c.morning) + '</td><td>' + (c.mast || 0) + '</td><td>' + esc(c.rpe || '') + '</td></tr>';
    });
    html += '</table>';
    box.innerHTML = html;
  }

  // ---------- 统计 ----------
  function renderStats() {
    let training = 0, sleep = 0, morning = 0, mast = 0, rpeSum = 0, rpeN = 0;
    if (weekPlan) weekPlan.days.forEach(function (d) {
      const c = checkins[d.date]; if (!c) return;
      if (c.training) training++;
      if (c.sleep) sleep++;
      if (c.morning) morning++;
      mast += Number(c.mast) || 0;
      if (c.rpe) { rpeSum += Number(c.rpe); rpeN++; }
    });
    $('weekStats').innerHTML = '<div class="kv"><b>训练完成：</b><span class="val">' + training + ' / 5 次</span></div><div class="kv"><b>睡眠达标：</b><span class="val">' + sleep + ' 天</span></div><div class="kv"><b>晨勃：</b><span class="val">' + morning + ' 天</span></div><div class="kv"><b>手淫次数：</b><span class="val">' + mast + ' / 上限 ' + PLAN.sexWeeklyLimit + '</span></div><div class="kv"><b>平均RPE：</b><span class="val">' + (rpeN ? (rpeSum / rpeN).toFixed(1) : '—') + '</span></div>';

    const mk = currentDate.slice(0, 7);
    let md = 0, mt = 0, ms = 0, mm = 0, mma = 0;
    Object.keys(checkins).forEach(function (date) {
      if (!date.startsWith(mk)) return;
      const c = checkins[date]; md++;
      if (c.training) mt++;
      if (c.sleep) ms++;
      if (c.morning) mm++;
      mma += Number(c.mast) || 0;
    });
    $('monthStats').innerHTML = '<div class="kv"><b>记录天数：</b><span class="val">' + md + '</span></div><div class="kv"><b>训练完成：</b><span class="val">' + mt + ' 天</span></div><div class="kv"><b>睡眠达标：</b><span class="val">' + ms + ' 天</span></div><div class="kv"><b>晨勃：</b><span class="val">' + mm + ' 天</span></div><div class="kv"><b>手淫次数：</b><span class="val">' + mma + ' 次</span></div>';

    const weights = Object.keys(checkins).sort().map(function (date) { return { date: date, w: Number(checkins[date].weight) }; }).filter(function (x) { return x.w; });
    if (weights.length) {
      const last = weights[weights.length - 1];
      const diff = weights[weights.length - 1].w - weights[0].w;
      $('weightTrend').innerHTML = '<div class="kv"><b>最新：</b><span class="val">' + last.w + ' kg（' + last.date + '）</span></div><div class="kv"><b>记录：</b><span class="val">' + weights.map(function (x) { return x.date.slice(5) + ':' + x.w; }).join('　') + '</span></div><div class="kv"><b>趋势：</b><span class="val">' + (diff >= 0 ? '▲ +' : '▼ ') + diff.toFixed(1) + ' kg（首末）</span></div>';
    } else $('weightTrend').innerHTML = '<div class="empty">暂无体重记录</div>';
  }

  // ---------- 成绩 ----------
  const TEST_POINTS = ['基线', '第8周', '第16周', '第24周'];
  const TEST_FIELDS = [
    { key: 'run100', label: '100m (s)' }, { key: 'run400', label: '400m (s)' }, { key: 'cmj', label: 'CMJ纵跳 (cm)' },
    { key: 'approach', label: '助跑摸高 (cm)' }, { key: 'longJump', label: '立定跳远 (cm)' }, { key: 'squat', label: '深蹲 (kg)' }, { key: 'deadlift', label: '相扑硬拉 (kg)' }
  ];
  function renderTestForm() {
    let html = '<table><tr><th>项目</th>';
    TEST_POINTS.forEach(function (p) { html += '<th>' + p + '</th>'; });
    html += '</tr>';
    TEST_FIELDS.forEach(function (f) {
      html += '<tr><td>' + f.label + '</td>';
      TEST_POINTS.forEach(function (p) {
        const v = (tests[p] || {})[f.key] || '';
        html += '<td><input type="text" style="width:100%;min-width:52px;background:var(--card2);border:1px solid var(--border);color:var(--text);border-radius:7px;padding:5px 6px;font-size:13px" data-test-point="' + p + '" data-test-key="' + f.key + '" value="' + esc(v) + '"></td>';
      });
      html += '</tr>';
    });
    html += '</table>';
    $('testForm').innerHTML = html;
  }
  function readTestsFromForm() {
    const out = {};
    TEST_POINTS.forEach(function (p) { out[p] = {}; });
    document.querySelectorAll('[data-test-point]').forEach(function (inp) {
      const p = inp.getAttribute('data-test-point'), k = inp.getAttribute('data-test-key');
      out[p][k] = inp.value.trim();
    });
    return out;
  }
  function lastNonNull(key) {
    for (let i = TEST_POINTS.length - 1; i >= 0; i--) {
      const v = (tests[TEST_POINTS[i]] || {})[key];
      if (v !== '' && v != null) return { point: TEST_POINTS[i], value: Number(v) };
    }
    return null;
  }
  function renderTestProgress() {
    const rows = [
      { key: 'run100', label: '100m', base: 13.5, target: 12.3, lower: true },
      { key: 'run400', label: '400m', base: 70, target: 60, lower: true },
      { key: 'cmj', label: 'CMJ纵跳', base: 0, target: 40, lower: false },
      { key: 'longJump', label: '立定跳远', base: 0, target: 300, lower: false },
      { key: 'squat', label: '深蹲', base: 80, target: 115, lower: false }
    ];
    let html = '';
    rows.forEach(function (r) {
      const cur = lastNonNull(r.key);
      if (!cur) { html += '<div class="progress-row"><div class="progress-label"><span>' + r.label + '</span><span class="empty">暂无数据</span></div></div>'; return; }
      let pct = r.lower ? (r.base - cur.value) / (r.base - r.target) * 100 : (r.base ? (cur.value - r.base) / (r.target - r.base) * 100 : cur.value / r.target * 100);
      pct = Math.max(0, Math.min(100, pct));
      const extra = (r.key === 'cmj' && r.base) ? '（+ ' + (cur.value - r.base) + 'cm）' : '';
      html += '<div class="progress-row"><div class="progress-label"><span>' + r.label + '：' + cur.value + '（' + cur.point + '）' + extra + '</span><span>' + Math.round(pct) + '%</span></div><div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div></div>';
    });
    $('testProgress').innerHTML = html || '<div class="empty">暂无数据</div>';
  }
  async function onSaveTests() {
    tests = readTestsFromForm();
    try { await saveTests(); $('testMsg').textContent = '✔ 已保存'; $('testMsg').className = 'form-msg'; }
    catch (e) { $('testMsg').textContent = '保存失败：' + e.message; $('testMsg').className = 'form-msg err'; }
    renderTestProgress();
  }
  // ---------- 运动库 ----------
  function renderExercises() {
    const list = Object.keys(exercises);
    const box = $('exList');
    if (!list.length) { box.innerHTML = '<div class="empty">还没有项目，先添加一个</div>'; return; }
    let html = '<ul class="exercise-list">';
    list.forEach(function (id) {
      const e = exercises[id];
      html += '<li><span class="exercise-name" style="color:' + esc(e.color || '#ffb84d') + '">' + esc(e.name) + '</span><span class="exercise-detail">' + esc(e.cat) + ' · ' + esc(e.detail || '') + ' <button class="btn mini" data-edit="' + esc(id) + '">改</button> <button class="btn mini danger" data-del="' + esc(id) + '">删</button></span></li>';
    });
    html += '</ul>';
    box.innerHTML = html;
    box.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        const e = exercises[b.getAttribute('data-edit')];
        $('ex-name').value = e.name; $('ex-cat').value = e.cat || '自定义'; $('ex-detail').value = e.detail || ''; $('ex-color').value = e.color || '#ffb84d'; $('ex-note').value = e.note || '';
        $('exMsg').textContent = '正在编辑：' + e.name;
      });
    });
    box.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        const id = b.getAttribute('data-del');
        if (!confirm('删除「' + exercises[id].name + '」？')) return;
        delete exercises[id];
        await removeExercise(id);
        renderExercises();
      });
    });
  }
  async function onSaveExercise() {
    const name = $('ex-name').value.trim();
    const msg = $('exMsg');
    if (!name) { msg.textContent = '名称不能为空'; msg.className = 'form-msg err'; return; }
    const id = 'ex_' + Date.now();
    const data = { name: name, cat: $('ex-cat').value, detail: $('ex-detail').value.trim(), color: $('ex-color').value, note: $('ex-note').value.trim() };
    exercises[id] = data;
    await saveExercise(id, data);
    $('ex-name').value = ''; $('ex-detail').value = ''; $('ex-note').value = '';
    msg.textContent = '✔ 已保存到运动库'; msg.className = 'form-msg';
    renderExercises(); renderDayCustom();
  }

  // ---------- 设置 ----------
  function renderSettings() {
    const c = API.cloudCfg();
    $('cloudStatus').innerHTML = API.isCloud()
      ? '<div class="kv"><b>当前：</b><span class="val">云端模式（' + esc(c.url) + '）</span></div>'
      : '<div class="kv"><b>当前：</b><span class="val">本地模式</span></div><div class="kv">填入 Supabase 配置后保存，即可切换云端同步（需先建表）。</div>';
    $('cfg-url').value = c.url || '';
    $('cfg-key').value = c.anon || '';
    $('cfg-vapid').value = c.vapid || '';
    $('privacyStatus').textContent = settings.privacy ? '已设置隐私密码（敏感数据加密）' : '未设置隐私密码（敏感字段将明文保存）';
  }
  async function saveCheckinByDate(date, data) { await API.save('checkin', date, privKey ? await CryptoBox.encryptFields(data, privKey, ['mast', 'weight', 'note']) : data); }
  function bindSettings() {
    $('btn-save-cloud').addEventListener('click', function () {
      const url = $('cfg-url').value.trim().replace(/\/+$/, '');
      const key = $('cfg-key').value.trim();
      if (!url || !key) { $('cloudMsg').textContent = 'URL 和 anon key 都要填'; $('cloudMsg').className = 'form-msg err'; return; }
      API.saveCloudCfg({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key, VAPID_PUBLIC_KEY: $('cfg-vapid').value.trim() });
    });
    $('btn-clear-cloud').addEventListener('click', function () { API.clearCloudCfg(); });
    $('btn-export').addEventListener('click', function () {
      const blob = new Blob([JSON.stringify({ checkins: checkins, sleep: sleeps, tests: tests, exercises: exercises, dayItems: dayItems, coros: coros, settings: settings }, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '训练助手备份-' + todayStr() + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    $('btn-import').addEventListener('click', function () { $('importFile').click(); });
    $('importFile').addEventListener('change', function (ev) {
      const f = ev.target.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = async function () {
        try {
          const d = JSON.parse(reader.result);
          checkins = d.checkins || {}; sleeps = d.sleep || {}; tests = d.tests || {}; exercises = d.exercises || {}; dayItems = d.dayItems || {}; coros = d.coros || null;
          if (d.settings && d.settings.privacy) settings = Object.assign(settings, { privacy: d.settings.privacy });
          for (const k of Object.keys(checkins)) await saveCheckinByDate(k, checkins[k]);
          for (const k of Object.keys(sleeps)) await saveSleep(k, sleeps[k]);
          await saveTests();
          for (const k of Object.keys(exercises)) await saveExercise(k, exercises[k]);
          for (const k of Object.keys(dayItems)) await saveDayItems(k, dayItems[k]);
          if (coros) await saveCoros(coros);
          if (settings.reminders) await API.saveSetting('reminders', settings.reminders);
          $('backupMsg').textContent = '✔ 导入完成，请刷新';
        } catch (e) { $('backupMsg').textContent = '导入失败：' + e.message; $('backupMsg').className = 'form-msg err'; }
      };
      reader.readAsText(f);
    });
    $('btn-set-privacy').addEventListener('click', function () { showOverlay('privacyOverlay'); });
    $('btn-logout').addEventListener('click', async function () {
      await API.signOut();
      location.reload();
    });
  }

  // ---------- 提醒 ----------
  const REMINDERS = [
    { id: 'morning', label: '🌅 早晨记录昨晚睡眠', time: '07:00', body: '先记录睡眠，训练会自动调整' },
    { id: 'checkin', label: '✅ 训练打卡', time: '18:00', body: '记得打卡今天训练' },
    { id: 'bedtime', label: '🌙 睡前准备+记录', time: '22:30', body: '准备睡觉，记录今天的睡眠' }
  ];
  function renderReminders() {
    const box = $('reminderForm');
    const saved = settings.reminders || {};
    let html = '';
    REMINDERS.forEach(function (r) {
      const v = saved[r.id] || { enabled: true, time: r.time };
      html += '<div class="kv"><label class="check-item"><input type="checkbox" data-rem-en="' + r.id + '" ' + (v.enabled ? 'checked' : '') + '> ' + esc(r.label) + '</label> <input type="time" data-rem-time="' + r.id + '" value="' + esc(v.time || r.time) + '"></div>';
    });
    box.innerHTML = html;
  }
  function nextTimeAt(hhmm) {
    const parts = hhmm.split(':').map(Number);
    const now = new Date();
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parts[0], parts[1], 0);
    if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);
    return t.getTime();
  }
  async function scheduleReminders() {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready.catch(function () { return null; });
    if (!reg || !reg.active) return;
    reg.active.postMessage({ type: 'clear', id: 'all' });
    const saved = settings.reminders || {};
    REMINDERS.forEach(function (r) {
      const v = saved[r.id] || { enabled: true, time: r.time };
      if (!v.enabled) return;
      reg.active.postMessage({ type: 'schedule', id: r.id, title: r.label, body: r.body, when: nextTimeAt(v.time || r.time), url: './' });
    });
  }
  function bindReminders() {
    $('btn-save-reminders').addEventListener('click', async function () {
      if (!('Notification' in window)) { $('remindMsg').textContent = '此浏览器不支持通知'; return; }
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { $('remindMsg').textContent = '未授权通知，无法提醒'; return; }
      const saved = {};
      REMINDERS.forEach(function (r) {
        saved[r.id] = { enabled: document.querySelector('[data-rem-en="' + r.id + '"]').checked, time: document.querySelector('[data-rem-time="' + r.id + '"]').value || r.time };
      });
      settings.reminders = saved;
      await API.saveSetting('reminders', saved);
      await subscribePush();
      await scheduleReminders();
      $('remindMsg').textContent = '✔ 提醒已保存' + (API.isCloud() ? '（云端推送已订阅）' : '（本机通知）');
      setTimeout(function () { $('remindMsg').textContent = ''; }, 3000);
    });
  }
  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }
  async function subscribePush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const c = API.cloudCfg();
    if (!c.vapid) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(c.vapid) });
    await API.savePushSub(sub.toJSON());
  }

  // ---------- 高驰 ----------
  function renderCoros() {
    const box = $('corosStatus');
    if (!coros || !coros.activities || !coros.activities.length) {
      box.innerHTML = '<div class="kv"><b>状态：</b><span class="val">待同步</span></div><div class="kv">在电脑端登录高驰Training Hub后，让我读取并写入云端快照。</div>';
      $('corosRecent').innerHTML = '<div class="empty">暂无数据</div>';
      return;
    }
    const m = coros.metrics || {};
    const pred = m.predictions || {};
    box.innerHTML = '<div class="kv"><b>状态：</b><span class="val">已同步 ' + esc(coros.syncedAt || '') + ' · ' + coros.activities.length + ' 条</span></div>' +
      '<div class="kv"><b>跑步能力：</b><span class="val">' + esc(m.runningAbility != null ? m.runningAbility : '—') + '　恢复：' + esc(m.recovery || '—') + '</span></div>' +
      '<div class="kv"><b>负荷：</b><span class="val">短期 ' + esc(m.acuteLoad != null ? m.acuteLoad : '—') + ' / 长期 ' + esc(m.chronicLoad != null ? m.chronicLoad : '—') + ' / ' + esc(m.loadRatio || '—') + '</span></div>' +
      '<div class="kv"><b>心率：</b><span class="val">静息 ' + esc(m.restingHr != null ? m.restingHr : '—') + ' · 最大 ' + esc(m.maxHr != null ? m.maxHr : '—') + ' · 乳酸阈 ' + esc(m.lactateThresholdHr != null ? m.lactateThresholdHr : '—') + '</span></div>' +
      '<div class="kv"><b>成绩预测：</b><span class="val">5k ' + esc(pred.run5km || '—') + ' · 10k ' + esc(pred.run10km || '—') + ' · 半马 ' + esc(pred.halfMarathon || '—') + '</span></div>';
    const sorted = coros.activities.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    const cutoff = addDays(currentDate, -6);
    const recent7 = sorted.filter(function (a) { return a.date >= cutoff && a.date <= currentDate; });
    const recent5 = sorted.slice(0, 5);
    let html = '';
    if (!recent7.length) html += '<div class="empty">最近7天（' + cutoff + ' ~ ' + currentDate + '）无活动</div>';
    else recent7.forEach(function (a) { html += '<div class="coros-item"><span class="d">' + esc(a.date) + ' · ' + esc(a.type) + '</span><span class="v">' + (a.duration ? esc(a.duration) : '') + (a.total ? ' · ' + esc(a.total) : '') + (a.avgHr ? ' · 心率' + esc(a.avgHr) : '') + '</span></div>'; });
    if (recent5.length) {
      html += '<div class="card-title" style="margin-top:12px;font-size:13px">最近记录</div>';
      recent5.forEach(function (a) { html += '<div class="coros-item"><span class="d">' + esc(a.date) + ' · ' + esc(a.type) + '</span><span class="v">' + (a.duration ? esc(a.duration) : '') + (a.total ? ' · ' + esc(a.total) : '') + (a.avgHr ? ' · 心率' + esc(a.avgHr) : '') + '</span></div>'; });
    }
    $('corosRecent').innerHTML = html;
  }

  // ---------- 账号 / 事件 / SW ----------
  function renderAccount() {
    const box = $('accountBox');
    const s = API.session();
    box.innerHTML = s ? '<div class="kv"><b>登录：</b><span class="val">' + esc(s.user.email) + '</span></div>' : '<div class="kv"><b>本地模式</b></div>';
  }
  function bindEvents() {
    const goSleep = $('btn-go-sleep');
    if (goSleep) goSleep.addEventListener('click', function () { switchTab('sleep'); });
    $('btn-save-checkin').addEventListener('click', onSaveCheckin);
    $('btn-save-tests').addEventListener('click', onSaveTests);
    $('btn-save-sleep').addEventListener('click', onSaveSleep);
    $('btn-save-ex').addEventListener('click', onSaveExercise);
    bindSettings();
    bindReminders();
    bindAuth();
    bindPrivacy();
    ['sl-bedtime', 'sl-wake', 'sl-deep', 'sl-light', 'sl-rem', 'sl-state'].forEach(function (id) {
      const el = $(id);
      if (el) el.addEventListener('input', renderSleepAutoEval);
    });
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      const b = $('installBanner');
      if (b) b.classList.remove('hidden');
    });
    const bi = $('btnInstall');
    if (bi) bi.addEventListener('click', function () {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt = null;
      const b = $('installBanner');
      if (b) b.classList.add('hidden');
    });
  }
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  // ---------- 启动 ----------
  boot();
})();


