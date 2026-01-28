import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getBusinessDate, formatBusinessDate } from "./utils";

describe("業務日期計算", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getBusinessDate", () => {
    it("05:00 之後屬於當日", () => {
      // 2026-01-27 10:00:00 UTC+8
      vi.setSystemTime(new Date("2026-01-27T02:00:00.000Z")); // UTC 02:00 = UTC+8 10:00
      const result = getBusinessDate();
      expect(result).toBe("2026-01-27");
    });

    it("05:00 之前屬於前一日", () => {
      // 2026-01-27 03:00:00 UTC+8 (凌晨3點)
      vi.setSystemTime(new Date("2026-01-26T19:00:00.000Z")); // UTC 19:00 = UTC+8 03:00 (次日)
      const result = getBusinessDate();
      expect(result).toBe("2026-01-26");
    });

    it("04:59:59 屬於前一日", () => {
      // 2026-01-27 04:59:59 UTC+8
      vi.setSystemTime(new Date("2026-01-26T20:59:59.000Z")); // UTC 20:59:59 = UTC+8 04:59:59 (次日)
      const result = getBusinessDate();
      expect(result).toBe("2026-01-26");
    });

    it("05:00:00 屬於當日", () => {
      // 2026-01-27 05:00:00 UTC+8
      vi.setSystemTime(new Date("2026-01-26T21:00:00.000Z")); // UTC 21:00 = UTC+8 05:00 (次日)
      const result = getBusinessDate();
      expect(result).toBe("2026-01-27");
    });
  });

  describe("formatBusinessDate", () => {
    it("格式化為 MMdd", () => {
      const result = formatBusinessDate("2026-01-27");
      expect(result).toBe("0127");
    });

    it("格式化為 MMdd (12月)", () => {
      const result = formatBusinessDate("2025-12-05");
      expect(result).toBe("1205");
    });
  });
});
