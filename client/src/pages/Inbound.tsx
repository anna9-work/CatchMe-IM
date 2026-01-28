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
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowDownToLine, Package, Search } from "lucide-react";
import { toast } from "sonner";

export default function Inbound() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [quantityCase, setQuantityCase] = useState("");
  const [quantityUnit, setQuantityUnit] = useState("");
  const [unitCostCase, setUnitCostCase] = useState("");
  const [unitCostUnit, setUnitCostUnit] = useState("");
  const [note, setNote] = useState("");

  const { data: stores } = trpc.stores.list.useQuery();
  const { data: products } = trpc.products.list.useQuery();
  const { data: searchResults } = trpc.products.search.useQuery(
    { keyword: searchTerm },
    { enabled: searchTerm.length > 0 }
  );

  const inboundMutation = trpc.inbound.create.useMutation({
    onSuccess: () => {
      toast.success("入庫成功");
      // 重置表單
      setQuantityCase("");
      setQuantityUnit("");
      setUnitCostCase("");
      setUnitCostUnit("");
      setNote("");
    },
    onError: (error) => {
      toast.error(`入庫失敗：${error.message}`);
    },
  });

  const selectedProduct = products?.find((p) => p.id === parseInt(selectedProductId));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedStoreId || !selectedProductId) {
      toast.error("請選擇分店和商品");
      return;
    }

    const qtyCase = parseInt(quantityCase) || 0;
    const qtyUnit = parseInt(quantityUnit) || 0;

    if (qtyCase === 0 && qtyUnit === 0) {
      toast.error("入庫數量不能為零");
      return;
    }

    inboundMutation.mutate({
      storeId: parseInt(selectedStoreId),
      productId: parseInt(selectedProductId),
      quantityCase: qtyCase,
      quantityUnit: qtyUnit,
      unitCostCase: unitCostCase || undefined,
      unitCostUnit: unitCostUnit || undefined,
      note: note || undefined,
    });
  };

  const displayProducts = searchTerm.length > 0 ? searchResults : products?.slice(0, 20);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <ArrowDownToLine className="h-8 w-8 text-purple-500" />
          <h1 className="text-3xl font-bold text-slate-800">入庫作業</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 入庫表單 */}
          <Card>
            <CardHeader>
              <CardTitle>新增入庫</CardTitle>
              <CardDescription>記錄商品入庫數量與成本</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>選擇分店 *</Label>
                  <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                    <SelectTrigger>
                      <SelectValue placeholder="請選擇分店" />
                    </SelectTrigger>
                    <SelectContent>
                      {stores?.map((store) => (
                        <SelectItem key={store.id} value={store.id.toString()}>
                          {store.name} ({store.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>搜尋商品</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="輸入商品名稱搜尋..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>選擇商品 *</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="請選擇商品" />
                    </SelectTrigger>
                    <SelectContent>
                      {displayProducts?.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          [{product.sku}] {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProduct && (
                  <div className="p-3 bg-slate-50 rounded-lg text-sm">
                    <p>
                      <strong>商品：</strong>
                      {selectedProduct.name}
                    </p>
                    <p>
                      <strong>SKU：</strong>
                      {selectedProduct.sku}
                    </p>
                    <p>
                      <strong>箱入數：</strong>
                      {selectedProduct.unitsPerCase}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quantityCase">入庫箱數</Label>
                    <Input
                      id="quantityCase"
                      type="number"
                      min="0"
                      value={quantityCase}
                      onChange={(e) => setQuantityCase(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantityUnit">入庫散數</Label>
                    <Input
                      id="quantityUnit"
                      type="number"
                      min="0"
                      value={quantityUnit}
                      onChange={(e) => setQuantityUnit(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unitCostCase">箱單位成本</Label>
                    <Input
                      id="unitCostCase"
                      type="number"
                      step="0.01"
                      min="0"
                      value={unitCostCase}
                      onChange={(e) => setUnitCostCase(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unitCostUnit">散單位成本</Label>
                    <Input
                      id="unitCostUnit"
                      type="number"
                      step="0.01"
                      min="0"
                      value={unitCostUnit}
                      onChange={(e) => setUnitCostUnit(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="note">備註</Label>
                  <Textarea
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="選填"
                    rows={2}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={inboundMutation.isPending}>
                  {inboundMutation.isPending ? "處理中..." : "確認入庫"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* 入庫說明 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                入庫說明
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-semibold">箱/散獨立管理</h4>
                <p className="text-sm text-slate-600">
                  系統採用箱數與散數獨立管理，入庫時請分別填寫箱數和散數。
                  箱與散之間不會自動轉換，如需轉換請使用異動單功能。
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">成本計算</h4>
                <p className="text-sm text-slate-600">
                  系統採用加權平均成本法計算庫存成本。每次入庫時輸入的單位成本會與現有庫存成本加權平均。
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">業務日區間</h4>
                <p className="text-sm text-slate-600">
                  業務日為每日 05:00 至隔日 04:59:59。凌晨 00:00~04:59 的入庫會記錄在前一天的業務日。
                </p>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  <strong>提示：</strong>
                  如需補帳（補錄過去日期的入庫），請使用「異動單」功能，選擇「補入庫」類型。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
