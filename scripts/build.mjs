#!/usr/bin/env node
/**
 * 把 src/chart.js（图表逻辑）+ src/vendor/mermaid.min.js（mermaid 11）
 * 打成一个 client.js —— DSH 浏览器半侧的模块文件。
 *
 * 为什么内联 mermaid：DSH 的 /plugins/<包>/assets/ 路由只服务图片
 * （svg/png/webp/jpg），不提供 js，所以 mermaid 必须内联进 client.js。
 *
 * 用法：node scripts/build.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const mermaid = await readFile(join(root, 'src/vendor/mermaid.min.js'), 'utf8');
const chart = await readFile(join(root, 'src/chart.js'), 'utf8');

const out = `window.__ModuleLoader__.load({
	id: "dsh-chart",
	factory: function (require) {
		var module = { exports: {} };
		var exports = module.exports;
		var MERMAID_SOURCE = ${JSON.stringify(mermaid)};
		try {
${chart}
		} catch (e) { console.warn('[dsh-chart] 初始化失败', e); }
		exports.name = "dsh-chart";
		exports.inject = [];
		exports.apply = function (ctx) { try { ctx && ctx.logger && ctx.logger.info && ctx.logger.info('[dsh-chart] 图表已启用'); } catch (e) {} };
		return module.exports;
	}
});
`;

await writeFile(join(root, 'client.js'), out);
console.log(`built client.js  ${out.length} bytes`);
