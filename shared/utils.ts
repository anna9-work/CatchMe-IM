/**
 * 業務日區間：05:00 ～ 隔日 04:59:59
 * 根據實際時間計算業務日期
 */
export function getBusinessDate(date: Date = new Date()): string {
  const hour = date.getHours();
  const businessDate = new Date(date);
  
  // 如果是 00:00 ~ 04:59，業務日為前一天
  if (hour < 5) {
    businessDate.setDate(businessDate.getDate() - 1);
  }
  
  return businessDate.toISOString().split('T')[0];
}

/**
 * 格式化日期為 MMdd 格式（用於 Google Sheets 工作表名稱）
 */
export function formatBusinessDate(businessDate: string): string {
  // 直接解析 YYYY-MM-DD 格式，避免時區問題
  const parts = businessDate.split('-');
  const month = parts[1];
  const day = parts[2];
  return `${month}${day}`;
}

export function formatDateMMdd(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}${day}`;
}

/**
 * 解析業務日期範圍
 */
export function getBusinessDateRange(businessDate: string): { start: Date; end: Date } {
  const date = new Date(businessDate);
  const start = new Date(date);
  start.setHours(5, 0, 0, 0);
  
  const end = new Date(date);
  end.setDate(end.getDate() + 1);
  end.setHours(4, 59, 59, 999);
  
  return { start, end };
}

/**
 * 交易類型中文對照
 */
export const transactionTypeLabels: Record<string, string> = {
  inbound: '入庫',
  outbound: '出庫',
  adjustment_in: '補入庫',
  adjustment_out: '補出庫',
  conversion: '箱散轉換',
  stocktake: '盤點調整',
  cancel: '取消',
};

/**
 * 異動單類型
 */
export const adjustmentTypes = ['补出库', '补入库', '箱散转换'] as const;
export type AdjustmentType = typeof adjustmentTypes[number];

/**
 * 異動單狀態中文對照
 */
export const adjustmentStatusLabels: Record<string, string> = {
  pending: '待審核',
  approved: '已核准',
  rejected: '已拒絕',
};

/**
 * 使用者角色
 */
export const userRoles = ['user', 'admin', 'store_manager'] as const;
export type UserRole = typeof userRoles[number];

export const userRoleLabels: Record<string, string> = {
  user: '一般使用者',
  admin: '總管',
  store_manager: '店長',
};
