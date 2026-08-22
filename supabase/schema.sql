-- supabase/schema.sql — 在 Supabase SQL Editor 里执行一次
-- 单表 KV 设计：kind ∈ checkin/sleep/test/exercise/dayItem/coros/setting/pushSub

create table if not exists public.records (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  key text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, key)
);

alter table public.records enable row level security;

drop policy if exists "own_records_all" on public.records;
create policy "own_records_all" on public.records
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 推送服务（GitHub Actions / cron-job）所需策略：
-- 匿名只读 pushSub / pushLog / setting(key=reminders)，匿名只写 pushLog
-- （pushSub 只含浏览器推送端点，无 VAPID 私钥无法利用；privacy 等敏感 setting 不可匿名读）
drop policy if exists "push_service_read" on public.records;
create policy "push_service_read" on public.records
  for select using (
    kind = 'pushSub' or kind = 'pushLog' or (kind = 'setting' and key = 'reminders')
  );

drop policy if exists "push_service_log" on public.records;
create policy "push_service_log" on public.records
  for insert with check (kind = 'pushLog');
