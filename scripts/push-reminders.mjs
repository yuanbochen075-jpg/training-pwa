/**
 * scripts/push-reminders.mjs — GitHub Actions 定时推送
 * 由 .github/workflows/push.yml 每 30 分钟触发。
 * 环境变量：SUPABASE_URL / SUPABASE_ANON_KEY / VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY
 * 依赖 Supabase 新增 RLS 策略（见 supabase/schema.sql 底部）：
 *   - 允许匿名读 pushSub / pushLog / setting(key=reminders)
 *   - 允许匿名写 pushLog
 */
import webpush from 'web-push';

const URL = process.env.SUPABASE_URL || '';
const KEY = process.env.SUPABASE_ANON_KEY || '';
const VPUB = process.env.VAPID_PUBLIC_KEY || '';
const VPRIV = process.env.VAPID_PRIVATE_KEY || '';
const TZ = 8 * 60 * 60 * 1000; // Asia/Shanghai

const REMINDERS = [
  { id: 'morning',  title: '🌅 早晨记录昨晚睡眠', body: '先记录睡眠，训练会自动调整', time: '07:00' },
  { id: 'checkin',  title: '✅ 训练打卡', body: '记得打卡今天训练', time: '18:00' },
  { id: 'bedtime',  title: '🌙 睡前准备+记录', body: '准备睡觉，记录今天的睡眠', time: '22:30' }
];

function pad(n) { return String(n).padStart(2, '0'); }
function nowCn() {
  const n = new Date(Date.now() + TZ);
  return { hhmm: pad(n.getUTCHours()) + ':' + pad(n.getUTCMinutes()), date: n.toISOString().slice(0, 10) };
}
function withinWindow(hhmm, target) {
  const toMin = s => { const p = s.split(':').map(Number); return p[0] * 60 + p[1]; };
  const diff = toMin(hhmm) - toMin(target);
  return diff >= 0 && diff <= 7; // 命中目标时间后 7 分钟内（容忍 Actions 延迟）
}

async function sup(path, opts) {
  const headers = {
    'apikey': KEY,
    'Authorization': 'Bearer ' + KEY,
    'Content-Type': 'application/json'
  };
  const r = await fetch(URL + path, Object.assign({ headers }, opts || {}));
  if (!r.ok) throw new Error('supabase ' + r.status + ' ' + (await r.text()).slice(0, 300));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

if (!URL || !KEY || !VPUB || !VPRIV) {
  console.error('缺少环境变量（SUPABASE_URL / SUPABASE_ANON_KEY / VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY）');
  process.exit(1);
}

webpush.setVapidDetails('mailto:training@example.com', VPUB, VPRIV);

const { hhmm, date } = nowCn();
console.log('checking', date, hhmm);

try {
  const subs = (await sup('/rest/v1/records?kind=eq.pushSub&select=user_id,key,data')) || [];
  const settings = (await sup('/rest/v1/records?kind=eq.setting&key=eq.reminders&select=user_id,key,data')) || [];
  const settingMap = {};
  settings.forEach(s => { settingMap[s.user_id] = s.data || {}; });

  let sent = 0, due = 0;
  for (const sub of subs) {
    const reminders = settingMap[sub.user_id] || {};
    for (const r of REMINDERS) {
      const v = reminders[r.id] || { enabled: true, time: r.time };
      if (!v.enabled) continue;
      if (!withinWindow(hhmm, v.time || r.time)) continue;
      due++;
      const logKey = sub.user_id + ':' + r.id + ':' + date;
      const existed = await sup('/rest/v1/records?kind=eq.pushLog&key=eq.' + encodeURIComponent(logKey) + '&select=key');
      if (existed && existed.length) { console.log('skip (already sent)', logKey); continue; }
      const payload = { title: r.title, body: r.body, url: './' };
      const subData = sub.data || {};
      try {
        await webpush.sendNotification({ endpoint: subData.endpoint, keys: subData.keys || {} }, JSON.stringify(payload));
        await sup('/rest/v1/records', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ user_id: sub.user_id, kind: 'pushLog', key: logKey, data: { sentAt: new Date().toISOString() }, updated_at: new Date().toISOString() })
        });
        sent++;
        console.log('sent', logKey);
      } catch (e) {
        console.warn('push failed (subscription may be dead):', e.message);
      }
    }
  }
  console.log('done. due=' + due + ' sent=' + sent);
} catch (e) {
  console.error('error:', e.message);
  process.exit(1);
}
