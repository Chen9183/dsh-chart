/**
 * dsh-chart —— 图表插件（宿主半侧）
 *
 * 三件事：
 *  1) 往系统提示词里注入一句「能画图」的短提示 —— 详细的 mermaid 格式、模板和
 *     自检清单放在技能 chart（/.dsh/skills/chart/SKILL.md）里，模型要画时才加载，
 *     系统提示词只留指针，省常驻上下文；
 *  2) 作为 bundle 入口模块被加载，让 DSH 把这个包扫描成浏览器插件，
 *     提供 /plugins/dsh-chart/client.js 与 /plugins/dsh-chart/assets/*；
 *  3) 提供图表渲染缓存（磁盘文件夹），客户端画完一张图就存进来，页面重开时
 *     直接从缓存取，不用再跑一遍 mermaid。缓存目录在插件被卸载/停用时删掉。
 *
 * 缓存目录：$DSH_HOME/cache/dsh-chart/（默认 /.dsh/cache/dsh-chart/）
 * 接口：
 *   GET    /dsh-chart-cache/<key>   取一张图的 svg（404 = 没有）
 *   POST   /dsh-chart-cache/<key>   存一张图的 svg（body 就是 svg 文本）
 *   POST   /dsh-chart-cache/clear   清空整个缓存目录
 */

import { mkdir, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import { constants as zlibConstants, deflateRawSync, inflateRawSync, zstdCompressSync, zstdDecompressSync } from 'node:zlib';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const name = 'dsh-chart';
export const inject = ['systemPrompt'];

const FENCE = '```';

// 系统提示词只放最短的指针；格式细节全在技能 chart 里（不在这里重复）。
const USAGE = [
  '【图表输出规范】可以在回复里用 ' + FENCE + 'mermaid 代码块画图，页面会渲染成图表卡片。',
  '- 一张图一个代码块；代码块最后一行单独写 %%，缺了这块不渲染。',
  '- 动手写之前先加载技能 chart（skill 工具，name=chart），照里面的模板抄，发出前按自检清单核对。',
  '- 用户说图表残缺/没画出来/画得不对时，让他直接在输入框敲 /rechart 刷新（客户端命令，不消耗 token、不产生对话）；想连缓存一起清就敲 /rechart-clear。不要让他写任何标记，也不要自己重发图表。',
].join('\n');

const ROUTE = '/dsh-chart-cache';   // 不用 /plugins/ 前缀，免得跟 client-modules 的路由打架
// 缓存文件后缀：svg 是纯文本，zstd 压完只有一成多，落盘更省
const EXT = '.json.zst';
const LEGACY_EXT = '.json';
const MAX_BODY = 4 * 1024 * 1024; // 单张图的 svg 上限，防止被灌大包
const KEY_RE = /^[a-z0-9]{6,64}$/;

/** 缓存目录：跟着 DSH_HOME 走，默认 /.dsh/cache/dsh-chart */
export function cacheDir() {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh');
  return join(home, 'cache', 'dsh-chart');
}

// zstd 优先（Node 22+ 自带）；老 Node 退回 deflateRaw，不能再退就原样存
const HAS_ZSTD = typeof zstdCompressSync === 'function';

function compressText(text) {
  const buf = Buffer.from(text, 'utf8');
  if (HAS_ZSTD) return zstdCompressSync(buf, { params: { [zlibConstants.ZSTD_c_compressionLevel]: 3 } });
  try { return deflateRawSync(buf); } catch (e) { return buf; }
}

function decompressText(buf) {
  if (HAS_ZSTD) return zstdDecompressSync(buf).toString('utf8');
  try { return inflateRawSync(buf).toString('utf8'); } catch (e) { return buf.toString('utf8'); }
}

async function ensureDir() {
  const dir = cacheDir();
  await mkdir(dir, { recursive: true });
  return dir;
}

function send(res, status, body, type) {
  res.statusCode = status;
  if (type) res.setHeader('content-type', type);
  res.setHeader('cache-control', 'no-store');
  res.end(body === undefined ? '' : body);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** 清空缓存目录里的文件（保留目录本身） */
export async function clearCache() {
  const dir = cacheDir();
  let removed = 0;
  let entries = [];
  try {
    entries = await readdir(dir);
  } catch (e) {
    if (e && e.code === 'ENOENT') return removed;
    throw e;
  }
  for (const name of entries) {
    try {
      await unlink(join(dir, name));
      removed += 1;
    } catch (e) {
      /* 目录或删不掉的文件就算了 */
    }
  }
  return removed;
}

/** 把缓存路由挂到 web 服务上；返回 disposer */
function serveCache(ctx) {
  const webServer = ctx.webServer;
  if (!webServer || typeof webServer.register !== 'function') return null;

  const disposers = [];
  disposers.push(webServer.register({
    kind: 'prefix',
    path: ROUTE,
    handler: async (req, res) => {
      const url = new URL(String(req.url || '/'), 'http://localhost');
      const rest = url.pathname.slice(ROUTE.length).replace(/^\/+/, '');
      try {
        if (rest === 'clear') {
          if (req.method !== 'POST' && req.method !== 'DELETE') {
            res.setHeader('allow', 'POST, DELETE');
            return send(res, 405, 'method not allowed');
          }
          const removed = await clearCache();
          return send(res, 200, JSON.stringify({ ok: true, removed }), 'application/json');
        }
        if (!KEY_RE.test(rest)) return send(res, 400, 'bad key');
        if (req.method === 'GET' || req.method === 'HEAD') {
          let svg;
          try {
            svg = decompressText(await readFile(join(cacheDir(), rest + EXT)));
          } catch (e) {
            try {
              svg = await readFile(join(cacheDir(), rest + LEGACY_EXT), 'utf8');   // 兼容旧的未压缩缓存
            } catch (e2) {
              return send(res, 404, 'miss');
            }
          }
          return send(res, 200, req.method === 'HEAD' ? undefined : svg, 'image/svg+xml; charset=utf-8');
        }
        if (req.method === 'POST') {
          const body = await readBody(req, MAX_BODY);
          if (!body || body.length < 40) return send(res, 400, 'empty');
          const dir = await ensureDir();
          const packed = compressText(body);
          await writeFile(join(dir, rest + EXT), packed);
          return send(res, 200, JSON.stringify({
            ok: true,
            raw: Buffer.byteLength(body),
            bytes: packed.length,
            ratio: +(packed.length / Math.max(1, Buffer.byteLength(body))).toFixed(3)
          }), 'application/json');
        }
        res.setHeader('allow', 'GET, HEAD, POST');
        return send(res, 405, 'method not allowed');
      } catch (e) {
        return send(res, 400, 'error: ' + (e && e.message ? e.message : e));
      }
    }
  }));

  return () => { for (const d of disposers) try { d(); } catch (e) {} };
}

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

  // 缓存：有 web 服务才挂路由
  try {
    ctx.inject?.(['webServer'], (scope) => {
      const dispose = serveCache(scope);
      if (!dispose) return;
      scope.effect(() => dispose, 'dsh-chart: cache routes');
      scope.logger?.info?.('[dsh-chart] 图表缓存目录: ' + cacheDir());
    });
  } catch (e) {
    ctx?.logger?.warn?.('[dsh-chart] 挂载缓存路由失败: ' + (e && e.message ? e.message : e));
  }

  // 插件卸载/停用/重载时，把缓存文件夹一起删掉
  try {
    ctx.effect(() => () => {
      rm(cacheDir(), { recursive: true, force: true }).catch(() => {});
    }, 'dsh-chart: 卸载时清理缓存目录');
  } catch (e) {
    ctx?.logger?.warn?.('[dsh-chart] 注册缓存清理失败: ' + (e && e.message ? e.message : e));
  }
}
