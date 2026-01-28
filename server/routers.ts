import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { getBusinessDate } from "../shared/utils";

// 管理員權限檢查
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "需要管理員權限" });
  }
  return next({ ctx });
});

// 店長或管理員權限檢查
const storeManagerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin" && ctx.user.role !== "store_manager") {
    throw new TRPCError({ code: "FORBIDDEN", message: "需要店長或管理員權限" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ============================================
  // 使用者管理
  // ============================================
  users: router({
    list: adminProcedure.query(async () => {
      return db.getAllUsers();
    }),
    updateRole: adminProcedure
      .input(
        z.object({
          userId: z.number(),
          role: z.enum(["user", "admin", "store_manager"]),
          storeId: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await db.updateUserRole(input.userId, input.role, input.storeId);
        return { success: true };
      }),
  }),

  // ============================================
  // 分店管理
  // ============================================
  stores: router({
    list: protectedProcedure.query(async () => {
      return db.getAllStores();
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getStoreById(input.id);
      }),
    create: adminProcedure
      .input(
        z.object({
          code: z.string().min(1),
          name: z.string().min(1),
          address: z.string().optional(),
          phone: z.string().optional(),
          lineGroupId: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await db.createStore(input);
        return { id };
      }),
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          code: z.string().min(1).optional(),
          name: z.string().min(1).optional(),
          address: z.string().optional(),
          phone: z.string().optional(),
          lineGroupId: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        await db.updateStore(id, data);
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteStore(input.id);
        return { success: true };
      }),
  }),

  // ============================================
  // 商品管理
  // ============================================
  products: router({
    list: protectedProcedure.query(async () => {
      return db.getAllProducts();
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getProductById(input.id);
      }),
    getBySku: protectedProcedure
      .input(z.object({ sku: z.string() }))
      .query(async ({ input }) => {
        return db.getProductBySku(input.sku.toUpperCase());
      }),
    getByBarcode: protectedProcedure
      .input(z.object({ barcode: z.string() }))
      .query(async ({ input }) => {
        return db.getProductByBarcode(input.barcode);
      }),
    search: protectedProcedure
      .input(z.object({ keyword: z.string() }))
      .query(async ({ input }) => {
        return db.searchProductsByName(input.keyword);
      }),
    create: storeManagerProcedure
      .input(
        z.object({
          sku: z.string().min(1),
          name: z.string().min(1),
          barcode: z.string().optional(),
          unitsPerCase: z.number().min(1).default(1),
          unitPrice: z.string().default("0"),
          safetyStockCase: z.number().min(0).default(0),
          safetyStockUnit: z.number().min(0).default(0),
          category: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const id = await db.createProduct({
          ...input,
          sku: input.sku.toUpperCase(),
        });
        return { id };
      }),
    update: storeManagerProcedure
      .input(
        z.object({
          id: z.number(),
          sku: z.string().min(1).optional(),
          name: z.string().min(1).optional(),
          barcode: z.string().optional(),
          unitsPerCase: z.number().min(1).optional(),
          unitPrice: z.string().optional(),
          safetyStockCase: z.number().min(0).optional(),
          safetyStockUnit: z.number().min(0).optional(),
          category: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...data } = input;
        if (data.sku) {
          data.sku = data.sku.toUpperCase();
        }
        await db.updateProduct(id, data);
        return { success: true };
      }),
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteProduct(input.id);
        return { success: true };
      }),
  }),

  // ============================================
  // 庫存管理
  // ============================================
  inventory: router({
    getByStore: protectedProcedure
      .input(z.object({ storeId: z.number() }))
      .query(async ({ input }) => {
        return db.getInventoryByStore(input.storeId);
      }),
    getAll: protectedProcedure.query(async () => {
      return db.getAllInventoryWithDetails();
    }),
    get: protectedProcedure
      .input(z.object({ storeId: z.number(), productId: z.number() }))
      .query(async ({ input }) => {
        return db.getInventory(input.storeId, input.productId);
      }),
    getLowStock: protectedProcedure
      .input(z.object({ storeId: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getLowStockItems(input.storeId);
      }),
  }),

  // ============================================
  // 入庫作業
  // ============================================
  inbound: router({
    create: storeManagerProcedure
      .input(
        z.object({
          storeId: z.number(),
          productId: z.number(),
          quantityCase: z.number().min(0).default(0),
          quantityUnit: z.number().min(0).default(0),
          unitCostCase: z.string().optional(),
          unitCostUnit: z.string().optional(),
          note: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (input.quantityCase === 0 && input.quantityUnit === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "入庫數量不能為零" });
        }

        const businessDate = getBusinessDate();
        const costCase = Number(input.unitCostCase || 0) * input.quantityCase;
        const costUnit = Number(input.unitCostUnit || 0) * input.quantityUnit;

        // 建立交易記錄
        const transactionId = await db.createTransaction({
          storeId: input.storeId,
          productId: input.productId,
          type: "inbound",
          quantityCase: input.quantityCase,
          quantityUnit: input.quantityUnit,
          unitCostCase: input.unitCostCase,
          unitCostUnit: input.unitCostUnit,
          totalCost: String(costCase + costUnit),
          businessDate: new Date(businessDate),
          source: "web",
          operatorId: ctx.user.id,
          operatorName: ctx.user.name || "Unknown",
          note: input.note,
        });

        // 更新庫存
        await db.updateInventoryQuantity(
          input.storeId,
          input.productId,
          input.quantityCase,
          input.quantityUnit,
          costCase,
          costUnit
        );

        return { transactionId };
      }),
  }),

  // ============================================
  // 出庫作業
  // ============================================
  outbound: router({
    create: storeManagerProcedure
      .input(
        z.object({
          storeId: z.number(),
          productId: z.number(),
          quantityCase: z.number().min(0).default(0),
          quantityUnit: z.number().min(0).default(0),
          note: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        if (input.quantityCase === 0 && input.quantityUnit === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "出庫數量不能為零" });
        }

        // 檢查庫存
        const inv = await db.getInventory(input.storeId, input.productId);
        if (!inv) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "該商品無庫存" });
        }

        // 箱數對箱數、散數對散數（鐵律）
        if (input.quantityCase > 0 && inv.quantityCase < input.quantityCase) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `箱庫存不足，目前 ${inv.quantityCase} 箱，欲出庫 ${input.quantityCase} 箱`,
          });
        }
        if (input.quantityUnit > 0 && inv.quantityUnit < input.quantityUnit) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `散庫存不足，目前 ${inv.quantityUnit} 散，欲出庫 ${input.quantityUnit} 散`,
          });
        }

        const businessDate = getBusinessDate();
        const costCase = Number(inv.avgCostCase) * input.quantityCase;
        const costUnit = Number(inv.avgCostUnit) * input.quantityUnit;

        // 建立交易記錄
        const transactionId = await db.createTransaction({
          storeId: input.storeId,
          productId: input.productId,
          type: "outbound",
          quantityCase: -input.quantityCase,
          quantityUnit: -input.quantityUnit,
          unitCostCase: inv.avgCostCase,
          unitCostUnit: inv.avgCostUnit,
          totalCost: String(-(costCase + costUnit)),
          businessDate: new Date(businessDate),
          source: "web",
          operatorId: ctx.user.id,
          operatorName: ctx.user.name || "Unknown",
          note: input.note,
        });

        // 更新庫存
        await db.updateInventoryQuantity(
          input.storeId,
          input.productId,
          -input.quantityCase,
          -input.quantityUnit,
          -costCase,
          -costUnit
        );

        return { transactionId };
      }),
  }),

  // ============================================
  // 交易記錄
  // ============================================
  transactions: router({
    getRecent: protectedProcedure
      .input(z.object({ storeId: z.number(), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        return db.getRecentTransactions(input.storeId, input.limit);
      }),
    getByDateRange: protectedProcedure
      .input(
        z.object({
          storeId: z.number(),
          startDate: z.string(),
          endDate: z.string(),
        })
      )
      .query(async ({ input }) => {
        return db.getTransactionsByDateRange(input.storeId, input.startDate, input.endDate);
      }),
    cancel: storeManagerProcedure
      .input(z.object({ transactionId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const transaction = await db.getTransactionById(input.transactionId);
        if (!transaction) {
          throw new TRPCError({ code: "NOT_FOUND", message: "交易記錄不存在" });
        }

        if (transaction.isCancelled) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "該交易已被取消" });
        }

        // 檢查是否為當日交易
        const today = getBusinessDate();
        const transactionDate = transaction.businessDate.toISOString().split("T")[0];
        if (transactionDate !== today) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "僅能取消當日交易" });
        }

        // 檢查是否有後續交易
        const hasSubsequent = await db.hasSubsequentTransactions(
          transaction.storeId,
          transaction.productId,
          transaction.transactionTime
        );
        if (hasSubsequent) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "該商品有後續交易，無法取消",
          });
        }

        // 取消交易
        await db.cancelTransaction(input.transactionId, ctx.user.id);

        // 反向更新庫存
        await db.updateInventoryQuantity(
          transaction.storeId,
          transaction.productId,
          -transaction.quantityCase,
          -transaction.quantityUnit,
          -Number(transaction.totalCost || 0) * (transaction.quantityCase >= 0 ? 1 : -1),
          0
        );

        // 建立取消記錄
        await db.createTransaction({
          storeId: transaction.storeId,
          productId: transaction.productId,
          type: "cancel",
          quantityCase: -transaction.quantityCase,
          quantityUnit: -transaction.quantityUnit,
          totalCost: String(-Number(transaction.totalCost || 0)),
          businessDate: new Date(today),
          source: "web",
          operatorId: ctx.user.id,
          operatorName: ctx.user.name || "Unknown",
          cancelledTransactionId: input.transactionId,
          note: `取消交易 #${input.transactionId}`,
        });

        return { success: true };
      }),
  }),

  // ============================================
  // 異動單管理
  // ============================================
  adjustments: router({
    list: protectedProcedure
      .input(z.object({ storeId: z.number().optional() }))
      .query(async ({ input, ctx }) => {
        if (ctx.user.role === "admin") {
          if (input.storeId) {
            return db.getAdjustmentsByStore(input.storeId);
          }
          return db.getPendingAdjustments();
        }
        // 店長只能看自己分店的異動單
        if (ctx.user.storeId) {
          return db.getAdjustmentsByStore(ctx.user.storeId);
        }
        return [];
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const adjustment = await db.getAdjustmentById(input.id);
        if (!adjustment) return null;
        const items = await db.getAdjustmentItems(input.id);
        return { adjustment, items };
      }),
    create: storeManagerProcedure
      .input(
        z.object({
          storeId: z.number(),
          type: z.enum(["补出库", "补入库", "箱散转换"]),
          adjustmentDate: z.string(),
          reason: z.string().optional(),
          items: z.array(
            z.object({
              productId: z.number(),
              quantityCase: z.number().default(0),
              quantityUnit: z.number().default(0),
              unitCostCase: z.string().optional(),
              unitCostUnit: z.string().optional(),
              fromCase: z.number().optional(),
              toUnit: z.number().optional(),
              fromUnit: z.number().optional(),
              toCase: z.number().optional(),
              note: z.string().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const adjustmentId = await db.createAdjustment({
          storeId: input.storeId,
          type: input.type,
          adjustmentDate: new Date(input.adjustmentDate),
          reason: input.reason,
          createdById: ctx.user.id,
          createdByName: ctx.user.name || "Unknown",
        });

        for (const item of input.items) {
          await db.createAdjustmentItem({
            adjustmentId,
            ...item,
          });
        }

        return { adjustmentId };
      }),
    approve: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const adjustment = await db.getAdjustmentById(input.id);
        if (!adjustment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "異動單不存在" });
        }
        if (adjustment.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "該異動單已處理" });
        }

        const items = await db.getAdjustmentItems(input.id);

        // 執行異動
        for (const { item, product } of items) {
          if (adjustment.type === "补入库") {
            const costCase = Number(item.unitCostCase || 0) * item.quantityCase;
            const costUnit = Number(item.unitCostUnit || 0) * item.quantityUnit;

            await db.createTransaction({
              storeId: adjustment.storeId,
              productId: item.productId,
              type: "adjustment_in",
              quantityCase: item.quantityCase,
              quantityUnit: item.quantityUnit,
              unitCostCase: item.unitCostCase,
              unitCostUnit: item.unitCostUnit,
              totalCost: String(costCase + costUnit),
              businessDate: adjustment.adjustmentDate,
              source: "web",
              operatorId: ctx.user.id,
              operatorName: ctx.user.name || "Unknown",
              adjustmentId: input.id,
            });

            await db.updateInventoryQuantity(
              adjustment.storeId,
              item.productId,
              item.quantityCase,
              item.quantityUnit,
              costCase,
              costUnit
            );
          } else if (adjustment.type === "补出库") {
            const inv = await db.getInventory(adjustment.storeId, item.productId);
            const avgCostCase = inv ? Number(inv.avgCostCase) : 0;
            const avgCostUnit = inv ? Number(inv.avgCostUnit) : 0;
            const costCase = avgCostCase * item.quantityCase;
            const costUnit = avgCostUnit * item.quantityUnit;

            await db.createTransaction({
              storeId: adjustment.storeId,
              productId: item.productId,
              type: "adjustment_out",
              quantityCase: -item.quantityCase,
              quantityUnit: -item.quantityUnit,
              unitCostCase: String(avgCostCase),
              unitCostUnit: String(avgCostUnit),
              totalCost: String(-(costCase + costUnit)),
              businessDate: adjustment.adjustmentDate,
              source: "web",
              operatorId: ctx.user.id,
              operatorName: ctx.user.name || "Unknown",
              adjustmentId: input.id,
            });

            await db.updateInventoryQuantity(
              adjustment.storeId,
              item.productId,
              -item.quantityCase,
              -item.quantityUnit,
              -costCase,
              -costUnit
            );
          } else if (adjustment.type === "箱散转换") {
            // 箱轉散
            if (item.fromCase && item.toUnit) {
              await db.updateInventoryQuantity(
                adjustment.storeId,
                item.productId,
                -item.fromCase,
                item.toUnit,
                0,
                0
              );
            }
            // 散轉箱
            if (item.fromUnit && item.toCase) {
              await db.updateInventoryQuantity(
                adjustment.storeId,
                item.productId,
                item.toCase,
                -item.fromUnit,
                0,
                0
              );
            }

            await db.createTransaction({
              storeId: adjustment.storeId,
              productId: item.productId,
              type: "conversion",
              quantityCase: (item.toCase || 0) - (item.fromCase || 0),
              quantityUnit: (item.toUnit || 0) - (item.fromUnit || 0),
              businessDate: adjustment.adjustmentDate,
              source: "web",
              operatorId: ctx.user.id,
              operatorName: ctx.user.name || "Unknown",
              adjustmentId: input.id,
              note: `箱散轉換：${item.fromCase || 0}箱→${item.toUnit || 0}散, ${item.fromUnit || 0}散→${item.toCase || 0}箱`,
            });
          }
        }

        await db.updateAdjustmentStatus(
          input.id,
          "approved",
          ctx.user.id,
          ctx.user.name || "Unknown"
        );

        return { success: true };
      }),
    reject: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const adjustment = await db.getAdjustmentById(input.id);
        if (!adjustment) {
          throw new TRPCError({ code: "NOT_FOUND", message: "異動單不存在" });
        }
        if (adjustment.status !== "pending") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "該異動單已處理" });
        }

        await db.updateAdjustmentStatus(
          input.id,
          "rejected",
          ctx.user.id,
          ctx.user.name || "Unknown"
        );

        return { success: true };
      }),
  }),

  // ============================================
  // 盤點管理
  // ============================================
  stocktakes: router({
    list: protectedProcedure
      .input(z.object({ storeId: z.number() }))
      .query(async ({ input }) => {
        return db.getStockTakesByStore(input.storeId);
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const stocktake = await db.getStockTakeById(input.id);
        if (!stocktake) return null;
        const items = await db.getStockTakeItems(input.id);
        return { stocktake, items };
      }),
    create: storeManagerProcedure
      .input(
        z.object({
          storeId: z.number(),
          stocktakeDate: z.string(),
          month: z.string(),
          note: z.string().optional(),
          items: z.array(
            z.object({
              productId: z.number(),
              systemCase: z.number(),
              systemUnit: z.number(),
              actualCase: z.number(),
              actualUnit: z.number(),
              note: z.string().optional(),
            })
          ),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const stocktakeId = await db.createStockTake({
          storeId: input.storeId,
          stocktakeDate: new Date(input.stocktakeDate),
          month: input.month,
          createdById: ctx.user.id,
          createdByName: ctx.user.name || "Unknown",
          note: input.note,
        });

        for (const item of input.items) {
          const diffCase = item.actualCase - item.systemCase;
          const diffUnit = item.actualUnit - item.systemUnit;

          await db.createStockTakeItem({
            stocktakeId,
            productId: item.productId,
            systemCase: item.systemCase,
            systemUnit: item.systemUnit,
            actualCase: item.actualCase,
            actualUnit: item.actualUnit,
            diffCase,
            diffUnit,
            note: item.note,
          });
        }

        return { stocktakeId };
      }),
    complete: storeManagerProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const stocktake = await db.getStockTakeById(input.id);
        if (!stocktake) {
          throw new TRPCError({ code: "NOT_FOUND", message: "盤點記錄不存在" });
        }
        if (stocktake.status === "completed") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "該盤點已完成" });
        }

        const items = await db.getStockTakeItems(input.id);
        const businessDate = getBusinessDate();

        // 執行盤點調整
        for (const { item, product } of items) {
          if (item.diffCase !== 0 || item.diffUnit !== 0) {
            const inv = await db.getInventory(stocktake.storeId, item.productId);
            const avgCostCase = inv ? Number(inv.avgCostCase) : 0;
            const avgCostUnit = inv ? Number(inv.avgCostUnit) : 0;
            const costCase = avgCostCase * item.diffCase;
            const costUnit = avgCostUnit * item.diffUnit;

            await db.createTransaction({
              storeId: stocktake.storeId,
              productId: item.productId,
              type: "stocktake",
              quantityCase: item.diffCase,
              quantityUnit: item.diffUnit,
              unitCostCase: String(avgCostCase),
              unitCostUnit: String(avgCostUnit),
              totalCost: String(costCase + costUnit),
              businessDate: new Date(businessDate),
              source: "web",
              operatorId: ctx.user.id,
              operatorName: ctx.user.name || "Unknown",
              stocktakeId: input.id,
              note: `盤點調整：箱 ${item.diffCase >= 0 ? "+" : ""}${item.diffCase}，散 ${item.diffUnit >= 0 ? "+" : ""}${item.diffUnit}`,
            });

            await db.updateInventoryQuantity(
              stocktake.storeId,
              item.productId,
              item.diffCase,
              item.diffUnit,
              costCase,
              costUnit
            );
          }
        }

        await db.updateStockTakeStatus(input.id, "completed");

        return { success: true };
      }),
  }),

  // ============================================
  // 每日快照
  // ============================================
  snapshots: router({
    getByDate: protectedProcedure
      .input(z.object({ storeId: z.number(), date: z.string() }))
      .query(async ({ input }) => {
        return db.getDailySnapshotsByDate(input.storeId, input.date);
      }),
  }),

  // ============================================
  // 審計日誌
  // ============================================
  auditLogs: router({
    list: adminProcedure
      .input(
        z.object({
          tableName: z.string().optional(),
          recordId: z.number().optional(),
          limit: z.number().default(100),
        })
      )
      .query(async ({ input }) => {
        return db.getAuditLogs(input.tableName, input.recordId, input.limit);
      }),
  }),
});

export type AppRouter = typeof appRouter;
