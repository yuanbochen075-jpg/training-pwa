/**
 * plan-data.js — 24周训练计划数据（由模板生成，完整 168 天）
 * 规则来源：已确认的6个月综合训练方案
 */
(function () {
  'use strict';

  const PROGRAM_START = '2026-08-22'; // 周六起算，模板按星期几匹配（周一时间不变）
  const TOTAL_WEEKS = 24;

  const PHASES = ['适应期', '基础重建', '力量爆发', '专项强化', '峰值减量'];

  function phaseForWeek(w) {
    if (w <= 2) return PHASES[0];
    if (w <= 8) return PHASES[1];
    if (w <= 16) return PHASES[2];
    if (w <= 20) return PHASES[3];
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

  const COMMON_SLEEP = { bedtime: '23:00', wake: '07:00', hours: '7.5-8h', nap: '午休≤20min' };
  const PROTEIN = '蛋白质110-135g/天：鸡蛋、鸡胸、鱼、豆制品、牛奶';

  // ---------- 各阶段每日模板 ----------
  function adaptDay(day) {
    switch (day) {
      case 1: return {
        type: 'speed', title: '速度日（田径场）', venue: '操场', duration: '45-55min',
        warmup: '动态热身15min + A/B skip 3×20m',
        main: [
          { name: '加速跑', detail: '6×30m @80-90%，组间2-3min，重点练起跑姿势' },
          { name: '跳深', detail: '3×4次，箱高30cm，落地缓冲' },
          { name: '放松跑', detail: '慢跑5min + 拉伸' }
        ], note: '以技术为主，不追求速度极限'
      };
      case 2: return {
        type: 'lower', title: '下肢力量（健身房）', venue: '健身房', duration: '60-70min',
        warmup: '髋/踝激活10min',
        main: [
          { name: '杠铃深蹲', detail: '3×8 @60-70kg，全程控制' },
          { name: '相扑硬拉', detail: '3×8 @100-110kg' },
          { name: '保加利亚分腿蹲', detail: '2×8每侧' },
          { name: '提踵', detail: '3×12' },
          { name: '悬垂举腿', detail: '3×8' },
          { name: '盆底肌', detail: '10次快缩 + 3×10秒保持' }
        ], note: '轻重量找动作模式'
      };
      case 3: return {
        type: 'aerobic', title: 'Zone2 有氧恢复', venue: '操场/公园', duration: '45-55min',
        warmup: '慢走5min',
        main: [
          { name: 'Zone2慢跑', detail: '30-40min，心率120-145' },
          { name: '灵活性', detail: '髋/踝/肩各15min' },
          { name: '盆底肌', detail: '10次快缩 + 3×10秒保持' }
        ], note: '能边跑边说话'
      };
      case 4: return {
        type: 'upper', title: '上肢/倒三角（健身房）', venue: '健身房', duration: '55-65min',
        warmup: '肩袖激活10min',
        main: [
          { name: '引体向上（或高位下拉）', detail: '3×6-10' },
          { name: '杠铃划船', detail: '3×8-10' },
          { name: '站姿推举', detail: '3×8' },
          { name: '侧平举', detail: '3×12-15' },
          { name: '面拉', detail: '2×15' },
          { name: '平板支撑', detail: '3×30s' }
        ], note: '肩背为主，胸/手臂保持量'
      };
      case 5: return {
        type: 'speedEnd', title: '速度耐力（田径场）', venue: '操场', duration: '50-60min',
        warmup: '动态热身15min',
        main: [
          { name: '加速跑', detail: '4×60m @85%，组间3min' },
          { name: '150m', detail: '2×150m @85%，组间4-5min' },
          { name: '放松跑', detail: '慢跑5min' }
        ], note: '别硬冲，找节奏'
      };
      case 6: return {
        type: 'longAerobic', title: '长有氧（可换排球）', venue: '操场/球场', duration: '45-60min',
        warmup: '慢走5min',
        main: [
          { name: 'Zone2慢跑', detail: '45min，心率120-145；如打排球则1-2局替代' },
          { name: '盆底肌', detail: '10次快缩 + 3×10秒保持' }
        ], note: '保持轻松'
      };
      default: return { type: 'rest', title: '完全休息', venue: '—', duration: '—', warmup: '', main: [], note: '不安排训练，睡够8h' };
    }
  }

  function baseDay(day) {
    switch (day) {
      case 1: return {
        type: 'speed', title: '速度日（田径场）', venue: '操场', duration: '55-65min',
        warmup: '动态热身15min + A/B skip 3×20m',
        main: [
          { name: '加速跑', detail: '6×40m @90%，组间3min' },
          { name: '跳深', detail: '3×5次，箱高35cm' },
          { name: '放松跑', detail: '慢跑5min' }
        ], note: '每次都要用最大速度的90%+'
      };
      case 2: return {
        type: 'lower', title: '下肢力量（健身房）', venue: '健身房', duration: '70-80min',
        warmup: '髋/踝激活10min',
        main: [
          { name: '杠铃深蹲', detail: '5×5，每周+2.5-5kg，动作标准优先' },
          { name: '相扑硬拉', detail: '4×5' },
          { name: '保加利亚分腿蹲', detail: '3×8每侧' },
          { name: '提踵', detail: '4×12' },
          { name: '悬垂举腿', detail: '3×10' },
          { name: '盆底肌', detail: '10次快缩 + 3×10秒保持' }
        ], note: '线性加重阶段'
      };
      case 3: return {
        type: 'aerobic', title: 'Zone2 有氧恢复', venue: '操场/公园', duration: '50-60min',
        warmup: '慢走5min',
        main: [
          { name: 'Zone2慢跑', detail: '35-45min，心率120-140' },
          { name: '灵活性', detail: '15min' },
          { name: '盆底肌', detail: '10次快缩 + 3×10秒保持' }
        ], note: '恢复日，心率不超140'
      };
      case 4: return {
        type: 'upper', title: '上肢/倒三角（健身房）', venue: '健身房', duration: '60-70min',
        warmup: '肩袖激活10min',
        main: [
          { name: '引体向上（或高位下拉）', detail: '4×6-10' },
          { name: '杠铃划船', detail: '4×8' },
          { name: '站姿推举', detail: '4×6-8' },
          { name: '侧平举', detail: '4×12-15' },
          { name: '面拉', detail: '3×15' },
          { name: '死虫', detail: '3×8' }
        ], note: '肩背厚度优先'
      };
      case 5: return {
        type: 'speedEnd', title: '速度耐力（400m专项）', venue: '操场', duration: '55-65min',
        warmup: '动态热身15min',
        main: [
          { name: '200m', detail: '2×200m @34-36s，组间4-5min' },
          { name: '100m放松跑', detail: '2×100m' },
          { name: '冷身', detail: '慢跑5min' }
        ], note: '前200m均匀配速，后段顶住'
      };
      case 6: return {
        type: 'longAerobic', title: '长有氧（可换排球）', venue: '操场/球场', duration: '50-70min',
        warmup: '慢走5min',
        main: [
          { name: 'Zone2慢跑', detail: '50-60min，心率120-140；或排球1-2局' },
          { name: '盆底肌', detail: '10次快缩 + 3×10秒保持' }
        ], note: '保持轻松'
      };
      default: return { type: 'rest', title: '完全休息', venue: '—', duration: '—', warmup: '', main: [], note: '不安排训练，睡够8h' };
    }
  }

  const SQUAT_WAVE = {
    9: '5×5 @80%', 10: '3×3 @85-90%', 11: '2×2 @90-95%', 12: 'Deload 3×5 @70%',
    13: '5×5 @80%', 14: '3×3 @85-90%', 15: '2×2 @90-95%', 16: '3×5 @75%'
  };

  function powerDay(week, day) {
    const squat = SQUAT_WAVE[week] || '5×5 @80%';
    switch (day) {
      case 1: return {
        type: 'speed', title: '速度日（田径场）', venue: '操场', duration: '60-70min',
        warmup: '动态热身15min + A/B skip',
        main: [
          { name: 'Flying 30m', detail: '6×30m 助跑冲刺，组间3min' },
          { name: '60m', detail: '3×60m 全力，组间4-5min' },
          { name: '跳深/跳箱', detail: '3×5次，箱高40-50cm' },
          { name: '冷身', detail: '慢跑5min' }
        ], note: '最大速度质量优先'
      };
      case 2: return {
        type: 'lower', title: '下肢力量（健身房）', venue: '健身房', duration: '75-85min',
        warmup: '髋/踝激活10min',
        main: [
          { name: '杠铃深蹲（波浪周）', detail: squat },
          { name: '相扑硬拉', detail: '3×3-5 @85-90%' },
          { name: '保加利亚分腿蹲', detail: '3×8每侧' },
          { name: '提踵', detail: '4×12' },
          { name: '悬垂举腿', detail: '3×10' },
          { name: '盆底肌', detail: '10次快缩 + 3×10秒保持' }
        ], note: '大重量日，组间3-5min'
      };
      case 3: return {
        type: 'aerobic', title: 'Zone2 有氧恢复', venue: '操场/公园', duration: '50-60min',
        warmup: '慢走5min',
        main: [
          { name: 'Zone2慢跑', detail: '40min，心率120-140' },
          { name: '灵活性', detail: '15min' },
          { name: '盆底肌', detail: '10次快缩 + 3×10秒保持' }
        ], note: '恢复日'
      };
      case 4: return {
        type: 'upper', title: '上肢/倒三角（健身房）', venue: '健身房', duration: '65-75min',
        warmup: '肩袖激活10min',
        main: [
          { name: '引体向上（或负重）', detail: '5×5-8' },
          { name: '杠铃划船', detail: '4×6-8' },
          { name: '站姿推举', detail: '4×5-6' },
          { name: '侧平举', detail: '4×12-15' },
          { name: '面拉', detail: '3×15' },
          { name: '死虫', detail: '3×10' }
        ], note: '肩背厚度优先，控制体重67-70kg'
      };
      case 5: return {
        type: 'speedEnd', title: '速度耐力（400m专项）', venue: '操场', duration: '60-70min',
        warmup: '动态热身15min',
        main: [
          { name: '300m', detail: '3×300m @48-52s，组间5-6min' },
          { name: '100m放松跑', detail: '2×100m' },
          { name: '冷身', detail: '慢跑5min' }
        ], note: '乳酸耐受关键期'
      };
      case 6: return {
        type: 'longAerobic', title: '长有氧（可换排球）', venue: '操场/球场', duration: '50-70min',
        warmup: '慢走5min',
        main: [
          { name: 'Zone2慢跑', detail: '45-60min，心率120-140；或排球1-2局' },
          { name: '盆底肌', detail: '10次快缩 + 3×10秒保持' }
        ], note: '保持轻松'
      };
      default: return { type: 'rest', title: '完全休息', venue: '—', duration: '—', warmup: '', main: [], note: '不安排训练，睡够8h' };
    }
  }

  function specialDay(day) {
    switch (day) {
      case 1: return {
        type: 'speed', title: '速度日（100m专项）', venue: '操场', duration: '60-70min',
        warmup: '动态热身15min + 起跑练习',
        main: [
          { name: '30m', detail: '2×30m 全力，组间4min' },
          { name: '60m', detail: '2×60m 全力，组间5min' },
          { name: '80m', detail: '1×80m 全力' },
          { name: '跳深', detail: '3×5次，箱高40-50cm' },
          { name: '冷身', detail: '慢跑5min' }
        ], note: '组合冲刺，恢复充分'
      };
      case 2: return {
        type: 'lower', title: '下肢力量（保量）', venue: '健身房', duration: '70-80min',
        warmup: '髋/踝激活10min',
        main: [
          { name: '杠铃深蹲', detail: '3×5 @80%' },
          { name: '相扑硬拉', detail: '3×5 @85%' },
          { name: '保加利亚分腿蹲', detail: '3×8每侧' },
          { name: '提踵', detail: '3×12' },
          { name: '核心', detail: '3×10' },
          { name: '盆底肌', detail: '10次快缩 + 3×10秒保持' }
        ], note: '维持力量，不加重量'
      };
      case 3: return {
        type: 'aerobic', title: 'Zone2 有氧恢复', venue: '操场/公园', duration: '45-55min',
        warmup: '慢走5min',
        main: [
          { name: 'Zone2慢跑', detail: '35-40min，心率120-140' },
          { name: '灵活性', detail: '15min' },
          { name: '盆底肌', detail: '10次快缩 + 3×10秒保持' }
        ], note: '恢复日'
      };
      case 4: return {
        type: 'upper', title: '上肢/倒三角（保持）', venue: '健身房', duration: '60-70min',
        warmup: '肩袖激活10min',
        main: [
          { name: '引体向上', detail: '4×6-8' },
          { name: '杠铃划船', detail: '4×6-8' },
          { name: '站姿推举', detail: '4×6' },
          { name: '侧平举', detail: '4×12-15' },
          { name: '面拉', detail: '3×15' },
          { name: '平板支撑', detail: '3×45s' }
        ], note: '维持肩背围度'
      };
      case 5: return {
        type: 'speedEnd', title: '速度耐力（400m目标配速）', venue: '操场', duration: '60-70min',
        warmup: '动态热身15min',
        main: [
          { name: '400m', detail: '2×400m 目标60-62s，组间8min' },
          { name: '200m', detail: '1×200m 放松跑' },
          { name: '冷身', detail: '慢跑5min' }
        ], note: '前半程均匀，后程顶住'
      };
      case 6: return {
        type: 'longAerobic', title: '长有氧（可换排球）', venue: '操场/球场', duration: '45-60min',
        warmup: '慢走5min',
        main: [
          { name: 'Zone2慢跑', detail: '40-50min，心率120-140；或排球1-2局' },
          { name: '盆底肌', detail: '10次快缩 + 3×10秒保持' }
        ], note: '保持轻松'
      };
      default: return { type: 'rest', title: '完全休息', venue: '—', duration: '—', warmup: '', main: [], note: '不安排训练，睡够8h' };
    }
  }

  function deloadDay(day) {
    switch (day) {
      case 1: return { type: 'speed', title: '速度日（减量）', venue: '操场', duration: '40min',
        warmup: '动态热身10min', main: [
          { name: '加速跑', detail: '4×40m @85%，组间3min' },
          { name: '放松跑', detail: '慢跑5min' }
        ], note: '减量周，不冲极限' };
      case 2: return { type: 'lower', title: '下肢力量（减量）', venue: '健身房', duration: '45min',
        warmup: '激活5min', main: [
          { name: '杠铃深蹲', detail: '3×5 @70%' },
          { name: '相扑硬拉', detail: '3×5 @70%' },
          { name: '盆底肌', detail: '10次快缩 + 3×10秒保持' }
        ], note: '减量周' };
      case 3: return { type: 'aerobic', title: 'Zone2 有氧（减量）', venue: '操场/公园', duration: '40min',
        warmup: '慢走5min', main: [
          { name: 'Zone2慢跑', detail: '30min，心率120-135' }
        ], note: '减量周' };
      case 4: return { type: 'upper', title: '上肢（减量）', venue: '健身房', duration: '40min',
        warmup: '肩袖激活5min', main: [
          { name: '引体向上', detail: '3×6' },
          { name: '杠铃划船', detail: '3×8 轻' },
          { name: '侧平举', detail: '3×12' }
        ], note: '减量周' };
      case 5: return { type: 'speedEnd', title: '速度耐力（减量）', venue: '操场', duration: '40min',
        warmup: '动态热身10min', main: [
          { name: '200m', detail: '2×200m @75%，组间5min' },
          { name: '放松跑', detail: '慢跑5min' }
        ], note: '减量周，找配速感觉' };
      case 6: return { type: 'longAerobic', title: '轻松有氧', venue: '操场/公园', duration: '35min',
        warmup: '慢走5min', main: [{ name: 'Zone2慢跑', detail: '30min，心率120-135' }], note: '减量周' };
      default: return { type: 'rest', title: '完全休息', venue: '—', duration: '—', warmup: '', main: [], note: '不安排训练，睡够8h' };
    }
  }

  function testWeekDay(day) {
    switch (day) {
      case 1: return {
        type: 'test', title: '测试日①（弹跳+30m）', venue: '田径场', duration: '60min',
        warmup: '充分热身20min',
        main: [
          { name: '站立摸高', detail: '记录身高+站立摸高' },
          { name: 'CMJ', detail: '叉腰纵跳×3，取最好' },
          { name: '助跑摸高', detail: '×5，取最好' },
          { name: '立定跳远', detail: '×3，取最好' },
          { name: '30m', detail: '×2计时，取最好' }
        ], note: '测试日，前一天充分休息'
      };
      case 2: return { type: 'rest', title: '轻恢复', venue: '—', duration: '30min',
        warmup: '', main: [
          { name: 'Zone2慢跑', detail: '20-30min 很轻松' },
          { name: '盆底肌', detail: '10次快缩 + 3×10秒保持' }
        ], note: '保持肌肉松弛' };
      case 3: return {
        type: 'test', title: '测试日②（100m）', venue: '田径场', duration: '45min',
        warmup: '动态热身+2×30m加速',
        main: [
          { name: '100m', detail: '全力×2（中间休息15min），取最好' }
        ], note: '目标12.2-12.4s'
      };
      case 4: return { type: 'rest', title: '完全休息/拉伸', venue: '—', duration: '—', warmup: '', main: [], note: '不训练' };
      case 5: return {
        type: 'test', title: '测试日③（400m+1000m）', venue: '田径场', duration: '60min',
        warmup: '动态热身+2×100m加速',
        main: [
          { name: '400m', detail: '全力×1，目标≤60s' },
          { name: '1000m', detail: '休息30min后测，记录成绩（不追2:50）' }
        ], note: '先400m后1000m，间隔充足'
      };
      case 6: return { type: 'rest', title: '完全休息', venue: '—', duration: '—', warmup: '', main: [], note: '总结成绩' };
      default: return { type: 'rest', title: '完全休息', venue: '—', duration: '—', warmup: '', main: [], note: '总结成绩' };
    }
  }

  function sexRule(week, day, type) {
    if (week === 24) return { allowed: false, reason: '测试周禁欲' };
    if (week === 23 && day >= 6) return { allowed: false, reason: '测试前48h禁欲' };
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
    // 模板按“星期几”匹配：周一=1 ... 周日=7，保证周一速度日不变
    const dowNum = ((parseDate(date).getDay() + 6) % 7) + 1;
    let tmpl;
    if (week === 24) tmpl = testWeekDay(dowNum);
    else if (week === 23) tmpl = deloadDay(dowNum);
    else if (week <= 2) tmpl = adaptDay(dowNum);
    else if (week <= 8) tmpl = baseDay(dowNum);
    else if (week <= 16) tmpl = powerDay(week, dowNum);
    else tmpl = specialDay(dowNum);

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
      '100m': { base: 13.5, target: 12.3, unit: 's' },
      '400m': { base: 70, target: 60, unit: 's' },
      '纵跳提升': { base: 0, target: 15, unit: 'cm' },
      '立定跳远': { base: 0, target: 300, unit: 'cm' },
      '深蹲': { base: 80, target: 115, unit: 'kg' }
    }
  };

  if (typeof window !== 'undefined') window.PLAN = PLAN;
  if (typeof module !== 'undefined' && module.exports) module.exports = PLAN;
})();
