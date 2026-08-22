# 训练助手 PWA（云端版 · GitHub Pages + Supabase）

电脑/手机用**同一个网址**访问、数据自动同步的 PWA 训练助手。
- 睡眠优先：打开先记录睡眠 → 自动评分 → 自动调整当天训练强度
- 打卡 / 周月统计 / 测试成绩 / 自定义运动库 / 高驰快照
- 敏感字段（睡眠分期、手淫、备注、晨重）用「隐私密码」AES-GCM 加密后上云，只在浏览器内存解密
- 每日提醒推送：GitHub Actions 定时触发 Web Push

## 一、本地预览（可选）
```bash
cd training-pwa
python -m http.server 8080
# 或 npx serve .
```
打开 http://127.0.0.1:8080 —— 默认「云端模式」，未登录时也可切「本地模式」（数据只存本浏览器）。

## 二、部署到 GitHub Pages（免费）

### 1. 前置
- GitHub 账号
- Supabase 项目（已建好：`https://aeblhrlppllwagdqylav.supabase.co`）

### 2. 执行 schema（只做一次）
打开 Supabase Dashboard → SQL Editor → 粘贴 `supabase/schema.sql` 执行。
> 如果你之前已执行过旧版 schema，只需再执行文件**底部新增的两条 RLS 策略**（推送服务匿名读写权限）。

### 3. 创建仓库并推送
在 GitHub 新建仓库（建议名 `training-pwa`，Public 则 Actions 额度无限）：
```bash
cd training-pwa
git init -b main
git add .
git commit -m "init"
git remote add origin https://github.com/<你的用户名>/training-pwa.git
git push -u origin main
```

### 4. 启用 Pages
仓库 Settings → Pages → Source 选 **GitHub Actions**（部署 workflow 已写好，push 后自动发布）。
发布地址：`https://<你的用户名>.github.io/training-pwa/`

### 5. 配置推送提醒 Secrets（可选但推荐）
仓库 Settings → Secrets and variables → Actions → New repository secret，添加：
| Secret | 值 |
|---|---|
| `SUPABASE_URL` | `https://aeblhrlppllwagdqylav.supabase.co` |
| `SUPABASE_ANON_KEY` | `sb_publishable_fT36-3hxppv1xZCmjvvMdQ_Wwrq43Ku` |
| `VAPID_PUBLIC_KEY` | 见 `work/vapid-keys.txt`（不在仓库内） |
| `VAPID_PRIVATE_KEY` | 见 `work/vapid-keys.txt`（不在仓库内）（私钥只放这里，绝不进代码/聊天） |

`.github/workflows/push.yml` 每 30 分钟检查一次，到用户设置的提醒时间（默认 07:00 / 18:00 / 22:30）就推送。
> GitHub Actions 免费额度：Public 仓库无限；Private 仓库每月 2000 分钟（本工作流每 30 分钟约消耗 1440 分钟/月）。

### 6. 打开网页
- 手机：浏览器打开 `https://<你的用户名>.github.io/training-pwa/` → 菜单「添加到主屏幕」像 App 一样用
- 电脑：同一个网址
- 注册/登录账号（Supabase Auth，邮箱密码）→ 设置「隐私密码」→ 开始使用

## 三、迁移旧数据（本地 outputs/data）
### 方式 A：网页导入（推荐）
```bash
node tools/make-backup.mjs
```
生成 `work/训练助手备份-待导入.json`，传到手机或电脑 → 网页「设置 → 备份 → 导入」。
**导入前先在网页设置好隐私密码**，敏感字段会自动加密。

### 方式 B：命令行迁移（可选）
只用公开 anon key + 你的登录邮箱密码，不需要 service key：
```bash
SUPABASE_URL=https://aeblhrlppllwagdqylav.supabase.co SUPABASE_ANON_KEY=sb_publishable_fT36-3hxppv1xZCmjvvMdQ_Wwrq43Ku node supabase/migrate.mjs
```
按提示输入邮箱/密码/隐私密码。包含：checkins、sleep、tests、高驰快照（117 条活动）。

## 四、高驰数据同步
保留「浏览器登录高驰 → 我读取 → 写入云端快照」流程：
- 网页「高驰」页显示最近同步摘要和同步时间
- 新训练后把高驰网页数据发给我，我更新快照（写入 Supabase，刷新即同步到所有设备）

## 五、说明
- 隐私密码 ≠ 登录密码：登录管“你是谁”，隐私密码管“能否解密”，只在浏览器内存解密，云端只有密文。
- 数据表：单表 `records(user_id, kind, key, data, updated_at)`，RLS 按用户隔离。
- 换国内云时只需替换 `api.js` 实现，业务代码不变。
- 老 Vercel 部署 `training-pwa-kappa.vercel.app` 已弃用；如保留，注意其 cron 已迁移到 GitHub Actions。




