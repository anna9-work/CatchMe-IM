import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export default function Products() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: products, isLoading, refetch } = trpc.products.list.useQuery();
  const createMutation = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("商品建立成功");
      setIsCreateOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`建立失敗：${error.message}`);
    },
  });
  const updateMutation = trpc.products.update.useMutation({
    onSuccess: () => {
      toast.success("商品更新成功");
      setIsEditOpen(false);
      setEditingProduct(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`更新失敗：${error.message}`);
    },
  });
  const deleteMutation = trpc.products.delete.useMutation({
    onSuccess: () => {
      toast.success("商品已刪除");
      refetch();
    },
    onError: (error) => {
      toast.error(`刪除失敗：${error.message}`);
    },
  });

  const filteredProducts = products?.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.includes(searchTerm))
  );

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      sku: formData.get("sku") as string,
      name: formData.get("name") as string,
      barcode: (formData.get("barcode") as string) || undefined,
      unitsPerCase: parseInt(formData.get("unitsPerCase") as string) || 1,
      unitPrice: formData.get("unitPrice") as string || "0",
      safetyStockCase: parseInt(formData.get("safetyStockCase") as string) || 0,
      safetyStockUnit: parseInt(formData.get("safetyStockUnit") as string) || 0,
      category: (formData.get("category") as string) || undefined,
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingProduct) return;
    const formData = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editingProduct.id,
      sku: formData.get("sku") as string,
      name: formData.get("name") as string,
      barcode: (formData.get("barcode") as string) || undefined,
      unitsPerCase: parseInt(formData.get("unitsPerCase") as string) || 1,
      unitPrice: formData.get("unitPrice") as string || "0",
      safetyStockCase: parseInt(formData.get("safetyStockCase") as string) || 0,
      safetyStockUnit: parseInt(formData.get("safetyStockUnit") as string) || 0,
      category: (formData.get("category") as string) || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-800">商品管理</h1>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新增商品
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>新增商品</DialogTitle>
                <DialogDescription>填寫商品基本資料</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sku">SKU 編號 *</Label>
                    <Input id="sku" name="sku" required placeholder="如：BC191" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="barcode">條碼</Label>
                    <Input id="barcode" name="barcode" placeholder="選填" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">商品名稱 *</Label>
                  <Input id="name" name="name" required placeholder="如：海底撈胖胖酥-麻辣風味55g" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="unitsPerCase">箱入數</Label>
                    <Input id="unitsPerCase" name="unitsPerCase" type="number" min="1" defaultValue="1" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unitPrice">單價</Label>
                    <Input id="unitPrice" name="unitPrice" type="number" step="0.01" defaultValue="0" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="safetyStockCase">安全庫存（箱）</Label>
                    <Input id="safetyStockCase" name="safetyStockCase" type="number" min="0" defaultValue="0" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="safetyStockUnit">安全庫存（散）</Label>
                    <Input id="safetyStockUnit" name="safetyStockUnit" type="number" min="0" defaultValue="0" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">分類</Label>
                  <Input id="category" name="category" placeholder="選填" />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    取消
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "建立中..." : "建立"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜尋商品名稱、SKU 或條碼..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
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
                    <TableHead>SKU</TableHead>
                    <TableHead>商品名稱</TableHead>
                    <TableHead>條碼</TableHead>
                    <TableHead className="text-right">箱入數</TableHead>
                    <TableHead className="text-right">單價</TableHead>
                    <TableHead className="text-right">安全庫存</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts?.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-mono">{product.sku}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell className="font-mono">{product.barcode || "-"}</TableCell>
                      <TableCell className="text-right">{product.unitsPerCase}</TableCell>
                      <TableCell className="text-right">${product.unitPrice}</TableCell>
                      <TableCell className="text-right">
                        {product.safetyStockCase}箱 / {product.safetyStockUnit}散
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingProduct(product);
                              setIsEditOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("確定要刪除此商品嗎？")) {
                                deleteMutation.mutate({ id: product.id });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredProducts?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        沒有找到商品
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 編輯對話框 */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>編輯商品</DialogTitle>
              <DialogDescription>修改商品資料</DialogDescription>
            </DialogHeader>
            {editingProduct && (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-sku">SKU 編號 *</Label>
                    <Input id="edit-sku" name="sku" required defaultValue={editingProduct.sku} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-barcode">條碼</Label>
                    <Input id="edit-barcode" name="barcode" defaultValue={editingProduct.barcode || ""} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-name">商品名稱 *</Label>
                  <Input id="edit-name" name="name" required defaultValue={editingProduct.name} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-unitsPerCase">箱入數</Label>
                    <Input
                      id="edit-unitsPerCase"
                      name="unitsPerCase"
                      type="number"
                      min="1"
                      defaultValue={editingProduct.unitsPerCase}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-unitPrice">單價</Label>
                    <Input
                      id="edit-unitPrice"
                      name="unitPrice"
                      type="number"
                      step="0.01"
                      defaultValue={editingProduct.unitPrice}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-safetyStockCase">安全庫存（箱）</Label>
                    <Input
                      id="edit-safetyStockCase"
                      name="safetyStockCase"
                      type="number"
                      min="0"
                      defaultValue={editingProduct.safetyStockCase}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-safetyStockUnit">安全庫存（散）</Label>
                    <Input
                      id="edit-safetyStockUnit"
                      name="safetyStockUnit"
                      type="number"
                      min="0"
                      defaultValue={editingProduct.safetyStockUnit}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-category">分類</Label>
                  <Input id="edit-category" name="category" defaultValue={editingProduct.category || ""} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                    取消
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "更新中..." : "更新"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
