/**
 * api.js — 统一数据访问层
 * 本地模式：localStorage（离线可用）
 * 云端模式：Supabase REST（Auth + records 表，RLS 按用户隔离）
 * 换国内服务时只需替换本文件实现，业务代码不变。
 */
(function () {
  'use strict';
  const LS_DB = 'pwa_local_db';
  const LS_SESSION = 'pwa_session';
  const LS_CLOUD = 'app_cloud_config';

  function getCloudCfg() {
    try { return JSON.parse(localStorage.getItem(LS_CLOUD) || 'null'); } catch (e) { return null; }
  }
  function cfg() {
    const c = getCloudCfg() || {};
    return {
      mode: (c.SUPABASE_URL && c.SUPABASE_ANON_KEY) ? 'cloud' : (window.APP_CONFIG.MODE || 'local'),
      url: c.SUPABASE_URL || window.APP_CONFIG.SUPABASE_URL || '',
      anon: c.SUPABASE_ANON_KEY || window.APP_CONFIG.SUPABASE_ANON_KEY || '',
      vapid: c.VAPID_PUBLIC_KEY || window.APP_CONFIG.VAPID_PUBLIC_KEY || ''
    };
  }
  function getSession() {
    try { return JSON.parse(localStorage.getItem(LS_SESSION) || 'null'); } catch (e) { return null; }
  }
  function setSession(s) {
    if (s) localStorage.setItem(LS_SESSION, JSON.stringify(s));
    else localStorage.removeItem(LS_SESSION);
  }

  // ---------- 本地数据库 ----------
  function db() {
    try { return JSON.parse(localStorage.getItem(LS_DB) || 'null') || {}; } catch (e) { return {}; }
  }
  function saveDb(d) { localStorage.setItem(LS_DB, JSON.stringify(d)); }
  function localGet(kind, key) {
    const d = db();
    const bucket = d[kind] || {};
    return key == null ? bucket : bucket[key];
  }
  function localSet(kind, key, data) {
    const d = db();
    if (!d[kind]) d[kind] = {};
    d[kind][key] = data;
    saveDb(d);
  }
  function localDel(kind, key) {
    const d = db();
    if (d[kind]) { delete d[kind][key]; saveDb(d); }
  }

  // ---------- Supabase REST ----------
  async function supFetch(path, opts) {
    const c = cfg();
    const o = Object.assign({}, opts || {});
    const headers = Object.assign({ 'apikey': c.anon, 'Content-Type': 'application/json' }, o.headers || {});
    const s = getSession();
    if (s && s.access_token) headers['Authorization'] = 'Bearer ' + s.access_token;
    o.headers = headers;
    const r = await fetch(c.url + path, o);
    if (!r.ok) {
      let msg = 'HTTP ' + r.status;
      try { const j = await r.json(); msg = j.msg || j.error_description || j.message || msg; } catch (e) {}
      throw new Error(msg);
    }
    const t = await r.text();
    return t ? JSON.parse(t) : null;
  }
  async function authSignUp(email, password) {
    const j = await supFetch('/auth/v1/signup', { method: 'POST', body: JSON.stringify({ email: email, password: password }) });
    setSession({ access_token: j.access_token, refresh_token: j.refresh_token, user: j.user });
    return j.user;
  }
  async function authSignIn(email, password) {
    const j = await supFetch('/auth/v1/token?grant_type=password', { method: 'POST', body: JSON.stringify({ email: email, password: password }) });
    setSession({ access_token: j.access_token, refresh_token: j.refresh_token, user: j.user });
    return j.user;
  }
  async function authSignOut() {
    try { await supFetch('/auth/v1/logout', { method: 'POST' }); } catch (e) {}
    setSession(null);
  }

  async function cloudLoadAll() {
    const s = getSession();
    if (!s) return {};
    const rows = await supFetch('/rest/v1/records?select=kind,key,data&order=updated_at.desc');
    const out = {};
    (rows || []).forEach(function (row) {
      if (!out[row.kind]) out[row.kind] = {};
      out[row.kind][row.key] = row.data;
    });
    return out;
  }
  async function cloudSave(kind, key, data) {
    const s = getSession();
    if (!s) throw new Error('未登录');
    await supFetch('/rest/v1/records', {
      method: 'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({
        user_id: s.user.id,
        kind: kind,
        key: key,
        data: data,
        updated_at: new Date().toISOString()
      })
    });
  }
  async function cloudRemove(kind, key) {
    const s = getSession();
    if (!s) return;
    await supFetch('/rest/v1/records?user_id=eq.' + encodeURIComponent(s.user.id) + '&kind=eq.' + encodeURIComponent(kind) + '&key=eq.' + encodeURIComponent(key), { method: 'DELETE' });
  }

  // ---------- 公开接口 ----------
  const API = {
    isCloud: function () { return cfg().mode === 'cloud'; },
    cloudCfg: function () { return cfg(); },
    saveCloudCfg: function (c) {
      localStorage.setItem(LS_CLOUD, JSON.stringify(c));
      location.reload();
    },
    clearCloudCfg: function () { localStorage.removeItem(LS_CLOUD); location.reload(); },
    session: getSession,
    signUp: authSignUp,
    signIn: authSignIn,
    signOut: authSignOut,

    loadAll: async function () {
      if (API.isCloud()) {
        const d = await cloudLoadAll();
        return {
          checkins: d.checkin || {},
          sleep: d.sleep || {},
          tests: d.test || {},
          exercises: d.exercise || {},
          dayItems: d.dayItem || {},
          coros: d.coros ? d.coros['latest'] : null,
          settings: d.setting || {},
          pushSub: d.pushSub ? d.pushSub['latest'] : null
        };
      }
      const d = db();
      return {
        checkins: d.checkin || {},
        sleep: d.sleep || {},
        tests: d.test || {},
        exercises: d.exercise || {},
        dayItems: d.dayItem || {},
        coros: d.coros ? d.coros['latest'] : null,
        settings: d.setting || {},
        pushSub: d.pushSub ? d.pushSub['latest'] : null
      };
    },

    save: async function (kind, key, data) {
      if (API.isCloud()) return cloudSave(kind, key, data);
      return localSet(kind, key, data);
    },
    remove: async function (kind, key) {
      if (API.isCloud()) return cloudRemove(kind, key);
      return localDel(kind, key);
    },

    saveCoros: async function (snapshot) {
      return API.save('coros', 'latest', snapshot);
    },
    saveSetting: async function (key, data) {
      return API.save('setting', key, data);
    },
    savePushSub: async function (sub) {
      return API.save('pushSub', 'latest', sub);
    }
  };
  window.API = API;
})();
