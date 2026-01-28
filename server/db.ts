import { eq, and, gte, lte, like, or, desc, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  stores,
  products,
  inventory,
  transactions,
  adjustments,
  adjustmentItems,
  dailySnapshots,
  stockTakes,
  stockTakeItems,
  auditLogs,
  InsertStore,
  InsertProduct,
  InsertInventory,
  InsertTransaction,
  InsertAdjustment,
  InsertAdjustmentItem,
  InsertDailySnapshot,
  InsertStockTake,
  InsertStockTakeItem,
  InsertAuditLog,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============================================
// 使用者相關
// ============================================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "user" | "admin" | "store_manager", storeId?: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role, storeId: storeId ?? null }).where(eq(users.id, userId));
}

// ============================================
// 分店相關
// ============================================
export async function getAllStores() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(stores).orderBy(stores.code);
}

export async function getStoreById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stores).where(eq(stores.id, id)).limit(1);
  return result[0];
}

export async function getStoreByLineGroupId(lineGroupId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stores).where(eq(stores.lineGroupId, lineGroupId)).limit(1);
  return result[0];
}

export async function createStore(data: InsertStore) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(stores).values(data);
  return result[0].insertId;
}

export async function updateStore(id: number, data: Partial<InsertStore>) {
  const db = await getDb();
  if (!db) return;
  await db.update(stores).set(data).where(eq(stores.id, id));
}

export async function deleteStore(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(stores).set({ isActive: false }).where(eq(stores.id, id));
}

// ============================================
// 商品相關
// ============================================
export async function getAllProducts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(products).where(eq(products.isActive, true)).orderBy(products.sku);
}

export async function getProductById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return result[0];
}

export async function getProductBySku(sku: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.sku, sku)).limit(1);
  return result[0];
}

export async function getProductByBarcode(barcode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(products).where(eq(products.barcode, barcode)).limit(1);
  return result[0];
}

export async function searchProductsByName(keyword: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(products)
    .where(and(eq(products.isActive, true), like(products.name, `%${keyword}%`)))
    .limit(10);
}

export async function createProduct(data: InsertProduct) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(products).values(data);
  return result[0].insertId;
}

export async function updateProduct(id: number, data: Partial<InsertProduct>) {
  const db = await getDb();
  if (!db) return;
  await db.update(products).set(data).where(eq(products.id, id));
}

export async function deleteProduct(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(products).set({ isActive: false }).where(eq(products.id, id));
}

// ============================================
// 庫存相關
// ============================================
export async function getInventory(storeId: number, productId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(inventory)
    .where(and(eq(inventory.storeId, storeId), eq(inventory.productId, productId)))
    .limit(1);
  return result[0];
}

export async function getInventoryByStore(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      inventory: inventory,
      product: products,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .where(eq(inventory.storeId, storeId));
}

export async function getAllInventoryWithDetails() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      inventory: inventory,
      product: products,
      store: stores,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(stores, eq(inventory.storeId, stores.id))
    .where(eq(stores.isActive, true));
}

export async function upsertInventory(data: InsertInventory) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .insert(inventory)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        quantityCase: data.quantityCase,
        quantityUnit: data.quantityUnit,
        totalCostCase: data.totalCostCase,
        totalCostUnit: data.totalCostUnit,
        avgCostCase: data.avgCostCase,
        avgCostUnit: data.avgCostUnit,
      },
    });
}

export async function updateInventoryQuantity(
  storeId: number,
  productId: number,
  deltaCase: number,
  deltaUnit: number,
  deltaCostCase: number,
  deltaCostUnit: number
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 先取得現有庫存
  const current = await getInventory(storeId, productId);

  if (current) {
    const newQtyCase = current.quantityCase + deltaCase;
    const newQtyUnit = current.quantityUnit + deltaUnit;
    const newCostCase = Number(current.totalCostCase) + deltaCostCase;
    const newCostUnit = Number(current.totalCostUnit) + deltaCostUnit;

    // 計算加權平均成本
    const avgCostCase = newQtyCase > 0 ? newCostCase / newQtyCase : 0;
    const avgCostUnit = newQtyUnit > 0 ? newCostUnit / newQtyUnit : 0;

    await db
      .update(inventory)
      .set({
        quantityCase: newQtyCase,
        quantityUnit: newQtyUnit,
        totalCostCase: String(newCostCase),
        totalCostUnit: String(newCostUnit),
        avgCostCase: String(avgCostCase),
        avgCostUnit: String(avgCostUnit),
      })
      .where(and(eq(inventory.storeId, storeId), eq(inventory.productId, productId)));
  } else {
    // 新建庫存記錄
    const avgCostCase = deltaCase > 0 ? deltaCostCase / deltaCase : 0;
    const avgCostUnit = deltaUnit > 0 ? deltaCostUnit / deltaUnit : 0;

    await db.insert(inventory).values({
      storeId,
      productId,
      quantityCase: deltaCase,
      quantityUnit: deltaUnit,
      totalCostCase: String(deltaCostCase),
      totalCostUnit: String(deltaCostUnit),
      avgCostCase: String(avgCostCase),
      avgCostUnit: String(avgCostUnit),
    });
  }
}

// ============================================
// 交易記錄相關
// ============================================
export async function createTransaction(data: InsertTransaction) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(transactions).values(data);
  return result[0].insertId;
}

export async function getTransactionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);
  return result[0];
}

export async function getTransactionsByDateRange(
  storeId: number,
  startDate: string,
  endDate: string
) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      transaction: transactions,
      product: products,
    })
    .from(transactions)
    .innerJoin(products, eq(transactions.productId, products.id))
    .where(
      and(
        eq(transactions.storeId, storeId),
        gte(transactions.businessDate, new Date(startDate)),
        lte(transactions.businessDate, new Date(endDate)),
        eq(transactions.isCancelled, false)
      )
    )
    .orderBy(desc(transactions.transactionTime));
}

export async function getRecentTransactions(storeId: number, limit: number = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      transaction: transactions,
      product: products,
    })
    .from(transactions)
    .innerJoin(products, eq(transactions.productId, products.id))
    .where(eq(transactions.storeId, storeId))
    .orderBy(desc(transactions.transactionTime))
    .limit(limit);
}

export async function cancelTransaction(transactionId: number, cancelledById: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(transactions)
    .set({ isCancelled: true, cancelledById })
    .where(eq(transactions.id, transactionId));
}

export async function hasSubsequentTransactions(
  storeId: number,
  productId: number,
  afterTime: Date
) {
  const db = await getDb();
  if (!db) return true; // 安全起見，預設有後續交易

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .where(
      and(
        eq(transactions.storeId, storeId),
        eq(transactions.productId, productId),
        gte(transactions.transactionTime, afterTime),
        eq(transactions.isCancelled, false)
      )
    );

  return (result[0]?.count ?? 0) > 0;
}

// ============================================
// 異動單相關
// ============================================
export async function createAdjustment(data: InsertAdjustment) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(adjustments).values(data);
  return result[0].insertId;
}

export async function createAdjustmentItem(data: InsertAdjustmentItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(adjustmentItems).values(data);
}

export async function getAdjustmentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(adjustments).where(eq(adjustments.id, id)).limit(1);
  return result[0];
}

export async function getAdjustmentItems(adjustmentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      item: adjustmentItems,
      product: products,
    })
    .from(adjustmentItems)
    .innerJoin(products, eq(adjustmentItems.productId, products.id))
    .where(eq(adjustmentItems.adjustmentId, adjustmentId));
}

export async function getPendingAdjustments() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      adjustment: adjustments,
      store: stores,
    })
    .from(adjustments)
    .innerJoin(stores, eq(adjustments.storeId, stores.id))
    .where(eq(adjustments.status, "pending"))
    .orderBy(desc(adjustments.createdAt));
}

export async function getAdjustmentsByStore(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(adjustments)
    .where(eq(adjustments.storeId, storeId))
    .orderBy(desc(adjustments.createdAt));
}

export async function updateAdjustmentStatus(
  id: number,
  status: "approved" | "rejected",
  approvedById: number,
  approvedByName: string
) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(adjustments)
    .set({
      status,
      approvedById,
      approvedByName,
      approvedAt: new Date(),
    })
    .where(eq(adjustments.id, id));
}

// ============================================
// 每日快照相關
// ============================================
export async function getDailySnapshot(storeId: number, productId: number, date: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(dailySnapshots)
    .where(
      and(
        eq(dailySnapshots.storeId, storeId),
        eq(dailySnapshots.productId, productId),
        eq(dailySnapshots.snapshotDate, new Date(date))
      )
    )
    .limit(1);
  return result[0];
}

export async function upsertDailySnapshot(data: InsertDailySnapshot) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .insert(dailySnapshots)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        inboundCase: data.inboundCase,
        inboundUnit: data.inboundUnit,
        inboundCostCase: data.inboundCostCase,
        inboundCostUnit: data.inboundCostUnit,
        outboundCase: data.outboundCase,
        outboundUnit: data.outboundUnit,
        outboundCostCase: data.outboundCostCase,
        outboundCostUnit: data.outboundCostUnit,
        adjustmentCase: data.adjustmentCase,
        adjustmentUnit: data.adjustmentUnit,
        adjustmentCostCase: data.adjustmentCostCase,
        adjustmentCostUnit: data.adjustmentCostUnit,
        closingCase: data.closingCase,
        closingUnit: data.closingUnit,
        closingCostCase: data.closingCostCase,
        closingCostUnit: data.closingCostUnit,
        avgCostCase: data.avgCostCase,
        avgCostUnit: data.avgCostUnit,
      },
    });
}

export async function getDailySnapshotsByDate(storeId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      snapshot: dailySnapshots,
      product: products,
    })
    .from(dailySnapshots)
    .innerJoin(products, eq(dailySnapshots.productId, products.id))
    .where(
      and(eq(dailySnapshots.storeId, storeId), eq(dailySnapshots.snapshotDate, new Date(date)))
    );
}

// ============================================
// 盤點相關
// ============================================
export async function createStockTake(data: InsertStockTake) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(stockTakes).values(data);
  return result[0].insertId;
}

export async function createStockTakeItem(data: InsertStockTakeItem) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(stockTakeItems).values(data);
}

export async function getStockTakeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stockTakes).where(eq(stockTakes.id, id)).limit(1);
  return result[0];
}

export async function getStockTakeItems(stocktakeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      item: stockTakeItems,
      product: products,
    })
    .from(stockTakeItems)
    .innerJoin(products, eq(stockTakeItems.productId, products.id))
    .where(eq(stockTakeItems.stocktakeId, stocktakeId));
}

export async function getStockTakesByStore(storeId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(stockTakes)
    .where(eq(stockTakes.storeId, storeId))
    .orderBy(desc(stockTakes.createdAt));
}

export async function updateStockTakeStatus(id: number, status: "draft" | "completed") {
  const db = await getDb();
  if (!db) return;
  await db
    .update(stockTakes)
    .set({
      status,
      completedAt: status === "completed" ? new Date() : null,
    })
    .where(eq(stockTakes.id, id));
}

// ============================================
// 審計日誌相關
// ============================================
export async function createAuditLog(data: InsertAuditLog) {
  const db = await getDb();
  if (!db) return;
  await db.insert(auditLogs).values(data);
}

export async function getAuditLogs(tableName?: string, recordId?: number, limit: number = 100) {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(auditLogs);

  if (tableName && recordId) {
    query = query.where(
      and(eq(auditLogs.tableName, tableName), eq(auditLogs.recordId, recordId))
    ) as typeof query;
  } else if (tableName) {
    query = query.where(eq(auditLogs.tableName, tableName)) as typeof query;
  }

  return query.orderBy(desc(auditLogs.createdAt)).limit(limit);
}

// ============================================
// 庫存預警相關
// ============================================
export async function getLowStockItems(storeId?: number) {
  const db = await getDb();
  if (!db) return [];

  const result = await db
    .select({
      inventory: inventory,
      product: products,
      store: stores,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .innerJoin(stores, eq(inventory.storeId, stores.id))
    .where(
      and(
        eq(stores.isActive, true),
        or(
          sql`${inventory.quantityCase} < ${products.safetyStockCase}`,
          sql`${inventory.quantityUnit} < ${products.safetyStockUnit}`
        )
      )
    );

  if (storeId) {
    return result.filter((r) => r.inventory.storeId === storeId);
  }

  return result;
}


// ============================================
// Google Sheets 整合相關
// ============================================
export async function getDailySnapshotsWithDetails(date: string, storeId?: number) {
  const db = await getDb();
  if (!db) return [];

  let conditions = [eq(dailySnapshots.snapshotDate, new Date(date))];
  if (storeId) {
    conditions.push(eq(dailySnapshots.storeId, storeId));
  }

  return db
    .select({
      snapshot: dailySnapshots,
      product: products,
      store: stores,
    })
    .from(dailySnapshots)
    .innerJoin(products, eq(dailySnapshots.productId, products.id))
    .innerJoin(stores, eq(dailySnapshots.storeId, stores.id))
    .where(and(...conditions));
}

export async function getTransactionsByDateAndProduct(
  storeId: number,
  productId: number,
  businessDate: string
) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.storeId, storeId),
        eq(transactions.productId, productId),
        eq(transactions.businessDate, new Date(businessDate)),
        eq(transactions.isCancelled, false)
      )
    )
    .orderBy(transactions.transactionTime);
}

