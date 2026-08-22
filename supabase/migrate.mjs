/**
 * supabase/migrate.mjs — 把本地 outputs/data 的数据导入 Supabase
 *
 * 两种方式（任选其一）：
 *   A. 服务端密钥（不推荐，除非你有 service_role key）：
 *      SUPABASE_URL=... SUPABASE_SERVICE_KEY=... SUPABASE_USER_ID=... node supabase/migrate.mjs
 *   B. 自己账号登录（推荐，只用公开 anon key + 你的邮箱密码，RLS 自动隔离）：
 *      SUPABASE_URL=... SUPABASE_ANON_KEY=... node supabase/migrate.mjs
 *      脚本会提示输入邮箱/密码，登录后以你的身份写入，无需 service key。
 *
 * 都会提示输入“隐私密码”，用于加密敏感字段（睡眠分期/手淫/备注/晨重）。
 * SUPABASE_USER_ID 可从网页设置页登录后查看，或查 auth.users；B 方式自动获取。
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import crypto from 'node:crypto';

const { subtle } = globalThis.crypto;
const enc = new TextEncoder();
const dec = new TextDecoder();

const URL = process.env.SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
let USER_ID = process.env.SUPABASE_USER_ID || '';
let PASS = process.env.PRIVACY_PASS || '';

function b64(buf) { const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf); let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return btoa(s); }
function unb64(s) { const bin = atob(s); const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i); return b; }
async function deriveKey(pass, saltB64) {
  const base = await subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'PBKDF2', salt: unb64(saltB64), iterations: 120000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function encryptText(text, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(String(text == null ? '' : text)));
  return { enc: true, iv: b64(iv), ct: b64(ct) };
}
async function encryptFields(obj, key, fields) {
  const out = Object.assign({}, obj || {});
  for (const f of fields) if (out[f] !== undefined && out[f] !== null) out[f] = await encryptText(out[f], key);
  return out;
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q) { return new Promise(function (resolve) { rl.question(q, function (a) { resolve(a.trim()); }); }); }

let authToken = SERVICE_KEY;
async function ensureAuth() {
  if (SERVICE_KEY) { if (!USER_ID) throw new Error('service key 模式需要 SUPABASE_USER_ID'); return; }
  if (!ANON_KEY) throw new Error('请提供 SUPABASE_SERVICE_KEY 或 SUPABASE_ANON_KEY');
  const email = await ask('Supabase 登录邮箱: ');
  const password = await ask('Supabase 登录密码: ');
  const r = await fetch(URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!r.ok) throw new Error('登录失败 ' + r.status + ': ' + (await r.text()).slice(0, 300));
  const j = await r.json();
  authToken = j.access_token;
  USER_ID = j.user.id;
  console.log('登录成功，user id = ' + USER_ID);
}

async function sup(path, opts) {
  const headers = { apikey: SERVICE_KEY || ANON_KEY, Authorization: 'Bearer ' + authToken, 'Content-Type': 'application/json' };
  const r = await fetch(URL + path, Object.assign({ headers }, opts || {}));
  if (!r.ok) throw new Error('supabase ' + r.status + ': ' + (await r.text()).slice(0, 300));
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
async function upsert(kind, key, data) {
  await sup('/rest/v1/records', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: USER_ID, kind, key, data, updated_at: new Date().toISOString() })
  });
}

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }

if (!URL) { console.error('缺少 SUPABASE_URL'); process.exit(1); }
await ensureAuth();
if (!PASS) PASS = await ask('隐私密码（用于加密敏感字段，回车则明文导入）: ');

const dataDir = process.argv[2] || path.resolve('C:/Users/MR/Documents/Codex/2026-08-22/172cm-67kg-12-4s-400m58s-280cm-2/outputs/data');
const checkins = readJson(path.join(dataDir, 'checkins.json')) || {};
const sleep = readJson(path.join(dataDir, 'sleep.json')) || {};
const tests = readJson(path.join(dataDir, 'tests.json')) || {};
const coros = readJson(path.join(dataDir, 'coros.json')) || null;

let privKey = null;
if (PASS) {
  const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
  privKey = await deriveKey(PASS, salt);
  const check = await encryptText('OK', privKey);
  await upsert('setting', 'privacy', { salt, check });
  console.log('隐私密码已设置');
}

let n = 0;
for (const [date, data] of Object.entries(checkins)) {
  const d = privKey ? await encryptFields(data, privKey, ['mast', 'weight', 'note']) : data;
  await upsert('checkin', date, d); n++;
}
for (const [date, data] of Object.entries(sleep)) {
  const d = privKey ? await encryptFields(data, privKey, ['deep', 'light', 'rem', 'note']) : data;
  await upsert('sleep', date, d); n++;
}
for (const [point, data] of Object.entries(tests)) { await upsert('test', point, data); n++; }
if (coros) { await upsert('coros', 'latest', coros); n++; }
console.log('导入完成，共写入 ' + n + ' 条记录（checkins=' + Object.keys(checkins).length + ', sleep=' + Object.keys(sleep).length + ', tests=' + Object.keys(tests).length + ', coros=' + (coros ? 1 : 0) + '）');
rl.close();
