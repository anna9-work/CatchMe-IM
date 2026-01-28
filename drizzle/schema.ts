import {
  pgTable,
  pgEnum,
  serial,
  integer,
  text,
  timestamp,
  varchar,
  numeric,
  date,
  boolean,
  uniqueIndex,
} from "drizzle-orm/pg-core";
// ============================================
// Enums
// ============================================
export const roleEnum = pgEnum("role", ["user", "admin", "store_manager"]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "inbound",
  "outbound",
  "adjustment_in",
  "adjustment_out",
  "conversion",
  "stocktake",
  "cancel",
]);

export const transactionSourceEnum = pgEnum("transaction_source", ["web", "line", "system"]);

// ============================================
// 使用者表 (Users)
// ============================================
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull(),
    name: text("name"),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: roleEnum("role").default("user").notNull(),
    storeId: integer("storeId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  (t) => ({
    openIdUnique: uniqueIndex("users_openid_unique").on(t.openId),
  })
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
// ============================================
// 分店表 (Stores)
// ============================================
export const stores = pgTable(
  "stores",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 128 }).notNull(),
    address: text("address"),
    phone: varchar("phone", { length: 32 }),
    lineGroupId: varchar("lineGroupId", { length: 64 }),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => ({
    codeUnique: uniqueIndex("stores_code_unique").on(t.code),
  })
);

export type Store = typeof stores.$inferSelect;
export type InsertStore = typeof stores.$inferInsert;
// ============================================
// 商品主檔表 (Products)
// ============================================
export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    sku: varchar("sku", { length: 64 }).notNull(),
    name: varchar("name", { length: 256 }).notNull(),
    barcode: varchar("barcode", { length: 64 }),
    unitsPerCase: integer("unitsPerCase").default(1).notNull(),
    unitPrice: numeric("unitPrice", { precision: 10, scale: 2 }).default("0").notNull(),
    safetyStockCase: integer("safetyStockCase").default(0).notNull(),
    safetyStockUnit: integer("safetyStockUnit").default(0).notNull(),
    category: varchar("category", { length: 64 }),
    isActive: boolean("isActive").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => ({
    skuUnique: uniqueIndex("products_sku_unique").on(t.sku),
  })
);

export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;
// ============================================
// 庫存表 (Inventory)
// ============================================
export const inventory = pgTable(
  "inventory",
  {
    id: serial("id").primaryKey(),
    storeId: integer("storeId").notNull(),
    productId: integer("productId").notNull(),
    quantityCase: integer("quantityCase").default(0).notNull(),
    quantityUnit: integer("quantityUnit").default(0).notNull(),
    totalCostCase: numeric("totalCostCase", { precision: 12, scale: 2 }).default("0").notNull(),
    totalCostUnit: numeric("totalCostUnit", { precision: 12, scale: 2 }).default("0").notNull(),
    avgCostCase: numeric("avgCostCase", { precision: 10, scale: 2 }).default("0").notNull(),
    avgCostUnit: numeric("avgCostUnit", { precision: 10, scale: 2 }).default("0").notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (t) => ({
    storeProductUnique: uniqueIndex("inventory_store_product_unique").on(t.storeId, t.productId),
  })
);

export type Inventory = typeof inventory.$inferSelect;
export type InsertInventory = typeof inventory.$inferInsert;
// ============================================
// 交易記錄表 (Transactions)
// ============================================
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull(),
  productId: integer("productId").notNull(),
  type: transactionTypeEnum("type").notNull(),
  quantityCase: integer("quantityCase").default(0).notNull(),
  quantityUnit: integer("quantityUnit").default(0).notNull(),
  unitCostCase: numeric("unitCostCase", { precision: 10, scale: 2 }),
  unitCostUnit: numeric("unitCostUnit", { precision: 10, scale: 2 }),
  totalCost: numeric("totalCost", { precision: 12, scale: 2 }),
  businessDate: date("businessDate").notNull(),
  transactionTime: timestamp("transactionTime").defaultNow().notNull(),
  source: transactionSourceEnum("source").default("web").notNull(),
  operatorId: integer("operatorId"),
  operatorName: varchar("operatorName", { length: 128 }),
  adjustmentId: integer("adjustmentId"),
  stocktakeId: integer("stocktakeId"),
  cancelledById: integer("cancelledById"),
  cancelledTransactionId: integer("cancelledTransactionId"),
  note: text("note"),
  isCancelled: boolean("isCancelled").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = typeof transactions.$inferInsert;
// ============================================
// 異動單表 (Adjustments)
// ============================================
export const adjustmentTypeEnum = pgEnum("adjustment_type", [
  "補出庫",
  "補入庫",
  "箱散轉換",
]);

export const adjustmentStatusEnum = pgEnum("adjustment_status", [
  "pending",
  "approved",
  "rejected",
]);

export const adjustments = pgTable("adjustments", {
  id: serial("id").primaryKey(),
  storeId: integer("storeId").notNull(),
  type: adjustmentTypeEnum("type").notNull(),
  adjustmentDate: date("adjustmentDate").notNull(),
  status: adjustmentStatusEnum("status").default("pending").notNull(),
  reason: text("reason"),
  createdById: integer("createdById").notNull(),
  createdByName: varchar("createdByName", { length: 128 }),
  approvedById: integer("approvedById"),
  approvedByName: varchar("approvedByName", { length: 128 }),
  approvedAt: timestamp("approvedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type Adjustment = typeof adjustments.$inferSelect;
export type InsertAdjustment = typeof adjustments.$inferInsert;
