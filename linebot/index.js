import 'dotenv/config';
import express from 'express';
import { middleware, Client } from '@line/bot-sdk';
import { createClient } from '@supabase/supabase-js';

const app = express();

/* =========================
 * ENV
 * ========================= */
const {
  PORT = 3000,
  LINE_CHANNEL_SECRET,
  LINE_CHANNEL_ACCESS_TOKEN,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GROUP_CODE = 'catch_0001',
  WAREHOUSE_CODE_DEFAULT = 'main',
} = process.env;

if (!LINE_CHANNEL_SECRET || !LINE_CHANNEL_ACCESS_TOKEN) throw new Error('Missing LINE env');
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Supabase env');

const BOT_VER = 'V2026-01-30_LEDGER_ONLY_DB_TRIGGERS_NO_NEGATIVE';

/* =========================
 * LINE
 * ========================= */
const lineConfig = {
  channelSecret: LINE_CHANNEL_SECRET,
  channelAccessToken: LINE_CHANNEL_ACCESS_TOKEN,
};
const lineClient = new Client(lineConfig);

/* =========================
 * timeouts
 * ========================= */
const SUPA_TIMEOUT_MS = 8000;
const LINE_TIMEOUT_MS = 8000;

async function fetchWithTimeout_(url, options = {}, timeoutMs = 8000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

const supabase = createClient(String(SUPABASE_URL).replace(/\/+$/, ''), SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: {
    fetch: (url, options) => fetchWithTimeout_(url, options, SUPA_TIMEOUT_MS),
  },
});

/* =========================
 * helpers
 * ========================= */
function skuKey_(s) {
  return String(s || '').trim().toLowerCase();
}
function pickNum_(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}
function pickInt_(v, fb = 0) {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : fb;
}
function getToId_(ev) {
  const s = ev?.source || {};
  return s.groupId || s.roomId || s.userId || '';
}
function getActorKey_(ev) {
  const s = ev?.source || {};
  return s.groupId || s.roomId || s.userId || 'unknown';
}
function getCreatedBy_(ev) {
  const s = ev?.source || {};
  return s.userId || s.groupId || s.roomId || 'line';
}

async function lineReplyWithTimeout_(replyToken, message) {
  const p = lineClient.replyMessage(replyToken, message);
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('LINE reply timeout')), LINE_TIMEOUT_MS));
  return Promise.race([p, timeout]);
}
async function linePushWithTimeout_(to, message) {
  const p = lineClient.pushMessage(to, message);
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('LINE push timeout')), LINE_TIMEOUT_MS));
  return Promise.race([p, timeout]);
}
async function safeReplyText_(ev, text, quickReply = undefined) {
  const to = getToId_(ev);
  try {
    if (ev.replyToken) {
      await lineReplyWithTimeout_(ev.replyToken, { type: 'text', text, ...(quickReply ? { quickReply } : {}) });
      return;
    }
  } catch (e) {
    console.error('[LINE replyMessage failed]', e?.message || e);
  }
  if (!to) return;
  try {
    await linePushWithTimeout_(to, { type: 'text', text, ...(quickReply ? { quickReply } : {}) });
  } catch (e2) {
    console.error('[LINE pushMessage failed]', e2?.message || e2);
  }
}

function tpeTodayDate_() {
  // 方案A：用台北「當天日期」當作 biz_date 參數（DB 內仍以 05:00 做分界）
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function getSupabaseHost_() {
  try {
    return new URL(SUPABASE_URL).host;
  } catch {
    return String(SUPABASE_URL || '');
  }
}
const SUPA_HOST = getSupabaseHost_();

/* =========================
 * caches
 * ========================= */
const PRODUCT_CACHE = new Map(); // sku -> { name, unitsPerBox, ts }
const PRODUCT_TTL_MS = 10 * 60 * 1000;

async function getProductInfo_(sku) {
  const s = skuKey_(sku);
  if (!s) return { sku: '', name: '', unitsPerBox: 0 };

  const cached = PRODUCT_CACHE.get(s);
  if (cached && Date.now() - cached.ts < PRODUCT_TTL_MS) {
    return { sku: s, name: cached.name, unitsPerBox: cached.unitsPerBox };
  }

  const { data, error } = await supabase
    .from('products')
    .select('product_sku, product_name, units_per_box')
    .eq('product_sku', s)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[getProductInfo_ WARN]', error?.message || error);
    return { sku: s, name: s, unitsPerBox: 0 };
  }

  const name = String(data?.product_name || s).trim();
  const unitsPerBox = pickInt_(data?.units_per_box ?? 0, 0);

  PRODUCT_CACHE.set(s, { name, unitsPerBox, ts: Date.now() });
  return { sku: s, name, unitsPerBox };
}

/* =========================
 * RPC: stock snapshot (ledger+closings model)
 * ========================= */
async function rpcGetBusinessDayStock_(groupCode, bizDate) {
  const { data, error } = await supabase.rpc('get_business_day_stock', {
    p_group: String(groupCode || '').trim().toLowerCase(),
    p_biz_date: bizDate, // 'YYYY-MM-DD'
  });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function resolveWarehouseLabel_(rowOrCode) {
  const code = typeof rowOrCode === 'string' ? rowOrCode : String(rowOrCode?.warehouse_code || '');
  const k = String(code || '').trim().toLowerCase();
  if (k === 'main') return '總倉';
  if (k === 'withdraw') return '撤台';
  if (k === 'swap') return '夾換品';
  if (k) return k;
  return '未指定';
}

function buildQuickReplyWarehouses_(sku, rows) {
  // rows: [{warehouse_code, warehouse_name, box, piece}]
  return {
    items: rows.slice(0, 12).map((r) => {
      const code = String(r.warehouse_code || '').trim().toLowerCase();
      const label = String(r.warehouse_name || resolveWarehouseLabel_(code)).trim();
      const box = pickNum_(r.box ?? 0, 0);
      const piece = pickNum_(r.piece ?? 0, 0);
      return {
        type: 'action',
        action: {
          type: 'postback',
          label: `${label}（${box}箱/${piece}件）`.slice(0, 20),
          data: `a=wh_select&sku=${encodeURIComponent(sku)}&wh=${encodeURIComponent(code)}`,
          displayText: `倉 ${label}`,
        },
      };
    }),
  };
}

function buildQuickReplyWarehousesForOut_(sku, outBox, outPiece, rows) {
  return {
    items: rows.slice(0, 12).map((r) => {
      const code = String(r.warehouse_code || '').trim().toLowerCase();
      const label = String(r.warehouse_name || resolveWarehouseLabel_(code)).trim();
      const box = pickNum_(r.box ?? 0, 0);
      const piece = pickNum_(r.piece ?? 0, 0);
      return {
        type: 'action',
        action: {
          type: 'postback',
          label: `${label}（${box}箱/${piece}件）`.slice(0, 20),
          data: `a=out&sku=${encodeURIComponent(sku)}&wh=${encodeURIComponent(code)}&box=${outBox}&piece=${outPiece}`,
          displayText: `出 ${outBox > 0 ? `${outBox}箱 ` : ''}${outPiece > 0 ? `${outPiece}件 ` : ''}@${label}`.trim(),
        },
      };
    }),
  };
}

/* =========================
 * DB write: insert inventory_ledger
 * - DB triggers will:
 *   1) fill unit_cost_piece (>0)
 *   2) compute out_amount
 *   3) reject negative stock (LINE_OUTBOUND / BOX2PIECE)
 * ========================= */
async function insertLineOutboundLedger_({ groupCode, sku, wh, outBox, outPiece, createdAtIso }) {
  const payload = {
    group_code: String(groupCode || '').trim().toLowerCase(),
    warehouse_code: String(wh || '').trim().toLowerCase(),
    product_sku: skuKey_(sku),
    in_box: 0,
    in_piece: 0,
    out_box: Number(outBox || 0),
    out_piece: Number(outPiece || 0),
    unit_cost_piece: null, // let DB fill
    in_amount: 0,
    out_amount: null, // let DB fill
    source: 'LINE_OUTBOUND',
    created_at: createdAtIso ? new Date(createdAtIso).toISOString() : new Date().toISOString(),
  };

  const { data, error } = await supabase.from('inventory_ledger').insert(payload).select('id, out_amount, unit_cost_piece').limit(1);
  if (error) throw error;
  const row = Array.isArray(data) && data.length ? data[0] : null;
  return row || null;
}

/* =========================
 * simple caches for last sku/wh
 * ========================= */
const LAST_SKU_BY_ACTOR = new Map();
const LAST_WH_BY_ACTOR = new Map();

function setLastSku_(actorKey, sku) {
  if (!actorKey) return;
  LAST_SKU_BY_ACTOR.set(actorKey, skuKey_(sku));
}
function getLastSku_(actorKey) {
  return skuKey_(LAST_SKU_BY_ACTOR.get(actorKey) || '');
}
function setLastWh_(actorKey, whCode) {
  if (!actorKey) return;
  LAST_WH_BY_ACTOR.set(actorKey, String(whCode || '').trim().toLowerCase() || '');
}
function getLastWh_(actorKey) {
  return String(LAST_WH_BY_ACTOR.get(actorKey) || '').trim().toLowerCase() || '';
}

/* =========================
 * dedup (optional): if table missing, allow continue
 * ========================= */
async function acquireEventDedup_(eventId, ev) {
  const id = String(eventId || '').trim();
  if (!id) return true;

  const payload = {
    event_id: id,
    group_code: String(GROUP_CODE || '').trim().toLowerCase(),
    line_user_id: ev?.source?.userId || null,
    event_type: ev?.type || null,
  };

  const { error } = await supabase.from('line_event_dedup').insert(payload);

  if (!error) return true;

  // duplicated
  if (String(error.code) === '23505') {
    console.log('[DEDUP] duplicated event_id => skip', id);
    return false;
  }

  // table missing / schema mismatch -> allow continue
  console.warn('[DEDUP WARN] bypass:', error?.message || error);
  return true;
}

/* =========================
 * command parser
 * - 查 <關鍵字>
 * - 編號 <sku> / #<sku>
 * - 出3箱2件 / 出3箱 / 出2件 / 出2
 * - 倉 <總倉/撤台/夾換品/main/withdraw/swap>
 * ========================= */
function parseCommand(text) {
  const t = String(text || '').trim();
  if (!t) return null;

  if (/^(db|DB|版本)$/.test(t)) return { type: 'db' };

  const mWhSel = t.match(/^倉(?:庫)?\s*(.+)$/);
  if (mWhSel) return { type: 'wh_select', warehouse: mWhSel[1].trim() };

  const mSkuHash = t.match(/^#\s*(.+)$/);
  if (mSkuHash) return { type: 'sku', sku: mSkuHash[1].trim() };

  const mSku = t.match(/^編號[:：]?\s*(.+)$/);
  if (mSku) return { type: 'sku', sku: mSku[1].trim() };

  const mQuery = t.match(/^查(?:詢)?\s*(.+)$/);
  if (mQuery) return { type: 'query', keyword: mQuery[1].trim() };

  const mOut = t.match(/^(出庫|出)\s*(?:(\d+)\s*箱)?\s*(?:(\d+)\s*(?:個|散|件))?\s*(?:(\d+))?(?:\s*(?:@|（?\(?倉庫[:：=]\s*)([^)）]+)\)?)?\s*$/);
  if (mOut) {
    const box = mOut[2] ? parseInt(mOut[2], 10) : 0;
    const pieceLabeled = mOut[3] ? parseInt(mOut[3], 10) : 0;
    const pieceTail = mOut[4] ? parseInt(mOut[4], 10) : 0;

    const rawHasDigit = /\d+/.test(t);
    const hasUnit = /箱|個|散|件/.test(t);

    const piece =
      pieceLabeled ||
      pieceTail ||
      (!hasUnit && rawHasDigit && box === 0 ? parseInt(t.replace(/[^\d]/g, ''), 10) || 0 : 0);

    const warehouse = (mOut[5] || '').trim();

    return { type: 'out', box, piece, warehouse: warehouse || null };
  }

  return null;
}

function parsePostback(data) {
  const s = String(data || '').trim();
  if (!s) return null;
  const params = new URLSearchParams(s);
  const a = params.get('a');
  if (a === 'wh_select') {
    return { type: 'wh_select', sku: skuKey_(params.get('sku')), wh: String(params.get('wh') || '').trim().toLowerCase() };
  }
  if (a === 'out') {
    return {
      type: 'out',
      sku: skuKey_(params.get('sku')),
      wh: String(params.get('wh') || '').trim().toLowerCase(),
      box: parseInt(params.get('box') || '0', 10) || 0,
      piece: parseInt(params.get('piece') || '0', 10) || 0,
    };
  }
  return null;
}

function warehouseCodeFromText_(s) {
  const raw = String(s || '').trim();
  if (!raw) return '';
  const low = raw.toLowerCase();
  if (/^[a-z0-9_]+$/i.test(low)) {
    if (low === 'main_warehouse') return 'main';
    return low;
  }
  if (raw === '總倉') return 'main';
  if (raw === '撤台') return 'withdraw';
  if (raw === '夾換品') return 'swap';
  return '';
}

/* =========================
 * flows
 * ========================= */
async function handleSku_(ev, sku) {
  const actorKey = getActorKey_(ev);
  const s = skuKey_(sku);
  if (!s) return;

  setLastSku_(actorKey, s);

  const bizDate = tpeTodayDate_();
  let rows = [];
  try {
    rows = await rpcGetBusinessDayStock_(GROUP_CODE, bizDate);
  } catch (e) {
    console.error('[get_business_day_stock error]', e);
    await safeReplyText_(ev, `查庫存失敗：${e?.message || '未知錯誤'}`);
    return;
  }

  const skuRows = rows.filter((r) => skuKey_(r.product_sku) === s);
  if (!skuRows.length) {
    await safeReplyText_(ev, `找不到庫存：${s}`);
    return;
  }

  // 多倉就給選倉 quick reply
  if (skuRows.length >= 2) {
    await safeReplyText_(ev, `編號：${s}\n👉請選擇倉庫`, buildQuickReplyWarehouses_(s, skuRows));
    return;
  }

  const one = skuRows[0];
  const wh = String(one.warehouse_code || '').trim().toLowerCase() || WAREHOUSE_CODE_DEFAULT;
  setLastWh_(actorKey, wh);

  const p = await getProductInfo_(s);

  const label = String(one.warehouse_name || resolveWarehouseLabel_(wh)).trim();
  const box = pickNum_(one.box ?? 0, 0);
  const piece = pickNum_(one.piece ?? 0, 0);
  const unitCost = pickNum_(one.amount ?? 0, 0) && (box !== 0 || piece !== 0) ? null : null; // 不在這裡反推單價（鐵律：不反推）
  // 直接回覆：庫存數量即可（單價/金額由試算表看）
  await safeReplyText_(ev, `名稱：${p.name}\n編號：${s}\n箱入數：${p.unitsPerBox || '-'}\n倉庫：${label}\n庫存：${box}箱${piece}件`);
}

async function handleQuery_(ev, keywordRaw) {
  const kw = String(keywordRaw || '').trim().toLowerCase();
  if (!kw) return;

  const bizDate = tpeTodayDate_();
  let rows = [];
  try {
    rows = await rpcGetBusinessDayStock_(GROUP_CODE, bizDate);
  } catch (e) {
    console.error('[get_business_day_stock error]', e);
    await safeReplyText_(ev, `查庫存失敗：${e?.message || '未知錯誤'}`);
    return;
  }

  // 用「今日有庫存」的 sku 集合做搜尋（避免全 products 掃描）
  const skuSet = new Set(rows.map((r) => skuKey_(r.product_sku)).filter(Boolean));
  const skus = Array.from(skuSet);

  const hits = [];
  for (const s of skus) {
    if (s.includes(kw)) {
      const p = await getProductInfo_(s);
      hits.push({ sku: s, name: p.name || s });
      if (hits.length >= 10) break;
      continue;
    }
    const p = await getProductInfo_(s);
    if (String(p.name || '').toLowerCase().includes(kw)) {
      hits.push({ sku: s, name: p.name || s });
      if (hits.length >= 10) break;
    }
  }

  if (!hits.length) {
    await safeReplyText_(ev, `無此商品庫存\n關鍵字：${keywordRaw}`);
    return;
  }

  if (hits.length === 1) {
    await handleSku_(ev, hits[0].sku);
    return;
  }

  const quickReply = {
    items: hits.slice(0, 12).map((p) => ({
      type: 'action',
      action: { type: 'message', label: `${p.name || p.sku}`.slice(0, 20), text: `編號 ${p.sku}` },
    })),
  };
  await safeReplyText_(ev, `找到以下品項（只含今日有庫存）`, quickReply);
}

async function handleOut_(ev, { sku, whCode, outBox, outPiece }) {
  const actorKey = getActorKey_(ev);
  const createdBy = getCreatedBy_(ev);

  const s = skuKey_(sku);
  if (!s) {
    await safeReplyText_(ev, '請先用「編號 a564」選定商品');
    return;
  }

  if ((outBox || 0) === 0 && (outPiece || 0) === 0) {
    await safeReplyText_(ev, '指令格式：出3箱2件 / 出3箱 / 出2件（出2 視為 2件）');
    return;
  }

  // 倉庫：優先使用指定，否則用 last，否則用 default
  let wh = String(whCode || '').trim().toLowerCase();
  if (!wh) wh = getLastWh_(actorKey) || String(WAREHOUSE_CODE_DEFAULT || 'main').trim().toLowerCase() || 'main';

  // 先查一次當前庫存（用 RPC），多倉時驗證倉是否存在
  const bizDate = tpeTodayDate_();
  let rows = [];
  try {
    rows = await rpcGetBusinessDayStock_(GROUP_CODE, bizDate);
  } catch (e) {
    console.error('[get_business_day_stock error]', e);
    await safeReplyText_(ev, `查庫存失敗：${e?.message || '未知錯誤'}`);
    return;
  }

  const skuRows = rows.filter((r) => skuKey_(r.product_sku) === s);
  if (!skuRows.length) {
    await safeReplyText_(ev, `找不到庫存：${s}`);
    return;
  }

  // 若沒指定倉、且多倉 -> 先叫他選
  if (!whCode && skuRows.length >= 2) {
    await safeReplyText_(ev, `編號：${s}\n👉請選擇要出庫的倉庫`, buildQuickReplyWarehousesForOut_(s, outBox, outPiece, skuRows));
    return;
  }

  // 如果指定倉但不在清單，就 fallback default
  if (!skuRows.some((r) => String(r.warehouse_code || '').trim().toLowerCase() === wh)) {
    wh = String(WAREHOUSE_CODE_DEFAULT || 'main').trim().toLowerCase() || 'main';
  }

  const atIso = new Date().toISOString();

  try {
    // 核心：只 insert ledger，DB 會補單價/算金額/擋負數
    await insertLineOutboundLedger_({
      groupCode: GROUP_CODE,
      sku: s,
      wh,
      outBox,
      outPiece,
      createdAtIso: atIso,
      createdBy,
    });
  } catch (e) {
    const msg = String(e?.message || e || '');
    // DB trigger 的錯誤字串會直接帶 INSUFFICIENT_*，把它翻成中文
    if (msg.includes('INSUFFICIENT_BOX')) {
      await safeReplyText_(ev, `庫存不足：箱數不夠\n（系統已擋下，不會扣成負數）`);
      return;
    }
    if (msg.includes('INSUFFICIENT_PIECE')) {
      await safeReplyText_(ev, `庫存不足：件數不夠\n（系統已擋下，不會扣成負數）`);
      return;
    }
    if (msg.includes('unit_cost_piece missing')) {
      await safeReplyText_(ev, `單價缺失：請先入庫建立成本（unit_cost_piece）`);
      return;
    }
    console.error('[insert inventory_ledger error]', e);
    await safeReplyText_(ev, `出庫失敗：${msg.slice(0, 200)}`);
    return;
  }

  // 出庫後再查一次庫存回覆（確保一致）
  let rowsAfter = [];
  try {
    rowsAfter = await rpcGetBusinessDayStock_(GROUP_CODE, bizDate);
  } catch {
    rowsAfter = rows;
  }

  const one = rowsAfter.find(
    (r) => skuKey_(r.product_sku) === s && String(r.warehouse_code || '').trim().toLowerCase() === wh,
  );
  const label = one ? String(one.warehouse_name || resolveWarehouseLabel_(wh)).trim() : resolveWarehouseLabel_(wh);
  const box = one ? pickNum_(one.box ?? 0, 0) : 0;
  const piece = one ? pickNum_(one.piece ?? 0, 0) : 0;

  setLastSku_(actorKey, s);
  setLastWh_(actorKey, wh);

  await safeReplyText_(ev, `✅ 出庫成功\n編號：${s}\n倉庫：${label}\n出庫：${outBox}箱 ${outPiece}件\n👉目前庫存：${box}箱${piece}件`);
}

/* =========================
 * event handling
 * ========================= */
async function handleEvent_(ev) {
  const eventId = ev.webhookEventId || ev?.deliveryContext?.eventId || '';
  const ok = await acquireEventDedup_(eventId, ev);
  if (!ok) return;

  // postback
  if (ev.type === 'postback') {
    const pb = parsePostback(ev?.postback?.data);
    if (!pb) return;

    const actorKey = getActorKey_(ev);

    if (pb.type === 'wh_select') {
      const sku = pb.sku || getLastSku_(actorKey);
      if (!sku) {
        await safeReplyText_(ev, '請先用「查 xxx」或「編號 a564」選定商品，再選倉庫');
        return;
      }
      setLastSku_(actorKey, sku);
      setLastWh_(actorKey, pb.wh);

      // 回覆該倉庫的庫存
      const bizDate = tpeTodayDate_();
      let rows = [];
      try {
        rows = await rpcGetBusinessDayStock_(GROUP_CODE, bizDate);
      } catch (e) {
        await safeReplyText_(ev, `查庫存失敗：${e?.message || '未知錯誤'}`);
        return;
      }
      const one = rows.find(
        (r) => skuKey_(r.product_sku) === skuKey_(sku) && String(r.warehouse_code || '').trim().toLowerCase() === pb.wh,
      );
      const p = await getProductInfo_(sku);
      if (!one) {
        await safeReplyText_(ev, `找不到庫存：${sku}`);
        return;
      }
      const label = String(one.warehouse_name || resolveWarehouseLabel_(pb.wh)).trim();
      const box = pickNum_(one.box ?? 0, 0);
      const piece = pickNum_(one.piece ?? 0, 0);
      await safeReplyText_(ev, `名稱：${p.name}\n編號：${sku}\n箱入數：${p.unitsPerBox || '-'}\n倉庫：${label}\n庫存：${box}箱${piece}件`);
      return;
    }

    if (pb.type === 'out') {
      await handleOut_(ev, { sku: pb.sku, whCode: pb.wh, outBox: pb.box, outPiece: pb.piece });
      return;
    }
  }

  // text message
  if (ev.type !== 'message' || ev.message?.type !== 'text') return;

  const text = ev.message.text || '';
  const parsed = parseCommand(text);
  if (!parsed) return;

  const actorKey = getActorKey_(ev);

  if (parsed.type === 'db') {
    await safeReplyText_(ev, `BOT=${BOT_VER}\nDB_HOST=${SUPA_HOST}\nTPE_DATE=${tpeTodayDate_()}\nGROUP=${String(GROUP_CODE || '').trim().toLowerCase()}`);
    return;
  }

  if (parsed.type === 'query') {
    await handleQuery_(ev, parsed.keyword);
    return;
  }

  if (parsed.type === 'sku') {
    await handleSku_(ev, parsed.sku);
    return;
  }

  if (parsed.type === 'wh_select') {
    const sku = getLastSku_(actorKey);
    if (!sku) {
      await safeReplyText_(ev, '請先用「查 xxx」或「編號 a564」選定商品，再選倉庫');
      return;
    }
    const wh = warehouseCodeFromText_(parsed.warehouse) || String(WAREHOUSE_CODE_DEFAULT || 'main').trim().toLowerCase();
    setLastWh_(actorKey, wh);

    // 回覆該倉庫庫存
    const bizDate = tpeTodayDate_();
    let rows = [];
    try {
      rows = await rpcGetBusinessDayStock_(GROUP_CODE, bizDate);
    } catch (e) {
      await safeReplyText_(ev, `查庫存失敗：${e?.message || '未知錯誤'}`);
      return;
    }
    const one = rows.find(
      (r) => skuKey_(r.product_sku) === skuKey_(sku) && String(r.warehouse_code || '').trim().toLowerCase() === wh,
    );
    if (!one) {
      await safeReplyText_(ev, `找不到庫存：${sku}`);
      return;
    }
    const p = await getProductInfo_(sku);
    const label = String(one.warehouse_name || resolveWarehouseLabel_(wh)).trim();
    const box = pickNum_(one.box ?? 0, 0);
    const piece = pickNum_(one.piece ?? 0, 0);
    await safeReplyText_(ev, `名稱：${p.name}\n編號：${sku}\n箱入數：${p.unitsPerBox || '-'}\n倉庫：${label}\n庫存：${box}箱${piece}件`);
    return;
  }

  if (parsed.type === 'out') {
    const sku = getLastSku_(actorKey);
    if (!sku) {
      await safeReplyText_(ev, '請先用「查 xxx」或「編號 a564」選定商品後再出庫');
      return;
    }
    const wh = parsed.warehouse ? (warehouseCodeFromText_(parsed.warehouse) || '') : '';
    await handleOut_(ev, { sku, whCode: wh, outBox: parsed.box, outPiece: parsed.piece });
    return;
  }
}

/* =========================
 * routes
 * ========================= */
app.get('/health', (_req, res) => res.status(200).send('ok'));

app.post('/webhook', middleware(lineConfig), (req, res) => {
  // 鐵律：立刻回 200，避免 LINE 重送
  res.sendStatus(200);

  const events = req.body?.events ?? [];
  for (const ev of events) {
    console.log('[LINE EVENT]', JSON.stringify(ev));
    void handleEvent_(ev);
  }
});

app.listen(PORT, () => {
  console.log(
    `LINE Bot server running on port ${PORT} ver=${BOT_VER} db_host=${SUPA_HOST} group=${String(GROUP_CODE || '').trim().toLowerCase()} default_wh=${String(WAREHOUSE_CODE_DEFAULT || '').trim().toLowerCase()}`,
  );
});
