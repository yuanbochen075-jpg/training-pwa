/**
 * extra-data.js — 教练补录的「加练记录」
 * 与计划数据同流程：教练提交 -> GitHub Actions 自动部署 -> 用户刷新即生效（无需手动导入）
 * 结构：日期 -> { sessions: [ { title, venue, duration(分钟数), rpe(6-20), main:[{name,sets,reps,pace,rest,note}], note } ] }
 * 显示：今日页「➕ 加练记录」卡片（格式同常规训练）；统计：计入 sRPE 训练负荷/疲劳
 */
(function () {
  'use strict';
  window.EXTRA = {
    '2026-08-22': {
      sessions: [
        {
          title: '加练·自重深蹲', venue: '家', duration: 20, rpe: 12,
          main: [ { name: '自重深蹲', sets: 5, reps: '200个（不均分）' } ],
          note: '教练补录（8/22晚间，计划外自我加练）'
        }
      ]
    },
    '2026-08-23': {
      sessions: [
        {
          title: '加练·自重深蹲（午）', venue: '家', duration: 20, rpe: 12,
          main: [ { name: '自重深蹲', sets: 3, reps: '120个（均分）' } ],
          note: '教练补录（8/23中午）'
        },
        {
          title: '加练·力量+冲刺转化+有氧（晚）', venue: '健身房+田径场', duration: 130, rpe: 14,
          main: [
            { name: '杠铃深蹲', sets: 4, reps: '10次', pace: '50kg', note: '与腿弯举交替' },
            { name: '腿弯举', sets: 4, reps: '10次', pace: '20kg' },
            { name: '臀桥', sets: 3, reps: '10次', pace: '25kg' },
            { name: '臀肌后蹬器械', sets: 3, reps: '10次', pace: '70kg/侧' },
            { name: '跳深蹲+20/30m冲刺+起跑加速', sets: 1, reps: '若干组' },
            { name: '慢跑收尾', sets: 1, reps: '45min', pace: '心率150' }
          ],
          note: '教练补录（8/23晚间）；RPE≈5.5/10（6-20制=14）'
        }
      ]
    },
    '2026-08-25': {
      sessions: [
        {
          title: '上身力量（雨天替代训练）', venue: '健身房', duration: 55, rpe: 12,
          main: [
            { name: '哑铃推肩', sets: 5, reps: '10/8/6/4/2（递减）', pace: '15kg' },
            { name: '高位下拉', sets: 5, reps: '10/8/6/4/2（递减）', pace: '69kg' },
            { name: '肱三头肌动作', sets: 3, reps: '适量' },
            { name: '背部动作', sets: 3, reps: '适量' }
          ],
          note: '教练补录（8/25，因下雨未测速改练上身）；短跑计时顺延至8/26'
        }
      ]
    },
    '2026-08-27': {
      sessions: [
        {
          title: '力量·深蹲金字塔+高位下拉超级组（雨天）', venue: '健身房', duration: 80, rpe: 13,
          main: [
            { name: '高脚杯深蹲', sets: 2, reps: '20 + 15', pace: '22.5kg' },
            { name: '高位下拉（热身）', sets: 1, reps: '10', pace: '69kg' },
            { name: '俯身划船', sets: 1, reps: '10', pace: '20kg' },
            { name: '杠铃深蹲（金字塔）', sets: 7, reps: '8/6/4/2/4/6/10', pace: '50/60/70/80/70/60/50kg', note: '与高位下拉74kg交替超级组' },
            { name: '高位下拉（超级组）', sets: 7, reps: '8/8/6/6/6/6/6', pace: '74kg' },
            { name: '宽距高位下拉', sets: 1, reps: '10', pace: '180lbs' },
            { name: '拉伸+泡沫轴', sets: 1, reps: '放松' }
          ],
          note: '教练补录（8/27，大雨改练力量）；弹跳基线顺延至8/29'
        }
      ]
    }
  };
})();