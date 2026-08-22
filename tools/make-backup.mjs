/**
 * tools/make-backup.mjs — 把旧版 outputs/data 的本地 JSON 转成 PWA 备份格式
 * 用法：node tools/make-backup.mjs [输出路径]
 * 然后在网页「设置 → 备份」导入该文件（导入前先设置隐私密码，敏感字段会自动加密）。
 */
import fs from 'node:fs';
import path from 'node:path';

const dataDir = process.argv[2] || path.resolve('C:/Users/MR/Documents/Codex/2026-08-22/172cm-67kg-12-4s-400m58s-280cm-2/outputs/data');
const outFile = process.argv[3] || path.resolve('C:/Users/MR/Documents/Codex/2026-08-22/172cm-67kg-12-4s-400m58s-280cm-2/work/训练助手备份-待导入.json');

function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return null; } }

const backup = {
  exportedAt: new Date().toISOString(),
  checkins: readJson(path.join(dataDir, 'checkins.json')) || {},
  sleep: readJson(path.join(dataDir, 'sleep.json')) || {},
  tests: readJson(path.join(dataDir, 'tests.json')) || {},
  exercises: readJson(path.join(dataDir, 'exercises.json')) || {},
  dayItems: readJson(path.join(dataDir, 'dayItems.json')) || {},
  coros: readJson(path.join(dataDir, 'coros.json')) || null,
  settings: {}
};

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(backup, null, 2), 'utf8');
console.log('备份文件已生成：' + outFile);
console.log('checkins=' + Object.keys(backup.checkins).length + ' sleep=' + Object.keys(backup.sleep).length + ' tests=' + Object.keys(backup.tests).length + ' coros=' + (backup.coros ? 1 : 0));
