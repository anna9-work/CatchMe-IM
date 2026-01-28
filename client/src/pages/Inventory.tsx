import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Package, AlertTriangle, Search } from "lucide-react";

export default function Inventory() {
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: stores } = trpc.stores.list.useQuery();
  const { data: allInventory, isLoading } = trpc.inventory.getAll.useQuery();
  const { data: lowStockItems } = trpc.inventory.getLowStock.useQuery({
    storeId: selectedStoreId ? parseInt(selectedStoreId) : undefined,
  });

  const filteredInventory = allInventory?.filter((item) => {
    const matchesStore = !selectedStoreId || item.store.id === parseInt(selectedStoreId);
    const matchesSearch =
      !searchTerm ||
      item.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.product.sku.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStore && matchesSearch;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold text-slate-800">庫存查詢</h1>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">全部庫存</TabsTrigger>
            <TabsTrigger value="lowstock">
              庫存預警
              {lowStockItems && lowStockItems.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  {lowStockItems.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <Label>篩選分店</Label>
                    <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                      <SelectTrigger>
                        <SelectValue placeholder="全部分店" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部分店</SelectItem>
                        {stores?.map((store) => (
                          <SelectItem key={store.id} value={store.id.toString()}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label>搜尋商品</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <Input
                        placeholder="輸入商品名稱或 SKU..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8">載入中...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>分店</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>商品名稱</TableHead>
                        <TableHead className="text-right">箱數</TableHead>
                        <TableHead className="text-right">散數</TableHead>
                        <TableHead className="text-right">箱平均成本</TableHead>
                        <TableHead className="text-right">散平均成本</TableHead>
                        <TableHead>狀態</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInventory?.map((item) => {
                        const isLowStock =
                          item.inventory.quantityCase < item.product.safetyStockCase ||
                          item.inventory.quantityUnit < item.product.safetyStockUnit;
                        return (
                          <TableRow key={`${item.store.id}-${item.product.id}`}>
                            <TableCell>{item.store.name}</TableCell>
                            <TableCell className="font-mono">{item.product.sku}</TableCell>
                            <TableCell>{item.product.name}</TableCell>
                            <TableCell className="text-right font-medium">
                              {item.inventory.quantityCase}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {item.inventory.quantityUnit}
                            </TableCell>
                            <TableCell className="text-right">
                              ${Number(item.inventory.avgCostCase).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right">
                              ${Number(item.inventory.avgCostUnit).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              {isLowStock ? (
                                <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                                  <AlertTriangle className="h-3 w-3" />
                                  低庫存
                                </Badge>
                              ) : (
                                <Badge className="bg-green-500">正常</Badge>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredInventory?.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                            沒有找到庫存資料
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lowstock" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  庫存預警清單
                </CardTitle>
                <CardDescription>
                  以下商品庫存低於安全庫存設定
                </CardDescription>
              </CardHeader>
              <CardContent>
                {lowStockItems && lowStockItems.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>分店</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>商品名稱</TableHead>
                        <TableHead className="text-right">目前箱數</TableHead>
                        <TableHead className="text-right">安全箱數</TableHead>
                        <TableHead className="text-right">目前散數</TableHead>
                        <TableHead className="text-right">安全散數</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lowStockItems.map((item) => (
                        <TableRow
                          key={`${item.inventory.storeId}-${item.inventory.productId}`}
                          className="bg-amber-50"
                        >
                          <TableCell>{item.store.name}</TableCell>
                          <TableCell className="font-mono">{item.product.sku}</TableCell>
                          <TableCell>{item.product.name}</TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              item.inventory.quantityCase < item.product.safetyStockCase
                                ? "text-red-600"
                                : ""
                            }`}
                          >
                            {item.inventory.quantityCase}
                          </TableCell>
                          <TableCell className="text-right text-slate-500">
                            {item.product.safetyStockCase}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium ${
                              item.inventory.quantityUnit < item.product.safetyStockUnit
                                ? "text-red-600"
                                : ""
                            }`}
                          >
                            {item.inventory.quantityUnit}
                          </TableCell>
                          <TableCell className="text-right text-slate-500">
                            {item.product.safetyStockUnit}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-slate-500">
                    目前沒有庫存預警項目
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
