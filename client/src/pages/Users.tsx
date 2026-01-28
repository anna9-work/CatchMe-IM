import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Users as UsersIcon, Pencil, Shield, Store } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const roleLabels: Record<string, { label: string; color: string }> = {
  admin: { label: "總管", color: "bg-purple-500" },
  store_manager: { label: "店長", color: "bg-blue-500" },
  user: { label: "一般使用者", color: "bg-slate-500" },
};

export default function Users() {
  const { user: currentUser } = useAuth();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");

  const { data: users, isLoading, refetch } = trpc.users.list.useQuery();
  const { data: stores } = trpc.stores.list.useQuery();

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("使用者角色已更新");
      setIsEditOpen(false);
      setEditingUser(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`更新失敗：${error.message}`);
    },
  });

  const handleEditRole = (user: any) => {
    setEditingUser(user);
    setSelectedRole(user.role);
    setSelectedStoreId(user.storeId?.toString() || "");
    setIsEditOpen(true);
  };

  const handleUpdateRole = () => {
    if (!editingUser || !selectedRole) return;

    updateRoleMutation.mutate({
      userId: editingUser.id,
      role: selectedRole as "user" | "admin" | "store_manager",
      storeId: selectedStoreId ? parseInt(selectedStoreId) : undefined,
    });
  };

  const isAdmin = currentUser?.role === "admin";

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <Shield className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <h2 className="text-xl font-semibold mb-2">權限不足</h2>
              <p className="text-slate-600">只有總管可以管理使用者</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <UsersIcon className="h-8 w-8 text-indigo-500" />
          <h1 className="text-3xl font-bold text-slate-800">使用者管理</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>使用者列表</CardTitle>
            <CardDescription>管理系統使用者的角色與權限</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">載入中...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>名稱</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>角色</TableHead>
                    <TableHead>所屬分店</TableHead>
                    <TableHead>最後登入</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.map((user) => {
                    const roleInfo = roleLabels[user.role] || roleLabels.user;
                    const userStore = stores?.find((s) => s.id === user.storeId);
                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-mono">#{user.id}</TableCell>
                        <TableCell className="font-medium">{user.name || "-"}</TableCell>
                        <TableCell>{user.email || "-"}</TableCell>
                        <TableCell>
                          <Badge className={roleInfo.color}>{roleInfo.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {userStore ? (
                            <div className="flex items-center gap-1">
                              <Store className="h-3 w-3" />
                              {userStore.name}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(user.lastSignedIn).toLocaleString("zh-TW")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditRole(user)}
                            disabled={user.id === currentUser?.id}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!users || users.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                        尚無使用者資料
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 編輯角色對話框 */}
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>編輯使用者角色</DialogTitle>
              <DialogDescription>
                設定 {editingUser?.name || editingUser?.email} 的角色與權限
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>角色</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">總管（可管理所有分店）</SelectItem>
                    <SelectItem value="store_manager">店長（僅能操作所屬分店）</SelectItem>
                    <SelectItem value="user">一般使用者（僅能查看）</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedRole === "store_manager" && (
                <div className="space-y-2">
                  <Label>所屬分店</Label>
                  <Select value={selectedStoreId} onValueChange={setSelectedStoreId}>
                    <SelectTrigger>
                      <SelectValue placeholder="選擇分店" />
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
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                取消
              </Button>
              <Button onClick={handleUpdateRole} disabled={updateRoleMutation.isPending}>
                {updateRoleMutation.isPending ? "更新中..." : "更新"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
