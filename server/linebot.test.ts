import { describe, expect, it } from "vitest";

// 從 linebot.ts 提取的指令解析邏輯（用於測試）
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
  const inboundMatch = trimmed.match(/^入[庫]?\s*(\d+)\s*箱\s*(\d*)\s*(散|個)?$/);
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

describe("LINE Bot 指令解析", () => {
  describe("查詢商品名稱", () => {
    it("查 可樂", () => {
      const result = parseCommand("查 可樂");
      expect(result.type).toBe("search");
      expect(result.keyword).toBe("可樂");
    });

    it("查可樂", () => {
      const result = parseCommand("查可樂");
      expect(result.type).toBe("search");
      expect(result.keyword).toBe("可樂");
    });

    it("查詢 可樂", () => {
      const result = parseCommand("查詢 可樂");
      expect(result.type).toBe("search");
      expect(result.keyword).toBe("可樂");
    });

    it("查胖胖", () => {
      const result = parseCommand("查胖胖");
      expect(result.type).toBe("search");
      expect(result.keyword).toBe("胖胖");
    });
  });

  describe("條碼查詢", () => {
    it("條碼 123", () => {
      const result = parseCommand("條碼 123");
      expect(result.type).toBe("barcode");
      expect(result.keyword).toBe("123");
    });

    it("條碼123", () => {
      const result = parseCommand("條碼123");
      expect(result.type).toBe("barcode");
      expect(result.keyword).toBe("123");
    });

    it("條碼：123", () => {
      const result = parseCommand("條碼：123");
      expect(result.type).toBe("barcode");
      expect(result.keyword).toBe("123");
    });
  });

  describe("SKU 查詢", () => {
    it("編號 ABC", () => {
      const result = parseCommand("編號 ABC");
      expect(result.type).toBe("sku");
      expect(result.keyword).toBe("ABC");
    });

    it("編號ABC", () => {
      const result = parseCommand("編號ABC");
      expect(result.type).toBe("sku");
      expect(result.keyword).toBe("ABC");
    });

    it("編號：ABC", () => {
      const result = parseCommand("編號：ABC");
      expect(result.type).toBe("sku");
      expect(result.keyword).toBe("ABC");
    });

    it("#ABC", () => {
      const result = parseCommand("#ABC");
      expect(result.type).toBe("sku");
      expect(result.keyword).toBe("ABC");
    });

    it("編號 Bc191 (不限制大小寫)", () => {
      const result = parseCommand("編號 Bc191");
      expect(result.type).toBe("sku");
      expect(result.keyword).toBe("BC191");
    });
  });

  describe("入庫指令", () => {
    it("入3箱", () => {
      const result = parseCommand("入3箱");
      expect(result.type).toBe("inbound");
      expect(result.quantityCase).toBe(3);
      expect(result.quantityUnit).toBe(0);
    });

    it("入3箱2散", () => {
      const result = parseCommand("入3箱2散");
      expect(result.type).toBe("inbound");
      expect(result.quantityCase).toBe(3);
      expect(result.quantityUnit).toBe(2);
    });

    it("入3箱1（最後的 1 視為散）", () => {
      const result = parseCommand("入3箱1");
      expect(result.type).toBe("inbound");
      expect(result.quantityCase).toBe(3);
      expect(result.quantityUnit).toBe(1);
    });

    it("入10（視為散）", () => {
      const result = parseCommand("入10");
      expect(result.type).toBe("inbound");
      expect(result.quantityCase).toBe(0);
      expect(result.quantityUnit).toBe(10);
    });
  });

  describe("出庫指令", () => {
    it("出3箱", () => {
      const result = parseCommand("出3箱");
      expect(result.type).toBe("outbound");
      expect(result.quantityCase).toBe(3);
      expect(result.quantityUnit).toBe(0);
    });

    it("出2散", () => {
      const result = parseCommand("出2");
      expect(result.type).toBe("outbound");
      expect(result.quantityCase).toBe(0);
      expect(result.quantityUnit).toBe(2);
    });

    it("出3箱2散", () => {
      const result = parseCommand("出3箱2散");
      expect(result.type).toBe("outbound");
      expect(result.quantityCase).toBe(3);
      expect(result.quantityUnit).toBe(2);
    });

    it("出10（視為散）", () => {
      const result = parseCommand("出10");
      expect(result.type).toBe("outbound");
      expect(result.quantityCase).toBe(0);
      expect(result.quantityUnit).toBe(10);
    });
  });

  describe("未知指令", () => {
    it("隨機文字", () => {
      const result = parseCommand("你好");
      expect(result.type).toBe("unknown");
    });

    it("空字串", () => {
      const result = parseCommand("");
      expect(result.type).toBe("unknown");
    });
  });
});
