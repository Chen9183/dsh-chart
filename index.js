/**
 * dsh-chart —— 图表插件（宿主半侧）
 *
 * 两件事：
 *  1) 往系统提示词里注入图表输出规范，让模型严格按 mermaid 语法画图；
 *  2) 作为 bundle 入口模块被加载，让 DSH 把这个包扫描成浏览器插件，
 *     提供 /plugins/dsh-chart/client.js 与 /plugins/dsh-chart/assets/*。
 */

export const name = 'dsh-chart';
export const inject = ['systemPrompt'];

const USAGE = `【图表输出规范】你可以在回复里用 mermaid 代码块直接画图，页面会把它渲染成图表卡片（可切换 图 / 表 / 原文）。格式必须严格照下面写，写错会渲染失败、只剩一个代码块。

1) 柱状图 / 折线图（xychart-beta）
\`\`\`mermaid
xychart-beta
    title "标题"
    x-axis ["标签A", "标签B", "标签C"]
    y-axis "单位" 0 --> 100
    bar [10, 20, 30]
    line [12, 18, 28]
\`\`\`
必须遵守：
- x-axis 的标签**一律用英文双引号包住**，包括纯数字（"2024" 也要加引号）
- y-axis 写成 "单位" 最小值 --> 最大值，--> 前后各一个空格
- bar / line 的方括号里**只能放数字**（不要引号、不要单位、不要千分位逗号）
- 可以有多个 bar（自动并排分组），bar 和 line 可同时出现

2) 饼图（pie）
\`\`\`mermaid
pie title 标题
    "分类一" : 30
    "分类二" : 70
\`\`\`
必须遵守：英文冒号 \` : \` 前后各一个空格；数值只能是数字（不要 %）。

3) 思维导图（mindmap）
\`\`\`mermaid
mindmap
  root((中心主题))
    分支一[说明文字]
      叶子节点
    分支二(说明文字)
      叶子节点
\`\`\`
必须遵守：
- 节点形状**只能用** \`()\`、\`[]\`、\`(())\` 三种
- **禁止使用花括号 { }** —— mermaid 11 的 mindmap 不支持，写了必定报错
- 层级只靠缩进（每级 2 或 4 个空格），不要用 tab
- 节点文字里含括号、冒号等符号时，整段用 \`[文字]\` 包起来

4) 流程图 / 时序图 / 甘特图 / 状态图等：按 mermaid 官方语法输出即可。

通用规则：
- 一个图一个代码块，代码块内不要写注释、不要写解释文字
- 数据必须有依据（真实统计、用户给的数据或本次任务的结果），不要编造
- 凡是"对比、趋势、占比、结构、层级"这类信息，优先用图表达，比纯文字清楚`;

export function apply(ctx) {
  try {
    if (ctx?.systemPrompt?.section) {
      ctx.systemPrompt.section({
        name: 'dsh-chart:usage',
        order: 3200,
        text: USAGE
      });
      ctx?.logger?.info?.('[dsh-chart] 已注入图表输出规范');
    }
  } catch (e) {
    ctx?.logger?.warn?.('[dsh-chart] 注入提示词失败: ' + (e && e.message ? e.message : e));
  }
}
