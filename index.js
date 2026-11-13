/**
 * dsh-chart —— 图表插件（宿主半侧）
 *
 * 两件事：
 *  1) 往系统提示词里注入一句「能画图」的短提示 —— 详细的 mermaid 格式、模板和
 *     自检清单放在技能 chart（/.dsh/skills/chart/SKILL.md）里，模型要画时才加载，
 *     系统提示词只留指针，省常驻上下文；
 *  2) 作为 bundle 入口模块被加载，让 DSH 把这个包扫描成浏览器插件，
 *     提供 /plugins/dsh-chart/client.js 与 /plugins/dsh-chart/assets/*。
 */

export const name = 'dsh-chart';
export const inject = ['systemPrompt'];

const FENCE = '```';

// 系统提示词只放最短的指针；格式细节全在技能 chart 里（不在这里重复）。
const USAGE = [
  '【图表输出规范】可以在回复里用 ' + FENCE + 'mermaid 代码块画图，页面会渲染成图表卡片。',
  '- 一张图一个代码块；代码块最后一行单独写 %%，缺了这块不渲染。',
  '- 动手写之前先加载技能 chart（skill 工具，name=chart），照里面的模板抄，发出前按自检清单核对。',
].join('\n');

export function apply(ctx) {
  try {
    if (ctx?.systemPrompt?.section) {
      ctx.systemPrompt.section({
        name: 'dsh-chart:usage',
        order: 3200,
        text: USAGE
      });
      ctx?.logger?.info?.('[dsh-chart] 已注入图表能力提示（格式详见技能 chart）');
    }
  } catch (e) {
    ctx?.logger?.warn?.('[dsh-chart] 注入提示词失败: ' + (e && e.message ? e.message : e));
  }
}
