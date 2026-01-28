import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  date,
  boolean,
  bigint,
} from "drizzle-orm/mysql-core";

// ============================================
// 使用者表 (Users)
// ============================================
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin", "store_manager"]).default("user").notNull(),
  storeId: int("storeId"), // 綁定的分店 ID（店長角色使用）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ============================================
// 分店表 (Stores)
// ============================================
export const stores = mysqlTable("stores", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 32 }).notNull().unique(), // 分店代碼
  name: varchar("name", { length: 128 }).notNull(), // 分店名稱
  address: text("address"), // 地址
  phone: varchar("phone", { length: 32 }), // 電話
  lineGroupId: varchar("lineGroupId", { length: 64 }), // 綁定的 LINE 群組 ID
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Store = typeof stores.$inferSelect;
export type InsertStore = typeof stores.$inferInsert;

// ============================================
// 商品主檔表 (Products)
// ============================================
export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  sku: varchar("sku", { length: 64 }).notNull().unique(), // SKU 編號（唯一）
  name: varchar("name", { length: 256 }).notNull(), // 商品名稱
  barcode: varchar("barcode", { length: 64 }), // 條碼
  unitsPerCase: int("unitsPerCase").default(1).notNull(), // 箱入數
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).default("0").notNull(), // 單價
  safetyStockCase: int("safetyStockCase").default(0).notNull(), // 安全庫存（箱）
  safetyStockUnit: int("safetyStockUnit").default(0).notNull(), // 安全庫存（散）
  category: varchar("category", { length: 64 }), // 分類
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

// ============================================
// 庫存表 (Inventory)
// ============================================
export const inventory = mysqlTable("inventory", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(), // 分店 ID
  productId: int("productId").notNull(), // 商品 ID
  quantityCase: int("quantityCase").default(0).notNull(), // 箱數
  quantityUnit: int("quantityUnit").default(0).notNull(), // 散數
  totalCostCase: decimal("totalCostCase", { precision: 12, scale: 2 }).default("0").notNull(), // 箱總成本
  totalCostUnit: decimal("totalCostUnit", { precision: 12, scale: 2 }).default("0").notNull(), // 散總成本
  avgCostCase: decimal("avgCostCase", { precision: 10, scale: 2 }).default("0").notNull(), // 箱加權平均成本
  avgCostUnit: decimal("avgCostUnit", { precision: 10, scale: 2 }).default("0").notNull(), // 散加權平均成本
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = typeof inventory.$inferInsert;

// ============================================
// 交易記錄表 (Transactions)
// ============================================
export const transactions = mysqlTable("transactions", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(), // 分店 ID
  productId: int("productId").notNull(), // 商品 ID
  type: mysqlEnum("type", [
    "inbound",        // 入庫
    "outbound",       // 出庫
    "adjustment_in",  // 異動單補入庫
    "adjustment_out", // 異動單補出庫
    "conversion",     // 箱散轉換
    "stocktake",      // 盤點調整
    "cancel",         // 取消
  ]).notNull(),
  quantityCase: int("quantityCase").default(0).notNull(), // 箱數（正數入庫，負數出庫）
  quantityUnit: int("quantityUnit").default(0).notNull(), // 散數（正數入庫，負數出庫）
  unitCostCase: decimal("unitCostCase", { precision: 10, scale: 2 }), // 箱單位成本
  unitCostUnit: decimal("unitCostUnit", { precision: 10, scale: 2 }), // 散單位成本
  totalCost: decimal("totalCost", { precision: 12, scale: 2 }), // 總成本
  businessDate: date("businessDate").notNull(), // 業務日期（05:00 跨日）
  transactionTime: timestamp("transactionTime").defaultNow().notNull(), // 實際交易時間
  source: mysqlEnum("source", ["web", "line", "system"]).default("web").notNull(), // 來源
  operatorId: int("operatorId"), // 操作人員 ID
  operatorName: varchar("operatorName", { length: 128 }), // 操作人員名稱
  adjustmentId: int("adjustmentId"), // 關聯的異動單 ID
  stocktakeId: int("stocktakeId"), // 關聯的盤點 ID
  cancelledById: int("cancelledById"), // 被哪筆交易取消
  cancelledTransactionId: int("cancelledTransactionId"), // 取消了哪筆交易
  note: text("note"), // 備註
  isCancelled: boolean("isCancelled").default(false).notNull(), // 是否已取消
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;

// ============================================
// 異動單表 (Adjustments)
// ============================================
export const adjustments = mysqlTable("adjustments", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(), // 分店 ID
  type: mysqlEnum("type", [
    "补出库",    // 補出庫
    "补入库",    // 補入庫
    "箱散转换",  // 箱散轉換
  ]).notNull(),
  adjustmentDate: date("adjustmentDate").notNull(), // 異動日期（回溯日期）
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  reason: text("reason"), // 異動原因
  createdById: int("createdById").notNull(), // 建立人 ID
  createdByName: varchar("createdByName", { length: 128 }), // 建立人名稱
  approvedById: int("approvedById"), // 審核人 ID
  approvedByName: varchar("approvedByName", { length: 128 }), // 審核人名稱
  approvedAt: timestamp("approvedAt"), // 審核時間
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Adjustment = typeof adjustments.$inferSelect;
export type InsertAdjustment = typeof adjustments.$inferInsert;

// ============================================
// 異動單明細表 (Adjustment Items)
// ============================================
export const adjustmentItems = mysqlTable("adjustment_items", {
  id: int("id").autoincrement().primaryKey(),
  adjustmentId: int("adjustmentId").notNull(), // 異動單 ID
  productId: int("productId").notNull(), // 商品 ID
  quantityCase: int("quantityCase").default(0).notNull(), // 箱數
  quantityUnit: int("quantityUnit").default(0).notNull(), // 散數
  unitCostCase: decimal("unitCostCase", { precision: 10, scale: 2 }), // 箱單位成本
  unitCostUnit: decimal("unitCostUnit", { precision: 10, scale: 2 }), // 散單位成本
  // 箱散轉換專用
  fromCase: int("fromCase").default(0), // 從箱轉出
  toUnit: int("toUnit").default(0), // 轉為散
  fromUnit: int("fromUnit").default(0), // 從散轉出
  toCase: int("toCase").default(0), // 轉為箱
  note: text("note"),
});

export type AdjustmentItem = typeof adjustmentItems.$inferSelect;
export type InsertAdjustmentItem = typeof adjustmentItems.$inferInsert;

// ============================================
// 每日庫存快照表 (Daily Snapshots)
// ============================================
export const dailySnapshots = mysqlTable("daily_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  productId: int("productId").notNull(),
  snapshotDate: date("snapshotDate").notNull(), // 快照日期
  // 期初
  openingCase: int("openingCase").default(0).notNull(),
  openingUnit: int("openingUnit").default(0).notNull(),
  openingCostCase: decimal("openingCostCase", { precision: 12, scale: 2 }).default("0").notNull(),
  openingCostUnit: decimal("openingCostUnit", { precision: 12, scale: 2 }).default("0").notNull(),
  // 入庫
  inboundCase: int("inboundCase").default(0).notNull(),
  inboundUnit: int("inboundUnit").default(0).notNull(),
  inboundCostCase: decimal("inboundCostCase", { precision: 12, scale: 2 }).default("0").notNull(),
  inboundCostUnit: decimal("inboundCostUnit", { precision: 12, scale: 2 }).default("0").notNull(),
  // 出庫
  outboundCase: int("outboundCase").default(0).notNull(),
  outboundUnit: int("outboundUnit").default(0).notNull(),
  outboundCostCase: decimal("outboundCostCase", { precision: 12, scale: 2 }).default("0").notNull(),
  outboundCostUnit: decimal("outboundCostUnit", { precision: 12, scale: 2 }).default("0").notNull(),
  // 盤點調整
  adjustmentCase: int("adjustmentCase").default(0).notNull(),
  adjustmentUnit: int("adjustmentUnit").default(0).notNull(),
  adjustmentCostCase: decimal("adjustmentCostCase", { precision: 12, scale: 2 }).default("0").notNull(),
  adjustmentCostUnit: decimal("adjustmentCostUnit", { precision: 12, scale: 2 }).default("0").notNull(),
  // 期末
  closingCase: int("closingCase").default(0).notNull(),
  closingUnit: int("closingUnit").default(0).notNull(),
  closingCostCase: decimal("closingCostCase", { precision: 12, scale: 2 }).default("0").notNull(),
  closingCostUnit: decimal("closingCostUnit", { precision: 12, scale: 2 }).default("0").notNull(),
  // 加權平均成本
  avgCostCase: decimal("avgCostCase", { precision: 10, scale: 2 }).default("0").notNull(),
  avgCostUnit: decimal("avgCostUnit", { precision: 10, scale: 2 }).default("0").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailySnapshot = typeof dailySnapshots.$inferSelect;
export type InsertDailySnapshot = typeof dailySnapshots.$inferInsert;

// ============================================
// 盤點記錄表 (Stock Takes)
// ============================================
export const stockTakes = mysqlTable("stock_takes", {
  id: int("id").autoincrement().primaryKey(),
  storeId: int("storeId").notNull(),
  stocktakeDate: date("stocktakeDate").notNull(), // 盤點日期
  month: varchar("month", { length: 7 }).notNull(), // 盤點月份 YYYY-MM
  status: mysqlEnum("status", ["draft", "completed"]).default("draft").notNull(),
  createdById: int("createdById").notNull(),
  createdByName: varchar("createdByName", { length: 128 }),
  completedAt: timestamp("completedAt"),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type StockTake = typeof stockTakes.$inferSelect;
export type InsertStockTake = typeof stockTakes.$inferInsert;

// ============================================
// 盤點明細表 (Stock Take Items)
// ============================================
export const stockTakeItems = mysqlTable("stock_take_items", {
  id: int("id").autoincrement().primaryKey(),
  stocktakeId: int("stocktakeId").notNull(),
  productId: int("productId").notNull(),
  // 系統庫存
  systemCase: int("systemCase").default(0).notNull(),
  systemUnit: int("systemUnit").default(0).notNull(),
  // 實際盤點
  actualCase: int("actualCase").default(0).notNull(),
  actualUnit: int("actualUnit").default(0).notNull(),
  // 差異
  diffCase: int("diffCase").default(0).notNull(),
  diffUnit: int("diffUnit").default(0).notNull(),
  note: text("note"),
});

export type StockTakeItem = typeof stockTakeItems.$inferSelect;
export type InsertStockTakeItem = typeof stockTakeItems.$inferInsert;

// ============================================
// 審計日誌表 (Audit Logs)
// ============================================
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  tableName: varchar("tableName", { length: 64 }).notNull(), // 操作的表名
  recordId: int("recordId").notNull(), // 記錄 ID
  action: mysqlEnum("action", ["create", "update", "delete"]).notNull(),
  oldValue: text("oldValue"), // 舊值 (JSON)
  newValue: text("newValue"), // 新值 (JSON)
  operatorId: int("operatorId"),
  operatorName: varchar("operatorName", { length: 128 }),
  ipAddress: varchar("ipAddress", { length: 64 }),
  userAgent: text("userAgent"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
