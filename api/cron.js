/**
 * api/cron.js — Vercel Serverless：定时推送提醒
 * 触发方式：Vercel Cron（Hobby 每天一次）或 cron-job.org 每5分钟 GET 本接口
 * 环境变量：SUPABASE_URL / SUPABASE_SERVICE_KEY / VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
 */
import webpush from 'web-push';

const URL = process.env.SUPABASE_URL || '';
const KEY = process.env.SUPABASE_SERVICE_KEY || '';
const VPUB = process.env.VAPID_PUBLIC_KEY || '';
const VPRIV = process.env.VAPID_PRIVATE_KEY || '';
const TZ = 8 * 60 * 60 * 1000; // Asia/Shanghai

function pad(n) { return String(n).padStart(2, '0'); }

async function sup(path, opts) {
  const headers = {
    'apikey': KEY,
    'Authorization': 'Bearer ' + KEY,
    'Content-Type': 'application/json'
  };
  const r = await fetch(URL + path, Object.assign({ headers: headers }, opts || {}));
  if (!r.ok) throw new Error('supabase ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'method' });
  if (!URL || !KEY || !VPUB || !VPRIV) return res.status(500).json({ error: 'missing env' });
  webpush.setVapidDetails('mailto:training@example.com', VPUB, VPRIV);

  const now = new Date();
  const cn = new Date(now.getTime() + TZ);
  const hhmm = pad(cn.getUTCHours()) + ':' + pad(cn.getUTCMinutes());
  const dateStr = cn.toISOString().slice(0, 10);

  const REMINDERS = [
    { id: 'morning', title: '🌅 早晨记录昨晚睡眠', body: '先记录睡眠，训练会自动调整' },
    { id: 'checkin', title: '✅ 训练打卡', body: '记得打卡今天训练' },
    { id: 'bedtime', title: '🌙 睡前准备+记录', body: '准备睡觉，记录今天的睡眠' }
  ];

  try {
    const subs = (await sup('/rest/v1/records?kind=eq.pushSub&select=user_id,key,data')) || [];
    const settings = (await sup('/rest/v1/records?kind=eq.setting&select=user_id,key,data')) || [];
    const settingMap = {};
    settings.forEach(function (s) {
      if (s.key === 'reminders') settingMap[s.user_id] = s.data || {};
    });

    let sent = 0;
    for (const sub of subs) {
      const reminders = settingMap[sub.user_id] || {};
      for (const r of REMINDERS) {
        const v = reminders[r.id] || { enabled: true, time: r.time };
        if (!v.enabled || (v.time || r.time) !== hhmm) continue;
        const logKey = sub.user_id + ':' + r.id + ':' + dateStr;
        const existed = await sup('/rest/v1/records?kind=eq.pushLog&key=eq.' + encodeURIComponent(logKey) + '&select=key');
        if (existed && existed.length) continue;
        const payload = { title: r.title, body: r.body, url: './' };
        const subData = sub.data || {};
        const pushSub = {
          endpoint: subData.endpoint,
          keys: subData.keys || {}
        };
        try {
          await webpush.sendNotification(pushSub, JSON.stringify(payload));
          await sup('/rest/v1/records', {
            method: 'POST',
            headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
            body: JSON.stringify({ user_id: sub.user_id, kind: 'pushLog', key: logKey, data: { sentAt: new Date().toISOString() }, updated_at: new Date().toISOString() })
          });
          sent++;
        } catch (e) { /* 订阅失效忽略 */ }
      }
    }
    return res.status(200).json({ ok: true, time: hhmm, sent: sent });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
