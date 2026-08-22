/**
 * plan-data.js — 3个月冲刺计划（12周 = 3阶段：重建/能力/专项 + 测验周）
 * 依据：2025新规等级（100m二级11.54电计 / 400m二级52.43电计）
 * 起算：2026-08-24（周一）；每周5练（D1-D5），周六可选，周日全休
 */
(function () {
  'use strict';

  const PROGRAM_START = '2026-08-24'; // 周一
  const TOTAL_WEEKS = 12;

  const PHASES = ['基线测试', '重建期', '能力期', '专项期', '测验周'];

  function phaseForWeek(w) {
    if (w === 1) return PHASES[0];
    if (w <= 4) return PHASES[1];
    if (w <= 8) return PHASES[2];
    if (w <= 11) return PHASES[3];
    return PHASES[4];
  }

  function parseDate(s) {
    const parts = s.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function fmtDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function addDays(dateStr, n) {
    const d = parseDate(dateStr);
    d.setDate(d.getDate() + n);
    return fmtDate(d);
  }

  const DOW = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  const COMMON_SLEEP = { bedtime: '23:00', wake: '07:00', hours: '7-8h', nap: '午休≤20min' };
  const PROTEIN = '蛋白质130-140g/天：鸡蛋、鸡胸、鱼、牛肉、豆制品、牛奶';

  function restDay() { return { type: 'rest', title: '完全休息', venue: '—', duration: '—', warmup: '', main: [], note: '不安排训练，睡够8h' }; }

  // ---------- 基线测试周（W1） ----------
  function testWeekDay(day) {
    switch (day) {
      case 1: return {
        type: 'test', title: '测试① 形态+弹跳基线', venue: '田径场/家', duration: '45min',
        warmup: '动态热身10min + 慢跑5min',
        main: [
          { name: '体重/体脂', sets: 1, reps: '晨起空腹称重记录', note: '记录到打卡晨重' },
          { name: '助跑摸高', sets: 3, reps: '取最好成绩', note: '标尺或手机App' },
          { name: '原地纵跳CMJ', sets: 3, reps: '取最好成绩' },
          { name: '立定跳远', sets: 3, reps: '取最好成绩' }
        ], note: '只测数据不硬跑，全部记录到「成绩」页'
      };
      case 2: return {
        type: 'test', title: '测试② 短跑计时', venue: '田径场', duration: '50min',
        warmup: '动态热身15min + 2×30m加速',
        main: [
          { name: '30m', sets: 2, reps: '全力计时，取最好' },
          { name: '60m', sets: 2, reps: '全力计时，取最好' },
          { name: '100m', sets: 2, reps: '全力计时，取最好', rest: '组间休10min' }
        ], note: '记录风速；不追成绩，作为基线'
      };
      case 3: return {
        type: 'test', title: '测试③ 1000m', venue: '田径场', duration: '40min',
        warmup: '动态热身 + 慢跑10min',
        main: [
          { name: '1000m', sets: 1, reps: '全力计时', note: '记录成绩（不追2:50）' }
        ], note: '400m留到第2周单独测'
      };
      case 4: return {
        type: 'aerobic', title: '恢复日', venue: '操场/公园', duration: '35-40min',
        warmup: '慢走5min',
        main: [
          { name: 'Zone2慢跑', sets: 1, reps: '20-30min', pace: '心率120-140' },
          { name: '技术drills', sets: 2, reps: 'A/B skip 各20m' }
        ], note: '能边跑边说话'
      };
      case 5: return {
        type: 'lower', title: '轻力量（技术重建）', venue: '健身房', duration: '55min',
        warmup: '髋/踝激活10min',
        main: [
          { name: '杠铃深蹲', sets: 5, reps: '5次', pace: '@60-70%', rest: '2-3min', note: '找动作模式' },
          { name: '相扑硬拉', sets: 3, reps: '5次', pace: '@60%', rest: '2-3min' },
          { name: '引体向上', sets: 3, reps: '6-10次' },
          { name: '平板支撑', sets: 3, reps: '30-45s' }
        ], note: '轻重量，只重建技术'
      };
      case 6: return {
        type: 'longAerobic', title: '可选：排球/轻松有氧', venue: '球场/操场', duration: '30-45min',
        warmup: '慢走5min',
        main: [
          { name: '排球休闲或Zone2慢跑', sets: 1, reps: '30-45min', pace: '心率120-140' }
        ], note: '轻松为主，别累'
      };
      default: return restDay();
    }
  }

  // ---------- 重建期（W2-4） ----------
  function rebuildDay(week, day) {
    switch (day) {
      case 1: return {
        type: 'speed', title: '速度日（技术+加速）', venue: '田径场', duration: '55-65min',
        warmup: '动态热身15min + A/B skip 3×20m',
        main: [
          { name: '加速跑', sets: '4-6', reps: '30-40m', pace: '@80-90%', rest: '2-3min', note: '练起跑姿势' },
          { name: '飞跑', sets: 3, reps: '60m', pace: '@90%', rest: '3-4min' },
          { name: '放松跑', sets: 1, reps: '慢跑5min + 拉伸' }
        ], note: '强度≤90%，不全力'
      };
      case 2: return {
        type: 'lower', title: '下肢力量+背', venue: '健身房', duration: '70min',
        warmup: '髋/踝激活10min',
        main: [
          { name: '杠铃深蹲', sets: 5, reps: '5次', pace: '@75-80%', rest: '2-3min' },
          { name: 'RDL', sets: 3, reps: '6次', pace: '轻-中' },
          { name: '保加利亚分腿蹲', sets: 3, reps: '8次/侧', pace: '自重+' },
          { name: '引体向上', sets: 4, reps: '6-10次' },
          { name: '杠铃划船', sets: 3, reps: '10次' },
          { name: '核心组合', sets: 3, reps: '平板/侧桥/悬垂举腿' }
        ], note: '5×5重建，不冲大重量'
      };
      case 3: return {
        type: 'aerobic', title: '恢复日', venue: '操场/公园', duration: '40-50min',
        warmup: '技术drills 10min',
        main: [
          { name: 'Zone2慢跑', sets: 1, reps: '30-40min', pace: '心率120-145' },
          { name: '核心', sets: 3, reps: '各30s' }
        ], note: '疲劳大可全休'
      };
      case 4: return {
        type: 'speedEnd', title: '400m专项·速度耐力', venue: '田径场', duration: '55-65min',
        warmup: '动态热身15min',
        main: (week === 2 ? [
          { name: '200m', sets: 5, reps: '200m', pace: '@28-30s', rest: '休3min' },
          { name: '轻松跑', sets: 1, reps: '15-20min' }
        ] : week === 3 ? [
          { name: '300m', sets: 3, reps: '300m', pace: '@42-44s', rest: '休5min' },
          { name: '轻松跑', sets: 1, reps: '15-20min' }
        ] : [
          { name: '150m', sets: 6, reps: '150m', pace: '@20-21s', rest: '休2-3min' },
          { name: '轻松跑', sets: 1, reps: '15-20min' }
        ]), note: '找节奏不硬冲'
      };
      case 5: return {
        type: 'jump', title: '弹跳+上肢塑形', venue: '田径场/健身房', duration: '60-70min',
        warmup: '动态热身 + 小跳',
        main: [
          { name: '跳箱(30-45cm)+小跳', sets: 3, reps: '共40-60次触地', pace: '低强度', rest: '组间1-2min' },
          { name: '上斜卧推', sets: 3, reps: '8次' },
          { name: '站姿推举', sets: 3, reps: '8次' },
          { name: '面拉', sets: 3, reps: '12次' },
          { name: '侧平举', sets: 3, reps: '12次' },
          { name: '小腿提踵', sets: 3, reps: '12次' }
        ], note: '弹跳低强度重建'
      };
      case 6: return {
        type: 'longAerobic', title: '可选：排球/轻松有氧', venue: '球场/操场', duration: '30-45min',
        warmup: '慢走5min',
        main: [{ name: '排球或Zone2慢跑', sets: 1, reps: '30-45min', pace: '心率120-140' }],
        note: '保持轻松'
      };
      default: return restDay();
    }
  }

  // ---------- 能力期（W5-8） ----------
  function capabilityDay(week, day) {
    if (week === 6) {
      // 第6周：复测周（100m / 400m / 摸高）
      if (day === 1) return {
        type: 'test', title: '复测① 100m', venue: '田径场', duration: '45min',
        warmup: '动态热身15min + 2×30m加速',
        main: [
          { name: '100m', sets: 2, reps: '全力计时，取最好', rest: '组间休10min' },
          { name: '助跑摸高', sets: 3, reps: '取最好' }
        ], note: '对比第1周基线'
      };
      if (day === 2) return {
        type: 'lower', title: '轻力量', venue: '健身房', duration: '55min',
        warmup: '髋/踝激活10min',
        main: [
          { name: '杠铃深蹲', sets: 3, reps: '5次', pace: '@75%', rest: '2-3min' },
          { name: 'RDL', sets: 3, reps: '6次' },
          { name: '引体向上', sets: 3, reps: '6-10次' }
        ], note: '测试周力量减量'
      };
      if (day === 4) return {
        type: 'test', title: '复测② 400m', venue: '田径场', duration: '45min',
        warmup: '动态热身15min',
        main: [
          { name: '400m', sets: 1, reps: '全力计时', note: '记录成绩' },
          { name: '轻松跑', sets: 1, reps: '10min' }
        ], note: '对比第2周400m基线'
      };
      if (day === 5) return {
        type: 'test', title: '复测③ 弹跳/立定跳', venue: '田径场', duration: '40min',
        warmup: '动态热身',
        main: [
          { name: '立定跳远', sets: 3, reps: '取最好' },
          { name: '原地纵跳CMJ', sets: 3, reps: '取最好' },
          { name: '上肢轻量塑形', sets: 2, reps: '推举/面拉/侧平举' }
        ], note: '测试后轻量收尾'
      };
      // day 3/6/7 落到普通恢复/可选/休息
    }
    switch (day) {
      case 1: return {
        type: 'speed', title: '速度日（飞跑+加速）', venue: '田径场', duration: '60-70min',
        warmup: '动态热身15min + 加速跑2×30m',
        main: [
          { name: '加速跑', sets: 4, reps: '30m', pace: '@95%', rest: '2-3min' },
          { name: '飞跑', sets: 4, reps: '60-80m', pace: '@95-100%', rest: '3-4min' },
          { name: '放松跑', sets: 1, reps: '慢跑5min' }
        ], note: '飞跑质量优先，组间心率回落'
      };
      case 2: return {
        type: 'lower', title: '下肢力量+背', venue: '健身房', duration: '70min',
        warmup: '髋/踝激活10min',
        main: [
          { name: '杠铃深蹲', sets: 3, reps: '3-5次', pace: '@85-90%', rest: '2-3min' },
          { name: 'RDL', sets: 3, reps: '6次', pace: '中-重' },
          { name: '保加利亚分腿蹲', sets: 3, reps: '8次/侧' },
          { name: '引体向上', sets: 4, reps: '6-10次' },
          { name: '杠铃划船', sets: 3, reps: '10次' },
          { name: '核心组合', sets: 3, reps: '各30-45s' }
        ], note: '进入大重量区间'
      };
      case 3: return {
        type: 'aerobic', title: '恢复日', venue: '操场/公园', duration: '40-50min',
        warmup: '技术drills 10min',
        main: [
          { name: 'Zone2慢跑', sets: 1, reps: '30-40min', pace: '心率120-145' },
          { name: '核心', sets: 3, reps: '各30-45s' }
        ], note: '疲劳大可全休'
      };
      case 4: return {
        type: 'speedEnd', title: '400m专项·速度耐力', venue: '田径场', duration: '60-70min',
        warmup: '动态热身15min',
        main: (week === 5 ? [
          { name: '200m', sets: 5, reps: '200m', pace: '@26-28s', rest: '休3min' },
          { name: '轻松跑', sets: 1, reps: '15-20min' }
        ] : week === 7 ? [
          { name: '300m', sets: 3, reps: '300m', pace: '@40-42s', rest: '休5min' },
          { name: '轻松跑', sets: 1, reps: '15-20min' }
        ] : [
          { name: '150m', sets: 6, reps: '150m', pace: '@19-20s', rest: '休2-3min' },
          { name: '轻松跑', sets: 1, reps: '15-20min' }
        ]), note: '贴目标配速'
      };
      case 5: return {
        type: 'jump', title: '弹跳+上肢塑形', venue: '田径场/健身房', duration: '65-75min',
        warmup: '动态热身 + 小跳',
        main: [
          { name: '跳深+跨步跳', sets: 4, reps: '共60-80次触地', pace: '中高强度', rest: '组间2-3min' },
          { name: '上斜卧推', sets: 3, reps: '8次' },
          { name: '站姿推举', sets: 3, reps: '8次' },
          { name: '面拉', sets: 3, reps: '12次' },
          { name: '侧平举', sets: 3, reps: '12次' },
          { name: '小腿提踵', sets: 3, reps: '12次' }
        ], note: '落地缓冲，膝踝不适即降档'
      };
      case 6: return {
        type: 'longAerobic', title: '可选：排球/轻松有氧', venue: '球场/操场', duration: '30-45min',
        warmup: '慢走5min',
        main: [{ name: '排球或Zone2慢跑', sets: 1, reps: '30-45min', pace: '心率120-140' }],
        note: '保持轻松'
      };
      default: return restDay();
    }
  }
  // ---------- 专项期（W9-10） ----------
  function specialDay(week, day) {
    switch (day) {
      case 1: return {
        type: 'speed', title: '速度日（起跑+全力）', venue: '田径场', duration: '65-75min',
        warmup: '动态热身15min + 起跑drills',
        main: [
          { name: '起跑练习', sets: 6, reps: '30m', pace: '全力', rest: '休2-3min' },
          { name: '飞跑', sets: 3, reps: '60-80m', pace: '@95-100%', rest: '休4min' },
          { name: '放松跑', sets: 1, reps: '慢跑5min' }
        ], note: '100m全程加速技术'
      };
      case 2: return {
        type: 'lower', title: '下肢力量（大重量保持）', venue: '健身房', duration: '65min',
        warmup: '髋/踝激活10min',
        main: [
          { name: '杠铃深蹲', sets: 3, reps: '3次', pace: '@90%', rest: '3min' },
          { name: '相扑硬拉', sets: 2, reps: '3次', pace: '@85%', rest: '3min' },
          { name: '引体向上', sets: 3, reps: '6-10次' },
          { name: '杠铃划船', sets: 3, reps: '8-10次' }
        ], note: '1-2次大重量即可，保量'
      };
      case 3: return {
        type: 'aerobic', title: '恢复日', venue: '操场/公园', duration: '35-45min',
        warmup: '技术drills 10min',
        main: [
          { name: 'Zone2慢跑', sets: 1, reps: '25-35min', pace: '心率120-140' }
        ], note: '保持松弛'
      };
      case 4: return {
        type: 'speedEnd', title: '400m比赛配速', venue: '田径场', duration: '65-75min',
        warmup: '动态热身15min',
        main: (week === 9 ? [
          { name: '300m', sets: 3, reps: '300m', pace: '@40-42s', rest: '休6-8min' },
          { name: '150m', sets: 2, reps: '150m', pace: '@19-20s', rest: '休3min' },
          { name: '轻松跑', sets: 1, reps: '15min' }
        ] : [
          { name: '500m测验', sets: 1, reps: '500m', pace: '全力计时' },
          { name: '150m', sets: 4, reps: '150m', pace: '@19-20s', rest: '休2-3min' },
          { name: '轻松跑', sets: 1, reps: '15min' }
        ]), note: '贴比赛配速'
      };
      case 5: return {
        type: 'jump', title: '弹跳峰值+上肢塑形', venue: '田径场/健身房', duration: '60-70min',
        warmup: '动态热身 + 小跳',
        main: [
          { name: '跳深+跳箱', sets: 5, reps: '共60-80次触地', pace: '峰值强度', rest: '组间2-3min' },
          { name: '上斜卧推', sets: 3, reps: '6次' },
          { name: '站姿推举', sets: 3, reps: '8次' },
          { name: '面拉', sets: 3, reps: '12次' },
          { name: '侧平举', sets: 3, reps: '12次' },
          { name: '小腿提踵', sets: 3, reps: '12次' }
        ], note: '弹跳每周1次峰值'
      };
      case 6: return {
        type: 'longAerobic', title: '可选：轻松有氧', venue: '操场/公园', duration: '30min',
        warmup: '慢走5min',
        main: [{ name: 'Zone2慢跑', sets: 1, reps: '30min', pace: '心率120-140' }],
        note: '保持轻松'
      };
      default: return restDay();
    }
  }

  // ---------- 减量周（W11） ----------
  function taperDay(day) {
    switch (day) {
      case 1: return {
        type: 'speed', title: '减量·速度', venue: '田径场', duration: '40min',
        warmup: '动态热身10min',
        main: [
          { name: '加速跑', sets: 3, reps: '30m', pace: '@90%', rest: '2min' },
          { name: '飞跑', sets: 2, reps: '60m', pace: '@95%', rest: '3min' }
        ], note: '保持感觉，不疲劳'
      };
      case 2: return {
        type: 'lower', title: '减量·轻力量', venue: '健身房', duration: '40min',
        warmup: '髋/踝激活8min',
        main: [
          { name: '杠铃深蹲', sets: 3, reps: '3次', pace: '@80%', rest: '2-3min' },
          { name: '引体向上', sets: 2, reps: '6-10次' }
        ], note: '轻量保持'
      };
      case 3: return { type: 'aerobic', title: '恢复·Zone2', venue: '操场/公园', duration: '30min', warmup: '慢走5min', main: [{ name: 'Zone2慢跑', sets: 1, reps: '20-25min', pace: '心率120-140' }], note: '很轻松' };
      case 4: return {
        type: 'speedEnd', title: '减量·短间歇', venue: '田径场', duration: '40min',
        warmup: '动态热身10min',
        main: [
          { name: '200m', sets: 3, reps: '200m', pace: '@28-30s', rest: '休3min' },
          { name: '轻松跑', sets: 1, reps: '10min' }
        ], note: '找节奏'
      };
      case 5: return {
        type: 'jump', title: '减量·弹跳+轻塑形', venue: '田径场/健身房', duration: '40min',
        warmup: '动态热身',
        main: [
          { name: '小跳+跳箱', sets: 2, reps: '共30-40次触地', pace: '低强度' },
          { name: '上肢轻量', sets: 2, reps: '推举/面拉/侧平举' }
        ], note: '保持激活'
      };
      default: return restDay();
    }
  }

  // ---------- 测验周（W12） ----------
  function finalTestDay(day) {
    switch (day) {
      case 1: return {
        type: 'test', title: '期末测试① 100m', venue: '田径场', duration: '45min',
        warmup: '动态热身15min + 2×30m加速',
        main: [
          { name: '100m', sets: 2, reps: '全力计时，取最好', rest: '组间休10min' },
          { name: '放松跑', sets: 1, reps: '10min' }
        ], note: '目标≤12.2s'
      };
      case 2: return { type: 'rest', title: '休息/轻恢复', venue: '—', duration: '30min', warmup: '', main: [{ name: '散步或拉伸', sets: 1, reps: '20-30min' }], note: '不训练' };
      case 3: return {
        type: 'test', title: '期末测试② 400m', venue: '田径场', duration: '45min',
        warmup: '动态热身15min',
        main: [
          { name: '400m', sets: 1, reps: '全力计时', note: '目标≤56s' },
          { name: '轻松跑', sets: 1, reps: '10min' }
        ], note: '赛前准备充分'
      };
      case 4: return { type: 'aerobic', title: '恢复·Zone2', venue: '操场/公园', duration: '30min', warmup: '慢走5min', main: [{ name: 'Zone2慢跑', sets: 1, reps: '20min', pace: '心率120-140' }], note: '很轻松' };
      case 5: return {
        type: 'test', title: '期末测试③ 弹跳/立定跳', venue: '田径场', duration: '40min',
        warmup: '动态热身',
        main: [
          { name: '助跑摸高', sets: 3, reps: '取最好' },
          { name: '立定跳远', sets: 3, reps: '取最好' },
          { name: '原地纵跳CMJ', sets: 3, reps: '取最好' }
        ], note: '对比基线'
      };
      case 6: return { type: 'rest', title: '总结', venue: '—', duration: '—', warmup: '', main: [], note: '总结3个月成绩，规划下一周期' };
      default: return restDay();
    }
  }

  // ---------- 教练手动覆盖（无标注，直接替换当日计划） ----------
  // 结构：日期 -> 完整 day 对象（date/week/day/dow/phase/type/title/venue/duration/warmup/main/note/sleep/sex/foods）
  const COACH_OVERRIDES = {
    // '2026-08-25': { type: 'speed', title: '速度日（调整）', venue: '田径场', duration: '50min', warmup: '...', main: [{ name: '...', sets: 1, reps: '...', pace: '...', rest: '...' }], note: '...' }
  };

  function sexRule(week, day, type) {
    if (week === 12) return { allowed: false, reason: '测验周禁欲' };
    if (week === 11 && day >= 6) return { allowed: false, reason: '测试前48h禁欲' };
    if (day === 3 || day === 6 || day === 7) return { allowed: true, reason: '周三/周六/周日为恢复或休息日' };
    return { allowed: false, reason: '训练日禁欲' };
  }

  function foodsFor(type, isStrength) {
    const p = PROTEIN;
    if (type === 'rest') {
      return [
        { when: '全天', items: '番茄、猕猴桃、核桃、石榴、蓝莓' },
        { when: '晚餐', items: '正常蛋白质餐 + 一小把坚果' }
      ];
    }
    if (type === 'aerobic' || type === 'longAerobic') {
      return [
        { when: '练前1h', items: '香蕉1根' },
        { when: '练后30min', items: '牛奶/酸奶 + 核桃' },
        { when: '晚餐', items: '石榴/猕猴桃 + 蓝莓 + 蛋白质' }
      ];
    }
    if (type === 'test') {
      return [
        { when: '测试前1.5h', items: '香蕉1根 + 燕麦粥（少量）' },
        { when: '测试后30min', items: '西瓜/橙汁 + 牛奶/鸡蛋' },
        { when: '晚餐', items: '蓝莓/番茄 + 鱼/鸡胸 + 米饭' }
      ];
    }
    const foods = [
      { when: '练前1h', items: '香蕉1根 + 燕麦粥/全麦面包' },
      { when: '练后30min', items: '西瓜/橙子 + 牛奶/鸡蛋' },
      { when: '晚餐', items: '蓝莓/番茄 + 瘦肉/鱼/豆制品' }
    ];
    if (isStrength) foods.push({ when: '全天', items: p });
    return foods;
  }

  function buildDay(week, day) {
    const date = addDays(PROGRAM_START, (week - 1) * 7 + (day - 1));
    // 模板按“星期几”匹配：周一=1 ... 周日=7
    const dowNum = ((parseDate(date).getDay() + 6) % 7) + 1;
    let tmpl;
    if (week === 12) tmpl = finalTestDay(dowNum);
    else if (week === 11) tmpl = taperDay(dowNum);
    else if (week === 1) tmpl = testWeekDay(dowNum);
    else if (week <= 4) tmpl = rebuildDay(week, dowNum);
    else if (week <= 8) tmpl = capabilityDay(week, dowNum);
    else tmpl = specialDay(week, dowNum);

    const isStrength = tmpl.type === 'lower' || tmpl.type === 'upper';
    const sex = sexRule(week, dowNum, tmpl.type);
    return {
      date: date,
      week: week,
      day: day,
      dow: DOW[dowNum - 1],
      phase: phaseForWeek(week),
      type: tmpl.type,
      title: tmpl.title,
      venue: tmpl.venue,
      duration: tmpl.duration,
      warmup: tmpl.warmup,
      main: tmpl.main,
      note: tmpl.note,
      sleep: COMMON_SLEEP,
      sex: sex,
      foods: foodsFor(tmpl.type, isStrength)
    };
  }

  const weeks = [];
  for (let w = 1; w <= TOTAL_WEEKS; w++) {
    const week = { week: w, phase: phaseForWeek(w), days: [] };
    for (let d = 1; d <= 7; d++) week.days.push(buildDay(w, d));
    weeks.push(week);
  }

  const PLAN = {
    programStart: PROGRAM_START,
    totalWeeks: TOTAL_WEEKS,
    phases: PHASES,
    sexWeeklyLimit: 3,
    sleepRule: COMMON_SLEEP,
    alcoholRule: '酒精=0（含药酒）；推不掉时每周≤1杯且不在训练日前后',
    weeks: weeks,
    goals: {
      '100m': { base: 12.8, target: 12.2, unit: 's' },
      '400m': { base: 60, target: 56, unit: 's' },
      '助跑摸高': { base: 295, target: 308, unit: 'cm' },
      '立定跳远': { base: 270, target: 290, unit: 'cm' },
      '深蹲': { base: 105, target: 120, unit: 'kg' },
      '相扑硬拉': { base: 130, target: 150, unit: 'kg' }
    }
  };

  if (typeof window !== 'undefined') { window.PLAN = PLAN; window.COACH_OVERRIDES = COACH_OVERRIDES; }
  if (typeof module !== 'undefined' && module.exports) module.exports = PLAN;
})();
