import { Router, Request, Response } from "express";
import * as db from "./db";
import { getBusinessDate } from "../shared/utils";

const router = Router();

// LINE Bot Webhook 處理
router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const events = req.body.events || [];

    for (const event of events) {
      if (event.type === "message" && event.message.type === "text") {
        const groupId = event.source.groupId || event.source.roomId;
        const userId = event.source.userId;
        const text = event.message.text.trim();
        const replyToken = event.replyToken;

        if (!groupId) {
          // 非群組訊息，不處理
          continue;
        }

        // 查找綁定的分店
        const store = await db.getStoreByLineGroupId(groupId);
        if (!store) {
          await replyMessage(replyToken, "此群組尚未綁定分店，請聯繫管理員設定。");
          continue;
        }

        // 解析指令
        const result = await parseAndExecuteCommand(text, store.id, userId);
        if (result) {
          await replyMessage(replyToken, result);
        }
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("[LINE Bot] Webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 指令解析
interface CommandResult {
  type: "search" | "barcode" | "sku" | "inbound" | "outbound" | "unknown";
  keyword?: string;
  quantityCase?: number;
  quantityUnit?: number;
}

function parseCommand(text: string): CommandResult {
  const trimmed = text.trim();

  // 查詢商品名稱：查 可樂 / 查可樂 / 查詢 可樂
  const searchMatch = trimmed.match(/^(查詢?|查)\s*(.+)$/);
  if (searchMatch) {
    return { type: "search", keyword: searchMatch[2].trim() };
  }

  // 條碼查詢：條碼 123 / 條碼123 / 條碼：123
  const barcodeMatch = trimmed.match(/^條碼[：:\s]*(.+)$/);
  if (barcodeMatch) {
    return { type: "barcode", keyword: barcodeMatch[1].trim() };
  }

  // SKU 查詢：編號 ABC / 編號ABC / 編號：ABC / #ABC
  const skuMatch = trimmed.match(/^(編號[：:\s]*|#)(.+)$/i);
  if (skuMatch) {
    return { type: "sku", keyword: skuMatch[2].trim().toUpperCase() };
  }

  // 入庫指令：入庫3箱2散 / 入3箱 / 入3箱1（最後的 1 視為「散」）
  const inboundMatch = trimmed.match(/^入[庫]?\s*(\d+)\s*箱?\s*(\d*)\s*(散|個)?$/);
  if (inboundMatch) {
    const quantityCase = parseInt(inboundMatch[1]) || 0;
    let quantityUnit = 0;
    if (inboundMatch[2]) {
      quantityUnit = parseInt(inboundMatch[2]) || 0;
    }
    return { type: "inbound", quantityCase, quantityUnit };
  }

  // 純入庫散數：入10（視為散）
  const inboundUnitMatch = trimmed.match(/^入[庫]?\s*(\d+)$/);
  if (inboundUnitMatch && !trimmed.includes("箱")) {
    return { type: "inbound", quantityCase: 0, quantityUnit: parseInt(inboundUnitMatch[1]) || 0 };
  }

  // 出庫指令：出3箱 / 出2散 / 出3箱1（最後的 1 視為「散」）
  const outboundMatch = trimmed.match(/^出[庫]?\s*(\d+)\s*箱\s*(\d*)\s*(散|個)?$/);
  if (outboundMatch) {
    const quantityCase = parseInt(outboundMatch[1]) || 0;
    let quantityUnit = 0;
    if (outboundMatch[2]) {
      quantityUnit = parseInt(outboundMatch[2]) || 0;
    }
    return { type: "outbound", quantityCase, quantityUnit };
  }

  // 純出庫散數：出10（視為散）
  const outboundUnitMatch = trimmed.match(/^出[庫]?\s*(\d+)$/);
  if (outboundUnitMatch && !trimmed.includes("箱")) {
    return { type: "outbound", quantityCase: 0, quantityUnit: parseInt(outboundUnitMatch[1]) || 0 };
  }

  // 出庫箱數帶散數：出3箱2散
  const outboundFullMatch = trimmed.match(/^出[庫]?\s*(\d+)\s*箱\s*(\d+)\s*(散|個)$/);
  if (outboundFullMatch) {
    return {
      type: "outbound",
      quantityCase: parseInt(outboundFullMatch[1]) || 0,
      quantityUnit: parseInt(outboundFullMatch[2]) || 0,
    };
  }

  return { type: "unknown" };
}

// 暫存使用者選擇的商品（用於後續操作）
const userProductSelection: Map<string, { productId: number; storeId: number; expireAt: number }> = new Map();

async function parseAndExecuteCommand(
  text: string,
  storeId: number,
  userId: string
): Promise<string | null> {
  const command = parseCommand(text);

  switch (command.type) {
    case "search": {
      if (!command.keyword) return "請輸入商品名稱";
      const products = await db.searchProductsByName(command.keyword);
      if (products.length === 0) {
        return `找不到與「${command.keyword}」相關的商品`;
      }
      if (products.length === 1) {
        // 只有一個結果，直接顯示詳情
        const product = products[0];
        const inv = await db.getInventory(storeId, product.id);
        userProductSelection.set(userId, {
          productId: product.id,
          storeId,
          expireAt: Date.now() + 5 * 60 * 1000, // 5 分鐘過期
        });
        return formatProductInfo(product, inv);
      }
      // 多個結果，列出選項
      let msg = `找到以下與「${command.keyword}」相關的選項\n\n`;
      for (const p of products) {
        msg += `編號：${p.sku}\n名稱：${p.name}\n\n`;
      }
      msg += "請輸入「編號 XXX」選擇商品";
      return msg;
    }

    case "barcode": {
      if (!command.keyword) return "請輸入條碼";
      const product = await db.getProductByBarcode(command.keyword);
      if (!product) {
        return `找不到條碼「${command.keyword}」的商品`;
      }
      const inv = await db.getInventory(storeId, product.id);
      userProductSelection.set(userId, {
        productId: product.id,
        storeId,
        expireAt: Date.now() + 5 * 60 * 1000,
      });
      return formatProductInfo(product, inv);
    }

    case "sku": {
      if (!command.keyword) return "請輸入商品編號";
      const product = await db.getProductBySku(command.keyword);
      if (!product) {
        return `找不到編號「${command.keyword}」的商品`;
      }
      const inv = await db.getInventory(storeId, product.id);
      userProductSelection.set(userId, {
        productId: product.id,
        storeId,
        expireAt: Date.now() + 5 * 60 * 1000,
      });
      return formatProductInfo(product, inv);
    }

    case "inbound": {
      const selection = userProductSelection.get(userId);
      if (!selection || selection.expireAt < Date.now() || selection.storeId !== storeId) {
        return "請先查詢商品後再進行入庫操作";
      }

      const product = await db.getProductById(selection.productId);
      if (!product) {
        return "商品不存在";
      }

      const quantityCase = command.quantityCase || 0;
      const quantityUnit = command.quantityUnit || 0;

      if (quantityCase === 0 && quantityUnit === 0) {
        return "入庫數量不能為零";
      }

      const businessDate = getBusinessDate();

      // 取得現有庫存以計算成本
      const inv = await db.getInventory(storeId, product.id);
      const avgCostCase = inv ? Number(inv.avgCostCase) : 0;
      const avgCostUnit = inv ? Number(inv.avgCostUnit) : 0;
      const costCase = avgCostCase * quantityCase;
      const costUnit = avgCostUnit * quantityUnit;

      // 建立交易記錄
      await db.createTransaction({
        storeId,
        productId: product.id,
        type: "inbound",
        quantityCase,
        quantityUnit,
        unitCostCase: String(avgCostCase),
        unitCostUnit: String(avgCostUnit),
        totalCost: String(costCase + costUnit),
        businessDate: new Date(businessDate),
        source: "line",
        operatorName: `LINE User ${userId.slice(-6)}`,
      });

      // 更新庫存
      await db.updateInventoryQuantity(storeId, product.id, quantityCase, quantityUnit, costCase, costUnit);

      // 取得更新後的庫存
      const newInv = await db.getInventory(storeId, product.id);

      userProductSelection.delete(userId);

      return `✅ 入庫成功
品名：${product.name}
編號：${product.sku}
入庫：${quantityCase}箱 ${quantityUnit}件
👉目前庫存：${newInv?.quantityCase || 0}箱${newInv?.quantityUnit || 0}散`;
    }

    case "outbound": {
      const selection = userProductSelection.get(userId);
      if (!selection || selection.expireAt < Date.now() || selection.storeId !== storeId) {
        return "請先查詢商品後再進行出庫操作";
      }

      const product = await db.getProductById(selection.productId);
      if (!product) {
        return "商品不存在";
      }

      const quantityCase = command.quantityCase || 0;
      const quantityUnit = command.quantityUnit || 0;

      if (quantityCase === 0 && quantityUnit === 0) {
        return "出庫數量不能為零";
      }

      // 檢查庫存
      const inv = await db.getInventory(storeId, product.id);
      if (!inv) {
        return "❌ 出庫失敗\n該商品無庫存";
      }

      // 箱數對箱數、散數對散數（鐵律）
      if (quantityCase > 0 && inv.quantityCase < quantityCase) {
        return `❌ 出庫失敗\n箱庫存不足，目前 ${inv.quantityCase} 箱，欲出庫 ${quantityCase} 箱`;
      }
      if (quantityUnit > 0 && inv.quantityUnit < quantityUnit) {
        return `❌ 出庫失敗\n散庫存不足，目前 ${inv.quantityUnit} 散，欲出庫 ${quantityUnit} 散`;
      }

      const businessDate = getBusinessDate();
      const avgCostCase = Number(inv.avgCostCase);
      const avgCostUnit = Number(inv.avgCostUnit);
      const costCase = avgCostCase * quantityCase;
      const costUnit = avgCostUnit * quantityUnit;

      // 建立交易記錄
      await db.createTransaction({
        storeId,
        productId: product.id,
        type: "outbound",
        quantityCase: -quantityCase,
        quantityUnit: -quantityUnit,
        unitCostCase: String(avgCostCase),
        unitCostUnit: String(avgCostUnit),
        totalCost: String(-(costCase + costUnit)),
        businessDate: new Date(businessDate),
        source: "line",
        operatorName: `LINE User ${userId.slice(-6)}`,
      });

      // 更新庫存
      await db.updateInventoryQuantity(storeId, product.id, -quantityCase, -quantityUnit, -costCase, -costUnit);

      // 取得更新後的庫存
      const newInv = await db.getInventory(storeId, product.id);

      userProductSelection.delete(userId);

      const store = await db.getStoreById(storeId);

      return `✅ 出庫成功
品名：${product.name}
編號：${product.sku}
倉別：${store?.name || "未知"}
出庫：${quantityCase}箱 ${quantityUnit}件
👉目前庫存：${newInv?.quantityCase || 0}箱${newInv?.quantityUnit || 0}散`;
    }

    default:
      return null; // 不回應未知指令
  }
}

function formatProductInfo(product: any, inv: any): string {
  return `名稱：${product.name}
編號：${product.sku}
箱入數：${product.unitsPerCase}
單價：${product.unitPrice}
倉庫類別：總倉
庫存：${inv?.quantityCase || 0}箱${inv?.quantityUnit || 0}散`;
}

// LINE Messaging API 回覆訊息
async function replyMessage(replyToken: string, text: string): Promise<void> {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!channelAccessToken) {
    console.warn("[LINE Bot] LINE_CHANNEL_ACCESS_TOKEN not configured");
    return;
  }

  try {
    const response = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text }],
      }),
    });

    if (!response.ok) {
      console.error("[LINE Bot] Reply failed:", await response.text());
    }
  } catch (error) {
    console.error("[LINE Bot] Reply error:", error);
  }
}

export default router;
