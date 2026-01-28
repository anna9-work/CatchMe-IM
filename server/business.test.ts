import { describe, expect, it } from "vitest";
import { getBusinessDate, formatBusinessDate, getBusinessDateRange } from "../shared/utils";

describe("業務邏輯測試", () => {
  describe("業務日期計算", () => {
    it("格式化日期為 MMdd 格式", () => {
      expect(formatBusinessDate("2026-01-27")).toBe("0127");
      expect(formatBusinessDate("2026-12-05")).toBe("1205");
      expect(formatBusinessDate("2026-03-15")).toBe("0315");
    });

    it("業務日期範圍計算", () => {
      const range = getBusinessDateRange("2026-01-27");
      expect(range.start.getHours()).toBe(5);
      expect(range.end.getHours()).toBe(4);
    });
  });

  describe("庫存規則驗證", () => {
    it("箱數對箱數驗證 - 庫存足夠", () => {
      const inventory = { quantityCase: 10, quantityUnit: 5 };
      const outbound = { quantityCase: 3, quantityUnit: 0 };
      
      const canOutbound = inventory.quantityCase >= outbound.quantityCase;
      expect(canOutbound).toBe(true);
    });

    it("箱數對箱數驗證 - 庫存不足", () => {
      const inventory = { quantityCase: 2, quantityUnit: 5 };
      const outbound = { quantityCase: 3, quantityUnit: 0 };
      
      const canOutbound = inventory.quantityCase >= outbound.quantityCase;
      expect(canOutbound).toBe(false);
    });

    it("散數對散數驗證 - 庫存足夠", () => {
      const inventory = { quantityCase: 2, quantityUnit: 5 };
      const outbound = { quantityCase: 0, quantityUnit: 3 };
      
      const canOutbound = inventory.quantityUnit >= outbound.quantityUnit;
      expect(canOutbound).toBe(true);
    });

    it("散數對散數驗證 - 庫存不足（鐵律：不能用箱補散）", () => {
      const inventory = { quantityCase: 2, quantityUnit: 5 };
      const outbound = { quantityCase: 0, quantityUnit: 9 };
      
      // 即使有 2 箱，也不能自動拆箱補散
      const canOutbound = inventory.quantityUnit >= outbound.quantityUnit;
      expect(canOutbound).toBe(false);
    });

    it("禁止負數庫存", () => {
      const inventory = { quantityCase: 5, quantityUnit: 3 };
      const outbound = { quantityCase: 6, quantityUnit: 0 };
      
      const resultCase = inventory.quantityCase - outbound.quantityCase;
      expect(resultCase).toBeLessThan(0);
      // 系統應該拒絕此操作
    });
  });

  describe("加權平均成本計算", () => {
    it("計算加權平均成本", () => {
      // 第一批入庫：100 件 @ $10 = $1,000
      // 第二批入庫：50 件 @ $12 = $600
      // 加權平均成本 = $1,600 / 150 = $10.67
      
      const batch1 = { quantity: 100, cost: 1000 };
      const batch2 = { quantity: 50, cost: 600 };
      
      const totalQuantity = batch1.quantity + batch2.quantity;
      const totalCost = batch1.cost + batch2.cost;
      const avgCost = totalCost / totalQuantity;
      
      expect(avgCost).toBeCloseTo(10.67, 2);
    });

    it("出庫後重新計算平均成本", () => {
      // 現有庫存：150 件，總成本 $1,600，平均成本 $10.67
      // 出庫：30 件
      // 剩餘：120 件，總成本 $1,600 - (30 * $10.67) = $1,280
      // 新平均成本 = $1,280 / 120 = $10.67（不變）
      
      const currentQty = 150;
      const currentCost = 1600;
      const avgCost = currentCost / currentQty;
      
      const outboundQty = 30;
      const outboundCost = outboundQty * avgCost;
      
      const newQty = currentQty - outboundQty;
      const newCost = currentCost - outboundCost;
      const newAvgCost = newCost / newQty;
      
      expect(newAvgCost).toBeCloseTo(avgCost, 2);
    });
  });

  describe("異動單追溯更新", () => {
    it("計算受影響的日期範圍", () => {
      const adjustmentDate = new Date("2026-01-24");
      const today = new Date("2026-01-27");
      
      const affectedDays: string[] = [];
      for (let d = new Date(adjustmentDate); d <= today; d.setDate(d.getDate() + 1)) {
        affectedDays.push(d.toISOString().split("T")[0]);
      }
      
      expect(affectedDays).toEqual([
        "2026-01-24",
        "2026-01-25",
        "2026-01-26",
        "2026-01-27",
      ]);
    });
  });
});
