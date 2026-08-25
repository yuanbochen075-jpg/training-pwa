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
  // 结构化的练习项 -> 展示文本
  function fmtEx(m) {
    if (!m) return '';
    if (m.detail) return m.detail;
    const parts = [];
    if (m.sets != null && m.reps != null) parts.push(m.sets + '×' + m.reps);
    else if (m.sets != null) parts.push(m.sets + '组');
    else if (m.reps != null) parts.push(m.reps);
    if (m.pace) parts.push(m.pace);
    if (m.distance) parts.push(m.distance);
    if (m.rest) parts.push(/^(组间|休)/.test(m.rest) ? m.rest : '组间' + m.rest);
    if (m.note) parts.push(m.note);
    return parts.join(' · ');
  }
  // 在结构化练习项上追加说明（不破坏 detail）
  function withSuffix(m, suffix) {
    const mm = Object.assign({}, m);
    if (mm.detail) mm.detail += suffix;
    else mm.note = (mm.note ? mm.note + '；' : '') + suffix;
    return mm;
  }
  // 侧重点标签 + 强度徽章
  const FOCUS_COLORS = { '速度': '#4fc3f7', '力量': '#ffb74d', '爆发': '#ff7043', '耐力': '#81c784', '技术': '#ba68c8', '核心': '#4dd0e1', '恢复': '#90a4ae', '柔韧': '#aed581' };
  const INTEN_CLASS = { '低': 'int-low', '中': 'int-med', '高': 'int-high', '峰值': 'int-peak' };
  function exBadges(m) {
    const a = window.PLAN_ANNOTATE ? window.PLAN_ANNOTATE(m) : m;
    let s = '';
    if (a.focus) s += '<span class="ex-focus" style="color:' + (FOCUS_COLORS[a.focus] || '#9aa7b8') + '">' + esc(a.focus) + '</span>';
    if (a.intensity) s += '<span class="ex-int ' + (INTEN_CLASS[a.intensity] || 'int-med') + '">' + esc(a.intensity) + '</span>';
    return s;
  }

  const PLAN = window.PLAN;
  if (!PLAN) { document.body.innerHTML = '<p style="padding:20px">plan-data.js 加载失败</p>'; return; }
  const OVERRIDES = window.COACH_OVERRIDES || {};

  // ---------- 状态 ----------
  const dateOverride = qs('date');
  const currentDate = /^\d{4}-\d{2}-\d{2}$/.test(dateOverride || '') ? dateOverride : todayStr();
  const start = PLAN.programStart;
  const daysSinceStart = diffDays(start, currentDate);
  const weekIdx = Math.floor(daysSinceStart / 7) + 1;
  const dayIdx = (daysSinceStart % 7) + 1;
  let allDays = [];
  PLAN.weeks.forEach(function (w) { w.days.forEach(function (d) { allDays.push(d); }); });
  function resolvePlan(date) {
    const base = allDays.find(function (d) { return d.date === date; });
    const ov = OVERRIDES[date];
    return ov ? Object.assign({}, base, ov, { date: date }) : base;
  }
  const todayPlan = resolvePlan(currentDate);
  const weekPlan = PLAN.weeks[weekIdx - 1] || null;

  let checkins = {}, sleeps = {}, naps = {}, tests = {}, exercises = {}, dayItems = {}, weathers = {}, execs = {}, extra = Object.assign({}, window.EXTRA || {}), coros = null, settings = {};
  let privKey = null;

  // ---------- 加密辅助 ----------
  async function encryptCheckin(d) { return privKey ? CryptoBox.encryptFields(d, privKey, ['mast', 'weight', 'note']) : d; }
  async function decryptCheckin(d) { return privKey ? CryptoBox.decryptFields(d, privKey) : d; }
  async function encryptSleep(d) { return privKey ? CryptoBox.encryptFields(d, privKey, ['deep', 'light', 'rem', 'note']) : d; }
  async function decryptSleep(d) { return privKey ? CryptoBox.decryptFields(d, privKey) : d; }

  // ---------- 数据保存 ----------
  async function saveCheckin() { await API.save('checkin', currentDate, await encryptCheckin(checkins[currentDate])); }
  async function saveSleep(date, data) { await API.save('sleep', date, await encryptSleep(data)); }
  async function saveNap(date, data) { await API.save('nap', date, data); }
  async function saveTests() { for (const k of Object.keys(tests)) await API.save('test', k, tests[k]); }
  async function saveExercise(id, data) { await API.save('exercise', id, data); }
  async function removeExercise(id) { await API.remove('exercise', id); }
  async function saveDayItems(date, arr) { await API.save('dayItem', date, arr); }
  async function saveWeather(date, data) { await API.save('weather', date, data); }
  async function saveExec(date, data) { await API.save('exec', date, data); }
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
    try {
      await loadAllData();
    } catch (e) {
      showFatal(e && e.message ? e.message : String(e));
      return;
    }
    const needPriv = settings.privacy && !privKey;
    if (needPriv) {
      privacyMode = 'unlock';
      var sub = document.querySelector('#privacyOverlay .modal-sub');
      if (sub) sub.textContent = '输入隐私密码解锁（敏感数据加密存储，只在浏览器解密）';
      showOverlay('privacyOverlay');
      return;
    }
    finishBoot();
  }
  function showFatal(msg) {
    const body = $('todayBody');
    if (body) body.innerHTML = '<div class="err-box"><b>⚠️ 加载失败：</b>' + esc(msg) + '<br><br><button class="btn primary" onclick="location.reload()">重新加载</button></div>';
    const card = $('todayCard'); if (card) card.style.display = 'block';
    const banner = $('sleepBanner'); if (banner) banner.style.display = 'none';
  }

  async function loadAllData() {
    const d = await API.loadAll();
    checkins = d.checkins || {};
    sleeps = d.sleep || {};
    naps = d.nap || {};
    tests = d.tests || {};
    exercises = d.exercises || {};
    dayItems = d.dayItems || {};
    weathers = d.weather || {};
    execs = d.exec || {};
    extra = Object.assign(extra, d.extra || {});
    // 旧格式兼容：旧记录 {name,done,pace,hr} → 重置为仅保留勾选，字段清空
    Object.keys(execs).forEach(function (date) {
      const e = execs[date];
      if (e && Array.isArray(e.items)) {
        e.items = e.items.map(function (it) {
          if (it && typeof it === 'object' && it.w === undefined && it.sr === undefined) {
            return { name: it.name, done: !!it.done, w: '', sr: '', pace: '', hr: '', dist: '', dur: '', note: '' };
          }
          return it;
        });
      }
    });
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
    renderWeatherForm();
    renderNextPreview();
    fillCheckinForm();
    renderExecForm();
    renderExtraForm();
    renderWeekCheckins();
    renderSleepForm();
    renderNapForm();
    renderSleepAutoEval();
    renderSleepHistory();
    renderSleepWeekAvg();
    renderNapHistory();
    renderStats();
    renderTestForm();
    renderTestProgress();
    renderCoros();
    renderExercises();
    renderSettings();
    renderReminders();
    renderAccount();
    bindHistory();
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
    const oldKey = privKey;
    const salt = CryptoBox.newSalt();
    const key = await CryptoBox.deriveKey(pass, salt);
    const check = await CryptoBox.encryptText('OK', key);
    if (oldKey) {
      // 已解锁：用旧密码解密 → 新密码重新加密 → 写回云端
      const nc = {}, ns = {};
      for (const k of Object.keys(checkins)) nc[k] = await CryptoBox.encryptFields(await CryptoBox.decryptFields(checkins[k], oldKey), key, ['mast', 'weight', 'note']);
      for (const k of Object.keys(sleeps)) ns[k] = await CryptoBox.encryptFields(await CryptoBox.decryptFields(sleeps[k], oldKey), key, ['deep', 'light', 'rem', 'note']);
      for (const k of Object.keys(nc)) await API.save('checkin', k, nc[k]);
      for (const k of Object.keys(ns)) await API.save('sleep', k, ns[k]);
      checkins = nc; sleeps = ns;
    }
    settings.privacy = { salt: salt, check: check };
    await API.saveSetting('privacy', settings.privacy);
    privKey = key;
    await loadAllData();
  }
  function hasEnc(d) {
    if (!d || typeof d !== 'object') return false;
    return Object.keys(d).some(function (k) { var v = d[k]; return v && typeof v === 'object' && v.enc === true; });
  }
  async function resetPrivacy() {
    const msg = '⚠️ 重置隐私密码会：\n\n1. 删除当前隐私密码设置\n2. 删除所有已加密数据（睡眠分期/手淫次数/备注/晨重）\n3. 之后重新设置新密码，并从备份重新导入\n\n确定继续吗？';
    if (!window.confirm(msg)) return;
    try {
      await API.remove('setting', 'privacy');
      for (const k of Object.keys(checkins)) if (hasEnc(checkins[k])) await API.remove('checkin', k);
      for (const k of Object.keys(sleeps)) if (hasEnc(sleeps[k])) await API.remove('sleep', k);
      settings.privacy = null; privKey = null;
      const m = $('privMsg'); if (m) { m.style.color = '#4ade80'; m.textContent = '✔ 已重置，请重新设置新密码'; }
      const s = $('privacyStatus'); if (s) s.textContent = '✔ 已重置（请重新设置新密码）';
      setTimeout(function () { location.reload(); }, 800);
    } catch (e) {
      window.alert('重置失败：' + e.message);
    }
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
  let privacyMode = 'unlock'; // unlock | change
  function bindPrivacy() {
    if (privacyBound) return;
    privacyBound = true;
    $('btnUnlock').addEventListener('click', async function () {
      const msg = $('privMsg');
      try {
        if (privacyMode === 'change' || !settings.privacy) await setPrivacy($('privPass').value);
        else await unlockPrivacy($('privPass').value);
        msg.textContent = '✔ 已解锁';
        privacyMode = 'unlock';
        hideOverlay('privacyOverlay');
        finishBoot();
      } catch (e) { msg.className = 'form-msg err'; msg.textContent = e.message; }
    });
    $('btnSkipPriv').addEventListener('click', function () { hideOverlay('privacyOverlay'); finishBoot(); });
    const fp = $('btnForgotPriv');
    if (fp) fp.addEventListener('click', function () { hideOverlay('privacyOverlay'); resetPrivacy(); });
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
    if (daysSinceStart < 0) { $('weekLine').textContent = '计划尚未开始（' + PLAN.programStart + ' 起算）'; $('phaseLine').textContent = ''; }
    else if (weekIdx > PLAN.totalWeeks) { $('weekLine').textContent = PLAN.totalWeeks + '周计划已完成'; $('phaseLine').textContent = ''; }
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
  // 睡眠评分：主流可穿戴方法论（时长/效率/入睡时点/规律性/深睡/REM/主观）
  // 权重：时长25% 效率20% 时点15% 规律性15% 深睡10% REM10% 主观5%；缺失维度归一化
  function sleepPctScore(pct, lo, hi, llo, lhi) {
    if (pct >= lo && pct <= hi) return 10;
    if (pct >= llo && pct <= lhi) return 7;
    if (pct >= lo - 5 && pct <= hi + 5) return 5;
    return 2;
  }
  function sleepBedtimeScore(b) {
    if (b == null) return null;
    const target = 23 * 60;
    let diff = Math.abs(b - target);
    if (diff > 720) diff = 1440 - diff;
    if (diff <= 30) return 10;
    if (diff <= 60) return 8;
    if (diff <= 120) return 5;
    return 2;
  }
  // 入睡时点标准差（分钟）：≤30min 满分，逐级递减
  function bedtimeConsistencyScore() {
    const arr = [];
    Object.keys(sleeps).forEach(function (d) {
      const x = sleeps[d];
      const b = x && minFromHM(x.bedtime);
      if (b != null) arr.push(b);
    });
    if (arr.length < 3) return null;
    const mean = arr.reduce(function (a, v) { return a + v; }, 0) / arr.length;
    const variance = arr.reduce(function (a, v) { return a + (v - mean) * (v - mean); }, 0) / arr.length;
    const sd = Math.sqrt(variance);
    if (sd <= 30) return 10;
    if (sd <= 45) return 8;
    if (sd <= 60) return 6;
    if (sd <= 90) return 3;
    return 1;
  }
  function autoSleepScore(s) {
    const range = rangeMin(s.bedtime, s.wake);
    const deep = Number(s.deep) || 0, light = Number(s.light) || 0, rem = Number(s.rem) || 0;
    const stages = deep + light + rem;
    const total = range != null ? range : stages;
    if (!total) return { score: null, parts: [] };
    const parts = [];
    let weightSum = 0;
    // 时长：7-9h 满分；6-7h / 9-10h 递减；<6h 或 >10h 低分
    if (total > 0) {
      const durScore = total >= 420 && total <= 540 ? 10 : total >= 360 && total <= 600 ? 7 : total >= 300 ? 4 : 2;
      parts.push({ name: '时长', weight: 0.25, score: durScore, text: fmtMin(total) });
      weightSum += 0.25;
    }
    // 效率 = 睡着时间 / 躺床时间（>=85% 满分）
    const latency = Math.max(0, Number(s.latency) || 0);
    const wakeup = Math.max(0, Number(s.wakeup) || 0);
    const inBed = total + latency + wakeup;
    if (inBed > 0 && total > 0) {
      const eff = total / inBed * 100;
      const effScore = eff >= 90 ? 10 : eff >= 85 ? 9 : eff >= 80 ? 7 : eff >= 70 ? 4 : 2;
      parts.push({ name: '效率', weight: 0.2, score: effScore, text: Math.round(eff) + '%' });
      weightSum += 0.2;
    } else if (total > 0) {
      // 未填入睡耗时/清醒时，按深睡+REM 之外的时长视为效率信息（保守按中上）
      parts.push({ name: '效率', weight: 0.2, score: 7, text: '未填' });
      weightSum += 0.2;
    }
    // 入睡时点（23:00 目标）
    const b = minFromHM(s.bedtime);
    const bedScore = sleepBedtimeScore(b);
    if (bedScore != null) {
      parts.push({ name: '入睡', weight: 0.15, score: bedScore, text: s.bedtime || '' });
      weightSum += 0.15;
    }
    // 规律性（近7天入睡时点一致性）
    const cons = bedtimeConsistencyScore();
    if (cons != null) {
      parts.push({ name: '规律', weight: 0.15, score: cons, text: '近' + Object.keys(sleeps).length + '天' });
      weightSum += 0.15;
    }
    // 深睡占比 16-20%、REM 21-30%
    if (stages > 0) {
      const deepPct = deep / stages * 100, remPct = rem / stages * 100;
      parts.push({ name: '深睡', weight: 0.1, score: sleepPctScore(deepPct, 16, 20, 13, 23), text: Math.round(deepPct) + '%' });
      parts.push({ name: 'REM', weight: 0.1, score: sleepPctScore(remPct, 21, 30, 15, 28), text: Math.round(remPct) + '%' });
      weightSum += 0.2;
    }
    // 个人主观状态（1-10）
    const state = Number(s.state) || Number(s.quality) || 0;
    if (state > 0) {
      parts.push({ name: '主观', weight: 0.05, score: state, text: state + '/10' });
      weightSum += 0.05;
    }
    const score = weightSum > 0 ? parts.reduce(function (acc, p) { return acc + p.score * p.weight; }, 0) / weightSum : null;
    return { score: score != null ? Math.round(score * 10) / 10 : null, parts: parts };
  }
  function sleepStatus() {
    const s = sleeps[currentDate];
    if (!s) return { level: 'none', label: '未记录睡眠', detail: '', auto: null, personal: null, combined: null };
    const auto = autoSleepScore(s);
    const personal = Number(s.state) || Number(s.quality) || 0;
    const autoScore = auto.score != null ? auto.score : personal;
    const combined = Math.round((autoScore * 0.7 + personal * 0.3) * 10) / 10;
    let level, label;
    if (combined < 5 || autoScore <= 3 || (personal > 0 && personal <= 2)) { level = 'low'; label = '恢复不足'; }
    else if (combined < 7) { level = 'light'; label = '轻度疲劳'; }
    else { level = 'full'; label = '恢复良好'; }
    return { level: level, label: label, auto: autoScore, personal: personal, combined: combined };
  }
  function adjustedDay(plan, status, wx) {
    if (!plan) return plan;
    const low = status.level === 'low';
    const light = status.level === 'light';
    const copy = JSON.parse(JSON.stringify(plan));
    if (low) {
      if (copy.type === 'speed' || copy.type === 'speedEnd') { copy.title = '恢复不足 · 改为轻松有氧'; copy.main = [{ name: 'Zone2慢跑', detail: '30-40min，心率120-130，不冲刺、不跳深' }]; copy.note = '睡眠不足：自动降级为轻松有氧'; }
      else if (copy.type === 'lower') { copy.title = '恢复不足 · 下肢轻力量'; copy.main = [{ name: '杠铃深蹲', detail: '3×5 @70%计划重量' }, { name: '相扑硬拉', detail: '2×5 @70%' }, { name: '保加利亚分腿蹲', detail: '2×8每侧 轻' }]; copy.note = '睡眠不足：减量减重，不做跳深/大重量'; }
      else if (copy.type === 'upper') { copy.title = '恢复不足 · 上肢轻量'; copy.main = copy.main.slice(0, 4).map(function (m) { return withSuffix(m, '（减量30%）'); }); copy.note = '睡眠不足：组数/重量减30%'; }
      else if (copy.type === 'aerobic' || copy.type === 'longAerobic') { copy.main = [{ name: 'Zone2慢跑', detail: '30min，心率120-130' }]; copy.note = '睡眠不足：缩短时长、降低心率'; }
      else if (copy.type === 'test') { copy.note = (copy.note ? copy.note + ' | ' : '') + '睡眠不足：建议推迟测试'; }
    } else if (light) {
      copy.note = (copy.note ? copy.note + ' | ' : '') + '轻度疲劳：总量减20-30%、取消最大冲刺/跳深、重量降一档';
      if (copy.type === 'speed' || copy.type === 'speedEnd') copy.main = copy.main.filter(function (m) { return !/跳深|跳箱/.test(m.name); }).map(function (m) { return withSuffix(m, '（强度降一档）'); });
      if (copy.type === 'lower' || copy.type === 'upper') copy.main = copy.main.map(function (m) { return withSuffix(m, '（重量-10~15%）'); });
    }
    // 天气自动调整
    if (wx && wx.reasons && wx.reasons.length) {
      const run = copy.type === 'speed' || copy.type === 'speedEnd' || copy.type === 'aerobic' || copy.type === 'longAerobic' || copy.type === 'test';
      const str = copy.type === 'lower' || copy.type === 'upper' || copy.type === 'jump';
      if (wx.hot && run) {
        copy.note = (copy.note ? copy.note + ' | ' : '') + '高温≥30°C：配速降5-8%、组间补水、心率上限-10bpm';
        copy.main = copy.main.map(function (m) { return withSuffix(m, '（高温降速/补水）'); });
      } else if (wx.hot && str) {
        copy.note = (copy.note ? copy.note + ' | ' : '') + '高温≥30°C：组数减1组、组间补水';
        copy.main = copy.main.map(function (m) { return withSuffix(m, '（高温减量）'); });
      }
      if (wx.windy && run) {
        copy.note = (copy.note ? copy.note + ' | ' : '') + '大风≥5级：配速放缓、缩短冲刺距离/组数';
        copy.main = copy.main.map(function (m) { return withSuffix(m, '（大风放缓）'); });
      }
      if (wx.sun && (run || str)) {
        copy.note = (copy.note ? copy.note + ' | ' : '') + '强日照：避开直晒时段、多补水、强度降10%';
      }
      copy.weatherNote = wx.reasons.join('；');
    }
    return copy;
  }
  function weatherStatus() {
    const w = weathers[currentDate];
    if (!w || (!w.temp && !w.wind && !w.sun)) return { level: 'none', label: '未填天气', reasons: [] };
    const reasons = [];
    const hot = Number(w.temp) >= 30;
    const windy = Number(w.wind) >= 5;
    const sun = w.sun === 'strong';
    if (hot) reasons.push('高温' + w.temp + '°C');
    if (windy) reasons.push('风力' + w.wind + '级');
    if (sun) reasons.push('强日照');
    return { level: reasons.length ? 'adjusted' : 'none', label: reasons.length ? '已按天气调整' : '天气正常', reasons: reasons, hot: hot, windy: windy, sun: sun };
  }
  // ---------- 今日 ----------
  function renderToday() {
    if (!todayPlan) { $('todayBody').innerHTML = '<div class="empty">计划未开始</div>'; renderExtra(); return; }
    const st = sleepStatus();
    const wx = weatherStatus();
    const p = adjustedDay(todayPlan, st, wx);
    const badge = p.type === 'rest' ? '<span class="badge rest">休息</span>' : p.type === 'test' ? '<span class="badge test">测试</span>' : '<span class="badge">训练</span>';
    let html = '<div class="card-title">' + esc(p.title) + badge + '</div>';
    const adjBits = [];
    if (st.level === 'low' || st.level === 'light') adjBits.push('睡眠' + st.label);
    if (wx.level === 'adjusted') adjBits.push('天气（' + wx.reasons.join('、') + '）');
    html += '<div class="kv"><b>今日状态：</b><span class="val">' + esc(st.label) + (adjBits.length ? ' · 已自动调整：' + esc(adjBits.join(' + ')) : '') + '</span></div>';
    if (st.level !== 'none') html += '<div class="kv"><b>睡眠评测：</b><span class="val">自动 ' + (st.auto != null ? st.auto : '—') + ' · 个人 ' + (st.personal || '—') + ' · 综合 ' + (st.combined != null ? st.combined : '—') + '</span></div>';
    if (wx.level === 'adjusted') html += '<div class="kv"><b>天气：</b><span class="val">' + esc(wx.reasons.join(' · ')) + '</span></div>';
    html += '<div class="venue">' + esc(p.venue) + ' · ' + esc(p.duration) + ' · ' + esc(p.phase) + '</div>';
    if (p.warmup) html += '<div class="kv"><b>热身：</b><span class="val">' + esc(p.warmup) + '</span></div>';
    if (p.main && p.main.length) {
      html += '<ul class="exercise-list">';
      p.main.forEach(function (m) {
        html += '<li><span class="exercise-name">' + esc(m.name) + exBadges(m) + '</span><span class="exercise-detail">' + esc(fmtEx(m)) + '</span></li>';
      });
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

    const rules = ['酒精=0（含药酒）', '手淫每周≤' + PLAN.sexWeeklyLimit + '次，训练日/测试前48h禁止', '睡眠 23:00-07:00，午休≤20min，晨勃=每日恢复指标', '体重目标 64-65kg，蛋白质130-140g/天', '膝/踝/跟腱/腘绳肌疼痛立即降档或停', '静息心率较基线升5-8次/分 → 减量'];
    $('ruleBody').innerHTML = rules.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('');

    renderDayCustom();
    renderExtra();
  }

  function extraDay(date) { const ex = extra[date]; return !!(ex && ex.sessions && ex.sessions.length); }
  function renderExtra() {
    const card = $('extraCard');
    const box = $('extraBody');
    if (!card || !box) return;
    const rec = extra[currentDate];
    if (!rec || !rec.sessions || !rec.sessions.length) { card.style.display = 'none'; return; }
    card.style.display = '';
    let html = '';
    rec.sessions.forEach(function (s) {
      html += '<div class="card-title" style="margin:8px 0 4px">' + esc(s.title || '加练') + '　<span class="muted">' + esc(s.venue || '') + ' · ' + esc((s.duration != null ? s.duration + 'min' : '')) + '</span></div>';
      if (s.main && s.main.length) {
        html += '<ul class="exercise-list">';
        s.main.forEach(function (m) { html += '<li><span class="exercise-name">' + esc(m.name) + '</span><span class="exercise-detail">' + esc(fmtEx(m)) + '</span></li>'; });
        html += '</ul>';
      }
      if (s.rpe) html += '<div class="kv"><b>RPE：</b><span class="val">' + esc(s.rpe) + '/20</span></div>';
      if (s.note) html += '<div class="note">💡 ' + esc(s.note) + '</div>';
    });
    box.innerHTML = html;
  }
  // ---------- 加练记录（打卡页录入，存 Supabase kind=extra，与静态 extra-data.js 合并） ----------
  function renderExtraForm() {
    const box = $('extraForm');
    if (!box) return;
    $('ex-date').value = currentDate;
    const rec = extra[currentDate];
    if (rec && rec.sessions && rec.sessions.length) {
      const last = rec.sessions[rec.sessions.length - 1];
      $('ex-title').value = last.title || '';
      $('ex-venue').value = last.venue || '';
      $('ex-duration').value = last.duration != null ? last.duration : '';
      $('ex-rpe').value = last.rpe != null ? last.rpe : '';
      $('ex-note').value = last.note || '';
      renderExtraMainRows(last.main || []);
    } else {
      $('ex-title').value = ''; $('ex-venue').value = ''; $('ex-duration').value = ''; $('ex-rpe').value = ''; $('ex-note').value = '';
      renderExtraMainRows([]);
    }
  }
  function renderExtraMainRows(main) {
    const box = $('ex-main-rows');
    if (!box) return;
    const arr = main && main.length ? main : [{ name: '', detail: '' }];
    let html = '';
    arr.forEach(function (m, i) {
      html += '<div style="display:flex;gap:6px;margin:4px 0"><input type="text" data-ex-mname="' + i + '" placeholder="动作名（如 自重深蹲）" value="' + esc(m.name || '') + '" style="flex:1;min-width:0"><input type="text" data-ex-mdetail="' + i + '" placeholder="组次/配速（如 5×200个）" value="' + esc(m.detail || '') + '" style="flex:1.2;min-width:0"><button class="btn mini danger" type="button" data-ex-mrm="' + i + '">删</button></div>';
    });
    box.innerHTML = html;
    box.querySelectorAll('[data-ex-mrm]').forEach(function (b) {
      b.addEventListener('click', function () {
        const rows = readExtraMainRows();
        if (rows.length <= 1) return;
        renderExtraMainRows(rows.filter(function (_, idx) { return idx !== Number(b.getAttribute('data-ex-mrm')); }));
      });
    });
  }
  function readExtraMainRows() {
    const rows = [];
    document.querySelectorAll('#ex-main-rows [data-ex-mname]').forEach(function (inp) {
      const i = inp.getAttribute('data-ex-mname');
      const dInp = document.querySelector('#ex-main-rows [data-ex-mdetail="' + i + '"]');
      const name = inp.value.trim();
      const detail = dInp ? dInp.value.trim() : '';
      if (name) rows.push({ name: name, detail: detail });
    });
    return rows;
  }
  async function onSaveExtra() {
    const msg = $('extraMsg');
    if (!msg) return;
    const date = $('ex-date').value;
    if (!date) { msg.textContent = '请选择日期'; msg.className = 'form-msg err'; return; }
    const main = readExtraMainRows();
    if (!main.length) { msg.textContent = '至少填一个动作名'; msg.className = 'form-msg err'; return; }
    const session = {
      title: $('ex-title').value.trim() || '加练',
      venue: $('ex-venue').value.trim(),
      duration: Math.max(0, parseInt($('ex-duration').value, 10) || 0) || undefined,
      rpe: Math.max(0, parseInt($('ex-rpe').value, 10) || 0) || undefined,
      main: main,
      note: $('ex-note').value.trim()
    };
    // 同日期 sessions 追加（静态为底 + 云端合并）
    const existing = extra[date] || { sessions: [] };
    const sessions = (existing.sessions || []).concat([session]);
    extra[date] = { sessions: sessions };
    try {
      await API.save('extra', date, extra[date]);
      msg.textContent = '✔ 已保存加练记录' + (API.isCloud() ? '并同步云端' : '（本机）');
      msg.className = 'form-msg';
    } catch (e) { msg.textContent = '保存失败：' + e.message; msg.className = 'form-msg err'; }
    renderExtra(); renderStats(); renderWeekCheckins();
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
        const a = window.PLAN_ANNOTATE ? window.PLAN_ANNOTATE(it) : it;
        html += '<li><span class="exercise-name">' + esc(it.name) + exBadges(a) + '</span><span class="exercise-detail">' + esc(it.detail || '') + ' <button class="btn mini" data-rm="' + i + '">移除</button></span></li>';
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
      const arr = (dayItems[currentDate] || []).concat([{ name: e.name, detail: e.detail || '', cat: e.cat || '', color: e.color || '', intensity: e.intensity || '', focus: e.focus || '' }]);
      dayItems[currentDate] = arr;
      await saveDayItems(currentDate, arr);
      renderDayCustom();
      renderExecForm();
    });
    box.querySelectorAll('[data-rm]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        const arr = (dayItems[currentDate] || []).filter(function (_, i) { return i !== Number(btn.getAttribute('data-rm')); });
        dayItems[currentDate] = arr;
        await saveDayItems(currentDate, arr);
        renderDayCustom();
        renderExecForm();
      });
    });
  }

  // ---------- 天气（今日页） ----------
  function renderWeatherForm() {
    const box = $('weatherForm');
    if (!box) return;
    const w = weathers[currentDate] || {};
    const sunSel = ['', '阴天', '多云', '晴', '强日照'];
    let html = '<div class="form-grid">';
    html += '<label class="field-label">温度（°C）<input type="number" id="wx-temp" min="-20" max="50" value="' + esc(w.temp != null ? w.temp : '') + '" placeholder="如 32"></label>';
    html += '<label class="field-label">日照<select id="wx-sun"><option value="">未选</option>' + sunSel.map(function (s) { return '<option value="' + esc(s) + '"' + (w.sun === s ? ' selected' : '') + '>' + esc(s || '未选') + '</option>'; }).join('') + '</select></label>';
    html += '<label class="field-label">风力（级）<select id="wx-wind"><option value="">未选</option>' + [1, 2, 3, 4, 5, 6].map(function (v) { return '<option value="' + v + '"' + (Number(w.wind) === v ? ' selected' : '') + '>' + v + ' 级</option>'; }).join('') + '</select></label>';
    html += '<button class="btn primary" id="btn-save-weather">保存天气并调整今日计划</button><span class="form-msg" id="weatherMsg"></span>';
    html += '</div>';
    box.innerHTML = html;
  }
  function readWeatherForm() {
    return {
      temp: $('wx-temp') ? Number($('wx-temp').value) : null,
      sun: $('wx-sun') ? $('wx-sun').value : '',
      wind: $('wx-wind') ? Number($('wx-wind').value) : null
    };
  }
  async function onSaveWeather() {
    const msg = $('weatherMsg');
    if (!msg) return;
    const w = readWeatherForm();
    weathers[currentDate] = w;
    try {
      await saveWeather(currentDate, w);
      msg.textContent = '✔ 已保存' + (API.isCloud() ? '并同步云端' : '（本机）');
      msg.className = 'form-msg';
    } catch (e) { msg.textContent = '保存失败：' + e.message; msg.className = 'form-msg err'; }
    renderToday();
  }

  // ---------- 执行打卡（打卡页：今日项目勾选 + 按类型显示实际完成字段） ----------
  const EXEC_FIELD_LABELS = { w: '实际重量kg', sr: '组×次', pace: '配速/成绩', hr: '心率', dist: '距离/高度', dur: '时长min', note: '备注' };
  const EXEC_FIELDS = ['w', 'sr', 'pace', 'hr', 'dist', 'dur', 'note'];
  // 根据类别/侧重点/名称关键词推断该动作要记录哪些字段
  function recordFields(m) {
    if (!m) return ['note'];
    const name = String(m.name || '');
    const cat = String(m.cat || '');
    const focus = String(m.focus || '');
    if (/力量/.test(cat)) return ['w', 'sr', 'note'];
    if (/跑步|有氧|骑行|游泳|球类/.test(cat)) return ['pace', 'hr', 'note'];
    if (/跳跃/.test(cat)) return ['dist', 'sr', 'note'];
    if (/力量/.test(focus)) return ['w', 'sr', 'note'];
    if (/速度|耐力/.test(focus)) return ['pace', 'hr', 'note'];
    if (/爆发/.test(focus)) return ['dist', 'sr', 'note'];
    if (/核心/.test(focus)) return ['sr', 'note'];
    if (/恢复|柔韧|技术/.test(focus)) return ['note'];
    if (/平板|卷腹|举腿/.test(name)) return ['sr', 'note'];
    if (/深蹲|硬拉|推举|卧推|划船|引体|提踵|分腿|面拉|侧平举|弯举/.test(name)) return ['w', 'sr', 'note'];
    if (/跑|冲刺|间歇|骑行|游泳|慢跑|Zone2/.test(name)) return ['pace', 'hr', 'note'];
    if (/跳|纵跳|摸高|立定/.test(name)) return ['dist', 'sr', 'note'];
    return ['note'];
  }
  function renderExecForm() {
    const box = $('execForm');
    if (!box) return;
    if (!todayPlan || !todayPlan.main || !todayPlan.main.length) {
      box.innerHTML = '<div class="empty">今日无训练项目（休息日）</div>';
      return;
    }
    const st = sleepStatus();
    const wx = weatherStatus();
    const p = adjustedDay(todayPlan, st, wx);
    // 合并计划内项目 + 今日自定义项目（同名去重，计划优先）
    const items = [];
    const seen = {};
    (p.main || []).forEach(function (m) { if (m && m.name && !seen[m.name]) { seen[m.name] = true; items.push(m); } });
    (dayItems[currentDate] || []).forEach(function (m) { if (m && m.name && !seen[m.name]) { seen[m.name] = true; items.push(m); } });
    const saved = execs[currentDate] || { items: [] };
    const map = {};
    saved.items.forEach(function (it, i) { map[it.name] = i; });
    let html = '<div class="sub" style="margin-bottom:8px">按「今日」项目勾选完成，并填实际完成参数（按动作类型自动显示对应字段）：</div><div class="form-grid">';
    items.forEach(function (m, ri) {
      const idx = map[m.name];
      const it = idx != null ? saved.items[idx] : {};
      const fields = recordFields(m);
      let inputs = '';
      fields.forEach(function (f) {
        inputs += '<input type="text" data-exec-idx="' + ri + '" data-exec-field="' + f + '" placeholder="' + esc(EXEC_FIELD_LABELS[f] || f) + '" value="' + esc(it[f] || '') + '">';
      });
      html += '<div class="exec-row">' +
        '<label class="check-item" style="flex:0 0 auto;background:transparent;padding:4px 6px"><input type="checkbox" data-exec-idx="' + ri + '" data-exec-name="' + esc(m.name) + '"' + (it.done ? ' checked' : '') + '> 完成</label>' +
        '<div class="exec-meta"><b>' + esc(m.name) + exBadges(m) + '</b><span class="muted">' + esc(fmtEx(m)) + '</span></div>' +
        '<div class="exec-inputs">' + inputs + '</div>' +
        '</div>';
    });
    html += '<button class="btn primary" id="btn-save-exec">保存执行记录</button><span class="form-msg" id="execMsg"></span></div>';
    box.innerHTML = html;
  }
  function readExecForm() {
    const items = [];
    const boxes = document.querySelectorAll('#execForm input[data-exec-idx][type="checkbox"]');
    boxes.forEach(function (cb) {
      const ri = cb.getAttribute('data-exec-idx');
      const name = cb.getAttribute('data-exec-name');
      const item = { name: name, done: cb.checked, w: '', sr: '', pace: '', hr: '', dist: '', dur: '', note: '' };
      document.querySelectorAll('#execForm input[data-exec-idx="' + ri + '"][data-exec-field]').forEach(function (inp) {
        const f = inp.getAttribute('data-exec-field');
        item[f] = inp.value.trim();
      });
      items.push(item);
    });
    return { items: items };
  }
  async function onSaveExec() {
    const msg = $('execMsg');
    if (!msg) return;
    execs[currentDate] = readExecForm();
    try {
      await saveExec(currentDate, execs[currentDate]);
      msg.textContent = '✔ 已保存' + (API.isCloud() ? '并同步云端' : '（本机）');
      msg.className = 'form-msg';
    } catch (e) { msg.textContent = '保存失败：' + e.message; msg.className = 'form-msg err'; }
  }

  function renderNextPreview() {
    const card = $('nextCard');
    if (!card) return;
    const show = qs('next') === '1' || new Date().getHours() >= 18;
    const next = resolvePlan(addDays(currentDate, 1));
    if (!show || !next) { card.style.display = 'none'; return; }
    card.style.display = '';
    let html = '<div class="kv"><b>' + esc(next.title) + '</b><span class="val"> ' + esc(next.venue) + ' · ' + esc(next.duration) + '</span></div>';
    if (next.main && next.main.length) {
      html += '<ul class="exercise-list">';
      next.main.forEach(function (m) { html += '<li><span class="exercise-name">' + esc(m.name) + exBadges(m) + '</span><span class="exercise-detail">' + esc(fmtEx(m)) + '</span></li>'; });
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
    $('sl-latency').value = s.latency != null ? s.latency : '';
    $('sl-wakeup').value = s.wakeup != null ? s.wakeup : '';
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
      latency: Math.max(0, parseInt($('sl-latency').value, 10) || 0),
      wakeup: Math.max(0, parseInt($('sl-wakeup').value, 10) || 0),
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
    const combined = Math.round((res.score * 0.7 + personal * 0.3) * 10) / 10;
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
    renderSleepHistory(); renderSleepWeekAvg(); renderNapHistory(); updateSleepBanner(); renderToday(); renderNextPreview(); switchTab('today');
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
  // ---------- 午睡 ----------
  function napMinutes(s) {
    if (!s || !s.start || !s.end) return null;
    const p = function (v) { const a = String(v).split(':').map(Number); return a.length >= 2 ? a[0] * 60 + a[1] : null; };
    const st = p(s.start), en = p(s.end);
    if (st == null || en == null) return null;
    let d = en - st;
    if (d < 0) d += 1440; // 跨天视为次日
    return d;
  }
  function renderNapForm() {
    const box = $('np-date');
    if (!box) return;
    $('np-date').value = currentDate;
    const n = naps[currentDate] || {};
    $('np-start').value = n.start || '13:00';
    $('np-end').value = n.end || '14:00';
    $('np-state').value = n.state != null ? n.state : '';
    $('np-note').value = n.note || '';
  }
  function readNapForm() {
    return {
      start: $('np-start').value,
      end: $('np-end').value,
      state: $('np-state').value !== '' ? Math.max(1, Math.min(10, parseInt($('np-state').value, 10) || 0)) : undefined,
      note: $('np-note').value.trim()
    };
  }
  async function onSaveNap() {
    const msg = $('napMsg');
    if (!msg) return;
    const date = $('np-date').value;
    if (!date) { msg.textContent = '请选择日期'; msg.className = 'form-msg err'; return; }
    const d = readNapForm();
    naps[date] = d;
    try {
      await saveNap(date, d);
      msg.textContent = '✔ 已保存午睡' + (API.isCloud() ? '并同步云端' : '（本机）');
      msg.className = 'form-msg';
    } catch (e) { msg.textContent = '保存失败：' + e.message; msg.className = 'form-msg err'; }
    renderNapHistory();
  }
  function renderNapHistory() {
    const box = $('napHistory');
    if (!box) return;
    const dates = Object.keys(naps).sort().reverse().slice(0, 7);
    if (!dates.length) { box.innerHTML = '<div class="empty">暂无午睡记录</div>'; return; }
    let html = '<table><tr><th>日期</th><th>开始-结束</th><th>时长</th><th>状态</th></tr>';
    dates.forEach(function (date) {
      const n = naps[date];
      const mins = napMinutes(n);
      html += '<tr><td>' + esc(date) + '</td><td>' + esc(n.start || '') + '-' + esc(n.end || '') + '</td><td>' + (mins != null ? fmtMin(mins) : '—') + '</td><td>' + esc(n.state != null ? n.state : '—') + '</td></tr>';
    });
    html += '</table>';
    box.innerHTML = html;
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
    $('ck-duration').value = c.duration || '';
    $('ck-note').value = c.note || '';
  }
  function readCheckinForm() {
    return {
      training: $('ck-training').checked, pelvic: $('ck-pelvic').checked, sleep: $('ck-sleep').checked,
      alcohol: $('ck-alcohol').checked, morning: $('ck-morning').checked,
      mast: Math.max(0, parseInt($('ck-mast').value, 10) || 0),
      weight: $('ck-weight').value.trim(), rpe: $('ck-rpe').value.trim(),
      duration: Math.max(0, parseInt($('ck-duration').value, 10) || 0),
      note: $('ck-note').value.trim()
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
      html += '<tr><td>' + esc(d.date.slice(5)) + '</td><td>' + tick(c.training || extraDay(d.date)) + '</td><td>' + tick(c.sleep) + '</td><td>' + tick(c.morning) + '</td><td>' + (c.mast || 0) + '</td><td>' + esc(c.rpe || '') + '</td></tr>';
    });
    html += '</table>';
    box.innerHTML = html;
  }

  // ---------- 统计 ----------
  function renderStats() {
    let training = 0, sleep = 0, morning = 0, mast = 0, rpeSum = 0, rpeN = 0;
    if (weekPlan) weekPlan.days.forEach(function (d) {
      const c = checkins[d.date]; if (!c) return;
      if (c.training || extraDay(d.date)) training++;
      if (c.sleep) sleep++;
      if (c.morning) morning++;
      mast += Number(c.mast) || 0;
      if (c.rpe) { rpeSum += Number(c.rpe); rpeN++; }
    });
    $('weekStats').innerHTML = '<div class="kv"><b>训练完成：</b><span class="val">' + training + ' / 5 次</span></div><div class="kv"><b>睡眠达标：</b><span class="val">' + sleep + ' 天</span></div><div class="kv"><b>晨勃：</b><span class="val">' + morning + ' 天</span></div><div class="kv"><b>手淫次数：</b><span class="val">' + mast + ' / 上限 ' + PLAN.sexWeeklyLimit + '</span></div><div class="kv"><b>平均RPE：</b><span class="val">' + (rpeN ? (rpeSum / rpeN).toFixed(1) : '—') + '</span></div>';

    // 训练负荷
    const wlm = weeklyLoadMetrics(currentDate);
    const ac = acwr(currentDate);
    const ml = monthLoad(currentDate);
    $('loadStats').innerHTML =
      '<div class="kv"><b>本周负荷：</b><span class="val">' + wlm.load + ' AU（' + wlm.n + ' 次训练）</span></div>' +
      '<div class="kv"><b>本周单调性：</b><span class="val">' + (wlm.monotony || '—') + '（>2.0 伤病风险升高）</span></div>' +
      '<div class="kv"><b>本周应变：</b><span class="val">' + wlm.strain + '</span></div>' +
      '<div class="kv"><b>本月负荷：</b><span class="val">' + ml + ' AU</span></div>' +
      '<div class="kv"><b>ACWR：</b><span class="val">' + (ac ? ac.value + '（急性' + ac.acute + ' / 慢性' + ac.chronic + '）' : '数据积累中（需满28天）') + '</span></div>';

    const mk = currentDate.slice(0, 7);
    let md = 0, mt = 0, ms = 0, mm = 0, mma = 0;
    Object.keys(checkins).forEach(function (date) {
      if (!date.startsWith(mk)) return;
      const c = checkins[date]; md++;
      if (c.training || extraDay(date)) mt++;
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

    renderHistory();
  }

  // ---------- 历史记录（统计页，本周/本月可展开） ----------
  let historyMode = 'week';
  function historyDates() {
    if (historyMode === 'month') {
      const mk = currentDate.slice(0, 7);
      return Object.keys(checkins).filter(function (d) { return d.startsWith(mk); }).sort().reverse();
    }
    const d = parseDate(currentDate);
    const dow = (d.getDay() + 6) % 7; // 周一=0
    const monday = addDays(currentDate, -dow);
    const out = [];
    for (let i = 0; i < 7; i++) { const dt = addDays(monday, i); if (checkins[dt]) out.push(dt); }
    return out.sort().reverse();
  }
  function historyDayDetail(date) {
    const c = checkins[date] || {};
    const ex = extra[date];
    const exec = execs[date];
    let html = '';
    html += '<div class="kv"><b>睡眠达标：</b><span class="val">' + (c.sleep ? '是' : '否') + '</span>　<b>晨勃：</b><span class="val">' + (c.morning ? '有' : '无') + '</span>　<b>手淫：</b><span class="val">' + (Number(c.mast) || 0) + '</span></div>';
    if (c.weight) html += '<div class="kv"><b>晨重：</b><span class="val">' + esc(c.weight) + ' kg</span></div>';
    if (c.rpe) html += '<div class="kv"><b>RPE：</b><span class="val">' + esc(c.rpe) + ' / 20</span></div>';
    if (c.note) html += '<div class="kv"><b>备注：</b><span class="val">' + esc(c.note) + '</span></div>';
    if (exec && exec.items && exec.items.length) {
      const done = exec.items.filter(function (it) { return it.done; });
      const undone = exec.items.filter(function (it) { return !it.done; });
      html += '<div class="kv"><b>执行：</b><span class="val">完成 ' + done.length + ' / ' + exec.items.length + '</span></div>';
      if (done.length) {
        html += '<ul class="exercise-list">';
        done.forEach(function (it) {
          const bits = [];
          if (it.w) bits.push(it.w + 'kg');
          if (it.sr) bits.push(it.sr);
          if (it.pace) bits.push('配速 ' + it.pace);
          if (it.hr) bits.push('心率 ' + it.hr);
          if (it.dist) bits.push(it.dist);
          if (it.dur) bits.push(it.dur + 'min');
          if (it.note) bits.push(it.note);
          html += '<li><span class="exercise-name">' + esc(it.name) + '</span><span class="exercise-detail">' + esc(bits.join(' · ')) + '</span></li>';
        });
        html += '</ul>';
      }
      if (undone.length) html += '<div class="muted" style="font-size:12px">未完成：' + esc(undone.map(function (it) { return it.name; }).join('、')) + '</div>';
    }
    if (ex && ex.sessions && ex.sessions.length) {
      html += '<div class="note" style="margin-top:4px">➕ 加练 ' + ex.sessions.length + ' 条</div>';
      ex.sessions.forEach(function (s) {
        html += '<div class="kv"><b>' + esc(s.title || '加练') + '</b><span class="val">' + esc(s.venue || '') + ' · ' + (s.duration != null ? s.duration + 'min' : '') + ' · RPE ' + esc(s.rpe || '—') + '</span></div>';
      });
    }
    return html;
  }
  function renderHistory() {
    const list = $('historyList');
    if (!list) return;
    const dates = historyDates();
    if (!dates.length) { list.innerHTML = '<div class="empty">暂无记录</div>'; return; }
    const tabs = document.querySelectorAll('[data-hist]');
    tabs.forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-hist') === historyMode); });
    let html = '';
    dates.forEach(function (date) {
      const c = checkins[date] || {};
      const trained = !!(c.training || extraDay(date));
      html += '<div class="hist-item"><button class="hist-btn" data-hist-date="' + date + '"><span class="d">' + esc(date.slice(5)) + '</span><span>' + (trained ? '✔ 训练' : '·') + '</span><span>睡眠' + (c.sleep ? '✔' : '✘') + '</span><span>晨勃' + (c.morning ? '✔' : '✘') + '</span><span>RPE ' + esc(c.rpe || '—') + '</span></button><div class="hist-detail" id="hist-detail-' + date + '" style="display:none">' + historyDayDetail(date) + '</div></div>';
    });
    list.innerHTML = html;
    list.querySelectorAll('[data-hist-date]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const date = btn.getAttribute('data-hist-date');
        const box = document.getElementById('hist-detail-' + date);
        if (box) box.style.display = box.style.display === 'none' ? '' : 'none';
      });
    });
  }
  function bindHistory() {
    const tabs = document.querySelectorAll('[data-hist]');
    tabs.forEach(function (t) {
      t.addEventListener('click', function () {
        historyMode = t.getAttribute('data-hist');
        renderHistory();
      });
    });
  }

  // ---------- 训练负荷（Foster sRPE + 单调性/应变 + ACWR） ----------
  function parsePlanMin(str) {
    if (!str) return null;
    const m = String(str).match(/(\d+)\s*[-~]\s*(\d+)/);
    if (m) return (Number(m[1]) + Number(m[2])) / 2;
    const s = String(str).match(/(\d+)/);
    return s ? Number(s[1]) : null;
  }
  // 单日负荷：打卡RPE(6-20 映射到0-10 CR10) × 时长；未填时长退回计划时长
  function dayLoad(date) {
    let load = 0;
    const c = checkins[date];
    if (c && c.training && c.rpe) {
      const rpe = Number(c.rpe);
      const cr10 = Math.max(0, Math.min(10, (rpe - 6) / 14 * 10));
      let dur = Number(c.duration) || 0;
      if (!dur) {
        const d = allDays.find(function (x) { return x.date === date; });
        dur = parsePlanMin(d ? d.duration : '') || 0;
      }
      load += Math.round(cr10 * dur * 10) / 10;
    }
    const ex = extra[date];
    if (ex && Array.isArray(ex.sessions)) {
      ex.sessions.forEach(function (sess) {
        if (!sess || !sess.rpe) return;
        const cr10 = Math.max(0, Math.min(10, (Number(sess.rpe) - 6) / 14 * 10));
        let dur = Number(sess.duration) || 0;
        if (!dur) dur = parsePlanMin(String(sess.duration)) || 0;
        load += Math.round(cr10 * dur * 10) / 10;
      });
    }
    return Math.round(load * 10) / 10;
  }
  function sumRange(from, to) {
    let s = 0;
    for (let d = from; d <= to; d = addDays(d, 1)) s += dayLoad(d);
    return s;
  }
  function meanStd(arr) {
    const vals = arr.filter(function (v) { return v > 0; });
    if (!vals.length) return { mean: 0, sd: 0, n: 0 };
    const mean = vals.reduce(function (a, v) { return a + v; }, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce(function (a, v) { return a + (v - mean) * (v - mean); }, 0) / vals.length);
    return { mean: mean, sd: sd, n: vals.length };
  }
  function weeklyLoadMetrics(date) {
    // 本周一
    const d = parseDate(date);
    const dow = (d.getDay() + 6) % 7; // 周一=0
    const monday = addDays(date, -dow);
    const load = sumRange(monday, addDays(monday, 6));
    const arr = [];
    for (let i = 0; i < 7; i++) arr.push(dayLoad(addDays(monday, i)));
    const ms = meanStd(arr);
    const monotony = ms.sd > 0 ? Math.round(ms.mean / ms.sd * 100) / 100 : 0;
    const strain = Math.round(load * monotony * 100) / 100;
    return { monday: monday, load: Math.round(load * 10) / 10, monotony: monotony, strain: strain, n: ms.n };
  }
  function acwr(date) {
    // 急性=近7天日均，慢性=近28天日均；需有≥28天历史记录才显示
    const keys = Object.keys(checkins).filter(function (k) { return checkins[k] && checkins[k].rpe; }).sort();
    if (!keys.length || diffDays(keys[0], date) < 27) return null;
    const last = addDays(date, 1); // 含今天
    const acute = sumRange(addDays(last, -7), last) / 7;
    const chronic = sumRange(addDays(last, -28), last) / 28;
    if (chronic <= 0) return null;
    return { value: Math.round(acute / chronic * 100) / 100, acute: Math.round(acute * 10) / 10, chronic: Math.round(chronic * 10) / 10 };
  }
  function monthLoad(date) {
    const mk = date.slice(0, 7);
    let s = 0;
    Object.keys(checkins).forEach(function (d) {
      if (d.startsWith(mk)) s += dayLoad(d);
    });
    return Math.round(s * 10) / 10;
  }

  // ---------- 成绩 ----------
  const TEST_POINTS = ['基线', '第6周', '第12周'];
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
      { key: 'run100', label: '100m', base: 12.8, target: 12.2, lower: true },
      { key: 'run400', label: '400m', base: 60, target: 56, lower: true },
      { key: 'approach', label: '助跑摸高', base: 295, target: 308, lower: false },
      { key: 'longJump', label: '立定跳远', base: 270, target: 290, lower: false },
      { key: 'squat', label: '深蹲', base: 105, target: 120, lower: false },
      { key: 'deadlift', label: '相扑硬拉', base: 130, target: 150, lower: false }
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
      const a = window.PLAN_ANNOTATE ? window.PLAN_ANNOTATE(e) : e;
      html += '<li><span class="exercise-name" style="color:' + esc(e.color || '#ffb84d') + '">' + esc(e.name) + exBadges(a) + '</span><span class="exercise-detail">' + esc(e.cat) + ' · ' + esc(e.detail || '') + ' <button class="btn mini" data-edit="' + esc(id) + '">改</button> <button class="btn mini danger" data-del="' + esc(id) + '">删</button></span></li>';
    });
    html += '</ul>';
    box.innerHTML = html;
    box.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () {
        const e = exercises[b.getAttribute('data-edit')];
        $('ex-name').value = e.name; $('ex-cat').value = e.cat || '自定义'; $('ex-detail').value = e.detail || ''; $('ex-color').value = e.color || '#ffb84d'; $('ex-note').value = e.note || '';
        const ea = window.PLAN_ANNOTATE ? window.PLAN_ANNOTATE(e) : e;
        $('ex-intensity').value = e.intensity || ea.intensity || '';
        $('ex-focus').value = e.focus || ea.focus || '';
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
    const raw = { name: name, cat: $('ex-cat').value, detail: $('ex-detail').value.trim(), color: $('ex-color').value, note: $('ex-note').value.trim(), intensity: $('ex-intensity').value, focus: $('ex-focus').value };
    const a = window.PLAN_ANNOTATE ? window.PLAN_ANNOTATE(raw) : raw;
    const data = { name: name, cat: raw.cat, detail: raw.detail, color: raw.color, note: raw.note, intensity: raw.intensity || a.intensity, focus: raw.focus || a.focus };
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
      const blob = new Blob([JSON.stringify({ checkins: checkins, sleep: sleeps, tests: tests, exercises: exercises, dayItems: dayItems, weather: weathers, exec: execs, extra: extra, coros: coros, settings: settings }, null, 2)], { type: 'application/json' });
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
          if (d.checkins) Object.keys(d.checkins).forEach(function (k) { checkins[k] = d.checkins[k]; });
          if (d.sleep) Object.keys(d.sleep).forEach(function (k) { sleeps[k] = d.sleep[k]; });
          if (d.tests) Object.keys(d.tests).forEach(function (k) { tests[k] = d.tests[k]; });
          if (d.exercises) Object.keys(d.exercises).forEach(function (k) { exercises[k] = d.exercises[k]; });
          if (d.dayItems) Object.keys(d.dayItems).forEach(function (k) { dayItems[k] = d.dayItems[k]; });
          if (d.weather) Object.keys(d.weather).forEach(function (k) { weathers[k] = d.weather[k]; });
          if (d.exec) Object.keys(d.exec).forEach(function (k) { execs[k] = d.exec[k]; });
          if (d.extra) Object.keys(d.extra).forEach(function (k) { extra[k] = d.extra[k]; });
          if (d.coros) coros = d.coros;
          if (d.settings && d.settings.privacy) settings = Object.assign(settings, { privacy: d.settings.privacy });
          for (const k of Object.keys(checkins)) await saveCheckinByDate(k, checkins[k]);
          for (const k of Object.keys(sleeps)) await saveSleep(k, sleeps[k]);
          await saveTests();
          for (const k of Object.keys(exercises)) await saveExercise(k, exercises[k]);
          for (const k of Object.keys(dayItems)) await saveDayItems(k, dayItems[k]);
          for (const k of Object.keys(weathers)) await saveWeather(k, weathers[k]);
          for (const k of Object.keys(execs)) await saveExec(k, execs[k]);
          for (const k of Object.keys(extra)) await API.save('extra', k, extra[k]);
          if (coros) await saveCoros(coros);
          if (settings.reminders) await API.saveSetting('reminders', settings.reminders);
          $('backupMsg').textContent = '✔ 导入完成，请刷新';
        } catch (e) { $('backupMsg').textContent = '导入失败：' + e.message; $('backupMsg').className = 'form-msg err'; }
      };
      reader.readAsText(f);
    });
    $('btn-set-privacy').addEventListener('click', function () {
      privacyMode = 'change';
      var sub = document.querySelector('#privacyOverlay .modal-sub');
      if (sub) sub.textContent = '输入新隐私密码（会用新密码重新加密所有敏感数据）';
      showOverlay('privacyOverlay');
    });
    const brp = $('btn-reset-privacy');
    if (brp) brp.addEventListener('click', resetPrivacy);
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
    const bsw = $('btn-save-weather'); if (bsw) bsw.addEventListener('click', onSaveWeather);
    const bse = $('btn-save-exec'); if (bse) bse.addEventListener('click', onSaveExec);
    const bse2 = $('btn-save-extra'); if (bse2) bse2.addEventListener('click', onSaveExtra);
    const bsn = $('btn-save-nap'); if (bsn) bsn.addEventListener('click', onSaveNap);
    const bar = $('btn-ex-add-row'); if (bar) bar.addEventListener('click', function () { renderExtraMainRows(readExtraMainRows().concat([{ name: '', detail: '' }])); });
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


