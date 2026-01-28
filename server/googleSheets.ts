/**
 * Google Sheets 整合模組
 * 
 * 此模組負責將庫存資料同步到 Google Sheets
 * 使用 Google Sheets API v4
 * 
 * 工作表命名規則：MMdd 格式（如 0127）
 * 當日工作表即時更新，歷史工作表凍結
 */

import { formatBusinessDate, getBusinessDate } from "../shared/utils";
import * as db from "./db";

// Google Sheets API 相關設定
interface GoogleSheetsConfig {
  spreadsheetId: string;
  serviceAccountEmail: string;
  privateKey: string;
}

// 取得 Google Sheets 設定
function getConfig(): GoogleSheetsConfig | null {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!spreadsheetId || !serviceAccountEmail || !privateKey) {
    console.warn("[GoogleSheets] Missing configuration");
    return null;
  }

  return {
    spreadsheetId,
    serviceAccountEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
}

// 產生 JWT Token 用於 Google API 認證
async function getAccessToken(config: GoogleSheetsConfig): Promise<string | null> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // 1 小時後過期

    const header = {
      alg: "RS256",
      typ: "JWT",
    };

    const payload = {
      iss: config.serviceAccountEmail,
      scope: "https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: exp,
    };

    // 使用 jose 進行 JWT 簽名
    const { SignJWT, importPKCS8 } = await import("jose");
    const privateKey = await importPKCS8(config.privateKey, "RS256");
    
    const jwt = await new SignJWT(payload)
      .setProtectedHeader(header)
      .sign(privateKey);

    // 交換 access token
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      console.error("[GoogleSheets] Failed to get access token:", await response.text());
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("[GoogleSheets] Error getting access token:", error);
    return null;
  }
}

// 檢查工作表是否存在
async function sheetExists(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    const sheets = data.sheets || [];
    return sheets.some((s: any) => s.properties.title === sheetName);
  } catch (error) {
    console.error("[GoogleSheets] Error checking sheet existence:", error);
    return false;
  }
}

// 建立新工作表
async function createSheet(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string
): Promise<boolean> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        }),
      }
    );

    if (!response.ok) {
      console.error("[GoogleSheets] Failed to create sheet:", await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("[GoogleSheets] Error creating sheet:", error);
    return false;
  }
}

// 更新工作表資料
async function updateSheetData(
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
  data: any[][]
): Promise<boolean> {
  try {
    const range = `${sheetName}!A1`;
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          range: range,
          majorDimension: "ROWS",
          values: data,
        }),
      }
    );

    if (!response.ok) {
      console.error("[GoogleSheets] Failed to update sheet data:", await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("[GoogleSheets] Error updating sheet data:", error);
    return false;
  }
}

// 產生報表標題列
function generateHeaderRow(): string[] {
  return [
    "SKU",
    "商品名稱",
    "分店",
    "期初箱數",
    "期初散數",
    "期初成本",
    "入庫箱數",
    "入庫散數",
    "入庫成本",
    "出庫箱數",
    "出庫散數",
    "出庫成本",
    "調整箱數",
    "調整散數",
    "調整成本",
    "期末箱數",
    "期末散數",
    "期末成本",
    "平均成本(箱)",
    "平均成本(散)",
  ];
}

// 產生報表資料列
function generateDataRows(snapshots: any[]): any[][] {
  return snapshots.map((snapshot) => [
    snapshot.product?.sku || "",
    snapshot.product?.name || "",
    snapshot.store?.name || "",
    snapshot.openingCase,
    snapshot.openingUnit,
    Number(snapshot.openingCostCase) + Number(snapshot.openingCostUnit),
    snapshot.inboundCase,
    snapshot.inboundUnit,
    Number(snapshot.inboundCostCase) + Number(snapshot.inboundCostUnit),
    snapshot.outboundCase,
    snapshot.outboundUnit,
    Number(snapshot.outboundCostCase) + Number(snapshot.outboundCostUnit),
    snapshot.adjustmentCase,
    snapshot.adjustmentUnit,
    Number(snapshot.adjustmentCostCase) + Number(snapshot.adjustmentCostUnit),
    snapshot.closingCase,
    snapshot.closingUnit,
    Number(snapshot.closingCostCase) + Number(snapshot.closingCostUnit),
    snapshot.avgCostCase,
    snapshot.avgCostUnit,
  ]);
}

/**
 * 同步每日報表到 Google Sheets
 * @param businessDate 業務日期 (YYYY-MM-DD 格式)
 * @param storeId 分店 ID（可選，不指定則同步所有分店）
 */
export async function syncDailyReport(businessDate: string, storeId?: number): Promise<boolean> {
  const config = getConfig();
  if (!config) {
    console.warn("[GoogleSheets] Configuration not available, skipping sync");
    return false;
  }

  const accessToken = await getAccessToken(config);
  if (!accessToken) {
    return false;
  }

  const sheetName = formatBusinessDate(businessDate);

  // 檢查工作表是否存在，不存在則建立
  const exists = await sheetExists(accessToken, config.spreadsheetId, sheetName);
  if (!exists) {
    const created = await createSheet(accessToken, config.spreadsheetId, sheetName);
    if (!created) {
      return false;
    }
  }

  // 取得快照資料
  const snapshots = await db.getDailySnapshotsWithDetails(businessDate, storeId);
  if (!snapshots || snapshots.length === 0) {
    console.log("[GoogleSheets] No snapshot data for", businessDate);
    return true;
  }

  // 產生報表資料
  const headerRow = generateHeaderRow();
  const dataRows = generateDataRows(snapshots);
  const allData = [headerRow, ...dataRows];

  // 更新工作表
  return await updateSheetData(accessToken, config.spreadsheetId, sheetName, allData);
}

/**
 * 追溯更新受影響日期的報表
 * 當異動單審核通過後，需要更新從異動日期到今天的所有報表
 * @param fromDate 起始日期 (YYYY-MM-DD 格式)
 * @param storeId 分店 ID
 */
export async function retroactiveUpdateReports(fromDate: string, storeId: number): Promise<boolean> {
  const today = getBusinessDate();
  const startDate = new Date(fromDate);
  const endDate = new Date(today);

  let success = true;

  // 從異動日期到今天，逐日更新報表
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    const result = await syncDailyReport(dateStr, storeId);
    if (!result) {
      console.error("[GoogleSheets] Failed to sync report for", dateStr);
      success = false;
    }
  }

  return success;
}

/**
 * 建立或更新每日快照
 * 此函式應在每筆交易後呼叫，以更新當日快照
 */
export async function updateDailySnapshot(
  storeId: number,
  productId: number,
  businessDate: string
): Promise<void> {
  try {
    // 取得當日所有交易
    const transactions = await db.getTransactionsByDateAndProduct(storeId, productId, businessDate);
    
    // 取得前一日的期末庫存作為今日期初
    const previousDate = new Date(businessDate);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateStr = previousDate.toISOString().split("T")[0];
    const previousSnapshot = await db.getDailySnapshot(storeId, productId, previousDateStr);
    
    // 計算各項數據
    let openingCase = previousSnapshot?.closingCase || 0;
    let openingUnit = previousSnapshot?.closingUnit || 0;
    let openingCostCase = Number(previousSnapshot?.closingCostCase || 0);
    let openingCostUnit = Number(previousSnapshot?.closingCostUnit || 0);

    let inboundCase = 0;
    let inboundUnit = 0;
    let inboundCostCase = 0;
    let inboundCostUnit = 0;

    let outboundCase = 0;
    let outboundUnit = 0;
    let outboundCostCase = 0;
    let outboundCostUnit = 0;

    let adjustmentCase = 0;
    let adjustmentUnit = 0;
    let adjustmentCostCase = 0;
    let adjustmentCostUnit = 0;

    for (const tx of transactions) {
      const type = tx.type;
      const qCase = tx.quantityCase;
      const qUnit = tx.quantityUnit;
      const cost = Number(tx.totalCost || 0);

      if (type === "inbound" || type === "adjustment_in") {
        inboundCase += qCase;
        inboundUnit += qUnit;
        inboundCostCase += cost > 0 ? cost : 0;
      } else if (type === "outbound" || type === "adjustment_out") {
        outboundCase += Math.abs(qCase);
        outboundUnit += Math.abs(qUnit);
        outboundCostCase += Math.abs(cost);
      } else if (type === "stocktake" || type === "conversion") {
        adjustmentCase += qCase;
        adjustmentUnit += qUnit;
        adjustmentCostCase += cost;
      }
    }

    // 計算期末
    const closingCase = openingCase + inboundCase - outboundCase + adjustmentCase;
    const closingUnit = openingUnit + inboundUnit - outboundUnit + adjustmentUnit;
    const closingCostCase = openingCostCase + inboundCostCase - outboundCostCase + adjustmentCostCase;
    const closingCostUnit = openingCostUnit + inboundCostUnit - outboundCostUnit + adjustmentCostUnit;

    // 計算加權平均成本
    const avgCostCase = closingCase > 0 ? closingCostCase / closingCase : 0;
    const avgCostUnit = closingUnit > 0 ? closingCostUnit / closingUnit : 0;

    // 更新或建立快照
    await db.upsertDailySnapshot({
      storeId,
      productId,
      snapshotDate: new Date(businessDate),
      openingCase,
      openingUnit,
      openingCostCase: String(openingCostCase),
      openingCostUnit: String(openingCostUnit),
      inboundCase,
      inboundUnit,
      inboundCostCase: String(inboundCostCase),
      inboundCostUnit: String(inboundCostUnit),
      outboundCase,
      outboundUnit,
      outboundCostCase: String(outboundCostCase),
      outboundCostUnit: String(outboundCostUnit),
      adjustmentCase,
      adjustmentUnit,
      adjustmentCostCase: String(adjustmentCostCase),
      adjustmentCostUnit: String(adjustmentCostUnit),
      closingCase,
      closingUnit,
      closingCostCase: String(closingCostCase),
      closingCostUnit: String(closingCostUnit),
      avgCostCase: String(avgCostCase),
      avgCostUnit: String(avgCostUnit),
    });

    // 同步到 Google Sheets（僅當日）
    const today = getBusinessDate();
    if (businessDate === today) {
      await syncDailyReport(businessDate, storeId);
    }
  } catch (error) {
    console.error("[GoogleSheets] Error updating daily snapshot:", error);
  }
}

export default {
  syncDailyReport,
  retroactiveUpdateReports,
  updateDailySnapshot,
};
