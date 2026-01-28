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
import { ClipboardCheck, Plus, Check } from "lucide-react";
import { toast } from "sonner";

interface StockTakeItem {
  productId: number;
  productName: string;
  productSku: string;
  systemCase: number;
  systemUnit: number;
  actualCase: number;
  actualUnit: number;
}

export default function StockTake() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [stocktakeDate, setStocktakeDate] = useState(new Date().toISOString().split("T")[0]);
  const [stocktakeMonth, setStocktakeMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [items, setItems] = useState<StockTakeItem[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const { data: stores } = trpc.stores.list.useQuery();
  const { data: inventory } = trpc.inventory.getByStore.useQuery(
    { storeId: parseInt(selectedStoreId) },
    { enabled: !!selectedStoreId }
  );
  const { data: stocktakes, refetch } = trpc.stocktakes.list.useQuery(
    { storeId: parseInt(selectedStoreId) },
    { enabled: !!selectedStoreId }
  );

  const createMutation = trpc.stocktakes.create.useMutation({
    onSuccess: () => {
      toast.success("盤點記錄已建立");
      setIsCreating(false);
      setItems([]);
      refetch();
    },
    onError: (error) => {
      toast.error(`建立失敗：${error.message}`);
    },
  });

  const completeMutation = trpc.stocktakes.complete.useMutation({
    onSuccess: () => {
      toast.success("盤點已完成，庫存已調整");
      refetch();
    },
    onError: (error) => {
      toast.error(`完成失敗：${error.message}`);
    },
  });

  const handleStartStockTake = () => {
    if (!selectedStoreId) {
      toast.error("請先選擇分店");
      return;
    }

    if (!inventory || inventory.length === 0) {
      toast.error("該分店沒有庫存資料");
      return;
    }

    const initialItems: StockTakeItem[] = inventory.map((inv) => ({
      productId: inv.product.id,
      productName: inv.product.name,
      productSku: inv.product.sku,
      systemCase: inv.inventory.quantityCase,
      systemUnit: inv.inventory.quantityUnit,
      actualCase: inv.inventory.quantityCase,
      actualUnit: inv.inventory.quantityUnit,
    }));

    setItems(initialItems);
    setIsCreating(true);
  };

  const handleUpdateItem = (
    index: number,
    field: "actualCase" | "actualUnit",
    value: number
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleSubmit = () => {
    if (items.length === 0) {
      toast.error("沒有盤點項目");
      return;
    }

    createMutation.mutate({
      storeId: parseInt(selectedStoreId),
      stocktakeDate,
      month: stocktakeMonth,
      items: items.map((item) => ({
        productId: item.productId,
        systemCase: item.systemCase,
        systemUnit: item.systemUnit,
        actualCase: item.actualCase,
        actualUnit: item.actualUnit,
      })),
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="h-8 w-8 text-teal-500" />
          <h1 className="text-3xl font-bold text-slate-800">月盤點</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>選擇分店</Label>
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
            <Label>盤點日期</Label>
            <Input
              type="date"
              value={stocktakeDate}
              onChange={(e) => setStocktakeDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>盤點月份</Label>
            <Input
              type="month"
              value={stocktakeMonth}
              onChange={(e) => setStocktakeMonth(e.target.value)}
            />
          </div>
        </div>

        {!isCreating ? (
          <div className="space-y-6">
            <Button onClick={handleStartStockTake} disabled={!selectedStoreId}>
              <Plus className="h-4 w-4 mr-2" />
              開始新盤點
            </Button>

            {selectedStoreId && stocktakes && stocktakes.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>歷史盤點記錄</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>月份</TableHead>
                        <TableHead>盤點日期</TableHead>
                        <TableHead>建立人</TableHead>
                        <TableHead>狀態</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stocktakes.map((st) => (
                        <TableRow key={st.id}>
                          <TableCell className="font-mono">#{st.id}</TableCell>
                          <TableCell>{st.month}</TableCell>
                          <TableCell>
                            {new Date(st.stocktakeDate).toLocaleDateString("zh-TW")}
                          </TableCell>
                          <TableCell>{st.createdByName}</TableCell>
                          <TableCell>
                            <Badge
                              className={
                                st.status === "completed" ? "bg-green-500" : "bg-amber-500"
                              }
                            >
                              {st.status === "completed" ? "已完成" : "草稿"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {st.status === "draft" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm("確定要完成此盤點並調整庫存嗎？")) {
                                    completeMutation.mutate({ id: st.id });
                                  }
                                }}
                                disabled={completeMutation.isPending}
                              >
                                <Check className="h-4 w-4 mr-1" />
                                完成盤點
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>盤點作業</CardTitle>
              <CardDescription>
                請輸入實際盤點數量，系統會自動計算差異
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>商品名稱</TableHead>
                    <TableHead className="text-right">系統箱數</TableHead>
                    <TableHead className="text-right">系統散數</TableHead>
                    <TableHead className="text-right">實際箱數</TableHead>
                    <TableHead className="text-right">實際散數</TableHead>
                    <TableHead className="text-right">差異（箱）</TableHead>
                    <TableHead className="text-right">差異（散）</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const diffCase = item.actualCase - item.systemCase;
                    const diffUnit = item.actualUnit - item.systemUnit;
                    return (
                      <TableRow key={item.productId}>
                        <TableCell className="font-mono">{item.productSku}</TableCell>
                        <TableCell>{item.productName}</TableCell>
                        <TableCell className="text-right">{item.systemCase}</TableCell>
                        <TableCell className="text-right">{item.systemUnit}</TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            value={item.actualCase}
                            onChange={(e) =>
                              handleUpdateItem(index, "actualCase", parseInt(e.target.value) || 0)
                            }
                            className="w-20 text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            value={item.actualUnit}
                            onChange={(e) =>
                              handleUpdateItem(index, "actualUnit", parseInt(e.target.value) || 0)
                            }
                            className="w-20 text-right"
                          />
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            diffCase > 0
                              ? "text-green-600"
                              : diffCase < 0
                              ? "text-red-600"
                              : ""
                          }`}
                        >
                          {diffCase > 0 ? `+${diffCase}` : diffCase}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            diffUnit > 0
                              ? "text-green-600"
                              : diffUnit < 0
                              ? "text-red-600"
                              : ""
                          }`}
                        >
                          {diffUnit > 0 ? `+${diffUnit}` : diffUnit}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              <div className="flex justify-end gap-4 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setItems([]);
                  }}
                >
                  取消
                </Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                  {createMutation.isPending ? "儲存中..." : "儲存盤點記錄"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
