/**
 * dsh-chart —— 图表插件（宿主半侧）
 *
 * 两件事：
 *  1) 往系统提示词里注入一段说明，让模型知道「回复里可以用 mermaid 代码块画图」；
 *  2) 作为 bundle 入口模块被加载，让 DSH 把这个包扫描成浏览器插件，
 *     提供 /plugins/dsh-chart/client.js 与 /plugins/dsh-chart/assets/*。
 */

export const name = 'dsh-chart';
export const inject = ['systemPrompt'];

const USAGE = [
  '图表能力：你可以在回复里直接画图，写法是一个 mermaid 代码块，页面会把它渲染成图表卡片（卡片右上角可在「图表」和「表格」之间切换）。',
  '',
  '支持这些写法：',
  '- 柱状图 / 折线图（可叠加；多个 bar 自动并排分组）：',
  '```mermaid',
  'xychart-beta',
  '    title "本周使用时长"',
  '    x-axis ["周一", "周二", "周三"]',
  '    y-axis "小时" 0 --> 12',
  '    bar [3, 5, 4]',
  '    line [3, 5, 4]',
  '```',
  '- 饼图：',
  '```mermaid',
  'pie title 时间分配',
  '    "写代码" : 45',
  '    "调试" : 25',
  '```',
  '- 流程图 / 时序图 / 甘特图 / 思维导图等 mermaid 全部图类型（flowchart、sequenceDiagram、gantt、mindmap…）。',
  '',
  '注意：x-axis 的中文标签必须加引号（如 ["一月", "二月"]），否则 mermaid 语法校验不通过，会降级成兼容渲染并打上「⚠ 语法不标准」标记。',
  '能用图说明的数据（对比、趋势、占比、结构）优先画图，比纯文字更清楚。'
].join('\n');

export function apply(ctx) {
  try {
    if (ctx?.systemPrompt?.section) {
      ctx.systemPrompt.section({
        name: 'dsh-chart:usage',
        order: 3200,
        text: USAGE
      });
      ctx?.logger?.info?.('[dsh-chart] 已注入图表使用提示');
    }
  } catch (e) {
    ctx?.logger?.warn?.('[dsh-chart] 注入提示词失败: ' + (e && e.message ? e.message : e));
  }
}
