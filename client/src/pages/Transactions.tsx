import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { History, X, ArrowDownToLine, ArrowUpFromLine, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const typeLabels: Record<string, { label: string; color: string; icon: React.ComponentType<any> }> = {
  inbound: { label: "入庫", color: "bg-green-500", icon: ArrowDownToLine },
  outbound: { label: "出庫", color: "bg-blue-500", icon: ArrowUpFromLine },
  adjustment_in: { label: "補入庫", color: "bg-purple-500", icon: ArrowDownToLine },
  adjustment_out: { label: "補出庫", color: "bg-orange-500", icon: ArrowUpFromLine },
  conversion: { label: "箱散轉換", color: "bg-teal-500", icon: RefreshCw },
  stocktake: { label: "盤點調整", color: "bg-amber-500", icon: RefreshCw },
  cancel: { label: "取消", color: "bg-red-500", icon: X },
};

export default function Transactions() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(new Date().toISOString().split("T")[0]);

  const { data: stores } = trpc.stores.list.useQuery();
  const { data: transactions, isLoading, refetch } = trpc.transactions.getByDateRange.useQuery(
    {
      storeId: parseInt(selectedStoreId),
      startDate,
      endDate,
    },
    { enabled: !!selectedStoreId }
  );

  const cancelMutation = trpc.transactions.cancel.useMutation({
    onSuccess: () => {
      toast.success("交易已取消");
      refetch();
    },
    onError: (error) => {
      toast.error(`取消失敗：${error.message}`);
    },
  });

  const handleCancel = (transactionId: number) => {
    if (confirm("確定要取消此交易嗎？此操作無法復原。")) {
      cancelMutation.mutate({ transactionId });
    }
  };

  // 判斷是否可以取消（當日且非已取消）
  const canCancel = (transaction: any) => {
    if (transaction.isCancelled) return false;
    if (transaction.type === "cancel") return false;

    const today = new Date().toISOString().split("T")[0];
    const transactionDate = new Date(transaction.businessDate).toISOString().split("T")[0];
    return transactionDate === today;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <History className="h-8 w-8 text-slate-500" />
          <h1 className="text-3xl font-bold text-slate-800">交易記錄</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>查詢條件</CardTitle>
            <CardDescription>選擇分店和日期範圍查詢交易記錄</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>選擇分店 *</Label>
                <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                  <SelectTrigger>
                    <SelectValue placeholder="請選擇分店" />
                  </SelectTrigger>
                  <SelectContent>
                    {stores?.map((store) => (
                      <SelectItem key={store.id} value={store.id.toString()}>
                        {store.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>開始日期</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>結束日期</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedStoreId && (
          <Card>
            <CardHeader>
              <CardTitle>交易列表</CardTitle>
              <CardDescription>
                {startDate} 至 {endDate} 的交易記錄
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8">載入中...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>類型</TableHead>
                      <TableHead>商品</TableHead>
                      <TableHead className="text-right">箱數</TableHead>
                      <TableHead className="text-right">散數</TableHead>
                      <TableHead className="text-right">成本</TableHead>
                      <TableHead>業務日</TableHead>
                      <TableHead>操作人</TableHead>
                      <TableHead>來源</TableHead>
                      <TableHead>時間</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions?.map((tx) => {
                      const typeInfo = typeLabels[tx.transaction.type] || {
                        label: tx.transaction.type,
                        color: "bg-slate-500",
                        icon: History,
                      };
                      const Icon = typeInfo.icon;
                      const isCancelled = tx.transaction.isCancelled;

                      return (
                        <TableRow
                          key={tx.transaction.id}
                          className={isCancelled ? "opacity-50 bg-slate-50" : ""}
                        >
                          <TableCell className="font-mono">#{tx.transaction.id}</TableCell>
                          <TableCell>
                            <Badge className={`${typeInfo.color} flex items-center gap-1 w-fit`}>
                              <Icon className="h-3 w-3" />
                              {typeInfo.label}
                            </Badge>
                            {isCancelled && (
                              <Badge variant="outline" className="ml-1 text-red-500">
                                已取消
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <span className="font-mono text-xs text-slate-500">
                                {tx.product.sku}
                              </span>
                              <br />
                              {tx.product.name}
                            </div>
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              tx.transaction.quantityCase > 0
                                ? "text-green-600"
                                : tx.transaction.quantityCase < 0
                                ? "text-red-600"
                                : ""
                            }`}
                          >
                            {tx.transaction.quantityCase > 0 ? "+" : ""}
                            {tx.transaction.quantityCase}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              tx.transaction.quantityUnit > 0
                                ? "text-green-600"
                                : tx.transaction.quantityUnit < 0
                                ? "text-red-600"
                                : ""
                            }`}
                          >
                            {tx.transaction.quantityUnit > 0 ? "+" : ""}
                            {tx.transaction.quantityUnit}
                          </TableCell>
                          <TableCell className="text-right">
                            ${Number(tx.transaction.totalCost || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {new Date(tx.transaction.businessDate).toLocaleDateString("zh-TW")}
                          </TableCell>
                          <TableCell>{tx.transaction.operatorName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {tx.transaction.source === "web" ? "Web" : "LINE"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {new Date(tx.transaction.transactionTime).toLocaleString("zh-TW")}
                          </TableCell>
                          <TableCell className="text-right">
                            {canCancel(tx.transaction) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-500 hover:text-red-700"
                                onClick={() => handleCancel(tx.transaction.id)}
                                disabled={cancelMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {(!transactions || transactions.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8 text-slate-500">
                          沒有找到交易記錄
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}

        {!selectedStoreId && (
          <Card>
            <CardContent className="py-12 text-center text-slate-500">
              請先選擇分店以查看交易記錄
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
