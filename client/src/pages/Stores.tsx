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
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Plus, Pencil, Trash2, Store } from "lucide-react";
import { toast } from "sonner";

export default function Stores() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<any>(null);

  const { data: stores, isLoading, refetch } = trpc.stores.list.useQuery();
  const createMutation = trpc.stores.create.useMutation({
    onSuccess: () => {
      toast.success("分店建立成功");
      setIsCreateOpen(false);
      refetch();
    },
    onError: (error) => {
      toast.error(`建立失敗：${error.message}`);
    },
  });
  const updateMutation = trpc.stores.update.useMutation({
    onSuccess: () => {
      toast.success("分店更新成功");
      setIsEditOpen(false);
      setEditingStore(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`更新失敗：${error.message}`);
    },
  });
  const deleteMutation = trpc.stores.delete.useMutation({
    onSuccess: () => {
      toast.success("分店已停用");
      refetch();
    },
    onError: (error) => {
      toast.error(`停用失敗：${error.message}`);
    },
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    createMutation.mutate({
      code: formData.get("code") as string,
      name: formData.get("name") as string,
      address: (formData.get("address") as string) || undefined,
      phone: (formData.get("phone") as string) || undefined,
      lineGroupId: (formData.get("lineGroupId") as string) || undefined,
    });
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingStore) return;
    const formData = new FormData(e.currentTarget);
    updateMutation.mutate({
      id: editingStore.id,
      code: formData.get("code") as string,
      name: formData.get("name") as string,
      address: (formData.get("address") as string) || undefined,
      phone: (formData.get("phone") as string) || undefined,
      lineGroupId: (formData.get("lineGroupId") as string) || undefined,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-800">分店管理</h1>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新增分店
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>新增分店</DialogTitle>
                <DialogDescription>填寫分店基本資料</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">分店代碼 *</Label>
                    <Input id="code" name="code" required placeholder="如：STORE01" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">分店名稱 *</Label>
                    <Input id="name" name="name" required placeholder="如：台北總店" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">地址</Label>
                  <Input id="address" name="address" placeholder="選填" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">電話</Label>
                  <Input id="phone" name="phone" placeholder="選填" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lineGroupId">LINE 群組 ID</Label>
                  <Input id="lineGroupId" name="lineGroupId" placeholder="用於 LINE Bot 綁定" />
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
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              分店列表
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">載入中...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>代碼</TableHead>
                    <TableHead>名稱</TableHead>
                    <TableHead>地址</TableHead>
                    <TableHead>電話</TableHead>
                    <TableHead>LINE 群組</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stores?.map((store) => (
                    <TableRow key={store.id}>
                      <TableCell className="font-mono">{store.code}</TableCell>
                      <TableCell className="font-medium">{store.name}</TableCell>
                      <TableCell>{store.address || "-"}</TableCell>
                      <TableCell>{store.phone || "-"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {store.lineGroupId ? (
                          <Badge variant="outline" className="bg-green-50">
                            已綁定
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-slate-50">
                            未綁定
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {store.isActive ? (
                          <Badge className="bg-green-500">啟用</Badge>
                        ) : (
                          <Badge variant="secondary">停用</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingStore(store);
                              setIsEditOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("確定要停用此分店嗎？")) {
                                deleteMutation.mutate({ id: store.id });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {stores?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        尚無分店資料
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
              <DialogTitle>編輯分店</DialogTitle>
              <DialogDescription>修改分店資料</DialogDescription>
            </DialogHeader>
            {editingStore && (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-code">分店代碼 *</Label>
                    <Input id="edit-code" name="code" required defaultValue={editingStore.code} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">分店名稱 *</Label>
                    <Input id="edit-name" name="name" required defaultValue={editingStore.name} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-address">地址</Label>
                  <Input id="edit-address" name="address" defaultValue={editingStore.address || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-phone">電話</Label>
                  <Input id="edit-phone" name="phone" defaultValue={editingStore.phone || ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-lineGroupId">LINE 群組 ID</Label>
                  <Input
                    id="edit-lineGroupId"
                    name="lineGroupId"
                    defaultValue={editingStore.lineGroupId || ""}
                    placeholder="用於 LINE Bot 綁定"
                  />
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
