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
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { FileText, Plus, Check, X, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

const adjustmentTypeLabels: Record<string, string> = {
  补出库: "補出庫",
  补入库: "補入庫",
  箱散转换: "箱散轉換",
};

const statusLabels: Record<string, string> = {
  pending: "待審核",
  approved: "已核准",
  rejected: "已拒絕",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-500",
  approved: "bg-green-500",
  rejected: "bg-red-500",
};

export default function Adjustments() {
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("");
  const [adjustmentDate, setAdjustmentDate] = useState("");
  const [reason, setReason] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantityCase, setQuantityCase] = useState("");
  const [quantityUnit, setQuantityUnit] = useState("");
  const [unitCostCase, setUnitCostCase] = useState("");
  const [unitCostUnit, setUnitCostUnit] = useState("");
  const [fromCase, setFromCase] = useState("");
  const [toUnit, setToUnit] = useState("");
  const [fromUnit, setFromUnit] = useState("");
  const [toCase, setToCase] = useState("");

  const { data: stores } = trpc.stores.list.useQuery();
  const { data: products } = trpc.products.list.useQuery();
  const { data: adjustments, refetch } = trpc.adjustments.list.useQuery({});

  const createMutation = trpc.adjustments.create.useMutation({
    onSuccess: () => {
      toast.success("異動單建立成功，等待審核");
      setIsCreateOpen(false);
      resetForm();
      refetch();
    },
    onError: (error) => {
      toast.error(`建立失敗：${error.message}`);
    },
  });

  const approveMutation = trpc.adjustments.approve.useMutation({
    onSuccess: () => {
      toast.success("異動單已核准並執行");
      refetch();
    },
    onError: (error) => {
      toast.error(`核准失敗：${error.message}`);
    },
  });

  const rejectMutation = trpc.adjustments.reject.useMutation({
    onSuccess: () => {
      toast.success("異動單已拒絕");
      refetch();
    },
    onError: (error) => {
      toast.error(`拒絕失敗：${error.message}`);
    },
  });

  const resetForm = () => {
    setSelectedType("");
    setSelectedStoreId("");
    setAdjustmentDate("");
    setReason("");
    setSelectedProductId("");
    setQuantityCase("");
    setQuantityUnit("");
    setUnitCostCase("");
    setUnitCostUnit("");
    setFromCase("");
    setToUnit("");
    setFromUnit("");
    setToCase("");
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedType || !selectedStoreId || !adjustmentDate || !selectedProductId) {
      toast.error("請填寫必要欄位");
      return;
    }

    const items = [
      {
        productId: parseInt(selectedProductId),
        quantityCase: parseInt(quantityCase) || 0,
        quantityUnit: parseInt(quantityUnit) || 0,
        unitCostCase: unitCostCase || undefined,
        unitCostUnit: unitCostUnit || undefined,
        fromCase: parseInt(fromCase) || undefined,
        toUnit: parseInt(toUnit) || undefined,
        fromUnit: parseInt(fromUnit) || undefined,
        toCase: parseInt(toCase) || undefined,
      },
    ];

    createMutation.mutate({
      storeId: parseInt(selectedStoreId),
      type: selectedType as "补出库" | "补入库" | "箱散转换",
      adjustmentDate,
      reason: reason || undefined,
      items,
    });
  };

  const isAdmin = user?.role === "admin";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-8 w-8 text-orange-500" />
            <h1 className="text-3xl font-bold text-slate-800">異動單管理</h1>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                新增異動單
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>新增異動單</DialogTitle>
                <DialogDescription>建立補帳或箱散轉換申請</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>異動類型 *</Label>
                    <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger>
                        <SelectValue placeholder="請選擇" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="补入库">補入庫</SelectItem>
                        <SelectItem value="补出库">補出庫</SelectItem>
                        <SelectItem value="箱散转换">箱散轉換</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>異動日期 *</Label>
                    <Input
                      type="date"
                      value={adjustmentDate}
                      onChange={(e) => setAdjustmentDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>分店 *</Label>
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
                  <Label>商品 *</Label>
                  <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="請選擇商品" />
                    </SelectTrigger>
                    <SelectContent>
                      {products?.map((product) => (
                        <SelectItem key={product.id} value={product.id.toString()}>
                          [{product.sku}] {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedType === "箱散转换" ? (
                  <div className="space-y-4">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-600 mb-3">箱轉散（拆箱）</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>從箱數</Label>
                          <Input
                            type="number"
                            min="0"
                            value={fromCase}
                            onChange={(e) => setFromCase(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>轉為散數</Label>
                          <Input
                            type="number"
                            min="0"
                            value={toUnit}
                            onChange={(e) => setToUnit(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-sm text-slate-600 mb-3">散轉箱（併箱）</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>從散數</Label>
                          <Input
                            type="number"
                            min="0"
                            value={fromUnit}
                            onChange={(e) => setFromUnit(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>轉為箱數</Label>
                          <Input
                            type="number"
                            min="0"
                            value={toCase}
                            onChange={(e) => setToCase(e.target.value)}
                            placeholder="0"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>箱數</Label>
                        <Input
                          type="number"
                          min="0"
                          value={quantityCase}
                          onChange={(e) => setQuantityCase(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>散數</Label>
                        <Input
                          type="number"
                          min="0"
                          value={quantityUnit}
                          onChange={(e) => setQuantityUnit(e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    </div>
                    {selectedType === "补入库" && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>箱單位成本</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={unitCostCase}
                            onChange={(e) => setUnitCostCase(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>散單位成本</Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={unitCostUnit}
                            onChange={(e) => setUnitCostUnit(e.target.value)}
                            placeholder="0.00"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>異動原因</Label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="請說明異動原因"
                    rows={2}
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    取消
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? "建立中..." : "提交申請"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>異動單列表</CardTitle>
            <CardDescription>
              {isAdmin ? "審核待處理的異動單" : "查看異動單狀態"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>類型</TableHead>
                  <TableHead>分店</TableHead>
                  <TableHead>異動日期</TableHead>
                  <TableHead>申請人</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>建立時間</TableHead>
                  {isAdmin && <TableHead className="text-right">操作</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {adjustments?.map((item: any) => {
                  const adj = item.adjustment || item;
                  const store = item.store;
                  return (
                    <TableRow key={adj.id}>
                      <TableCell className="font-mono">#{adj.id}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {adjustmentTypeLabels[adj.type] || adj.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{store?.name || "-"}</TableCell>
                      <TableCell>
                        {new Date(adj.adjustmentDate).toLocaleDateString("zh-TW")}
                      </TableCell>
                      <TableCell>{adj.createdByName}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[adj.status]}>
                          {statusLabels[adj.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(adj.createdAt).toLocaleString("zh-TW")}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          {adj.status === "pending" && (
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-green-600 hover:text-green-700"
                                onClick={() => {
                                  if (confirm("確定要核准此異動單嗎？")) {
                                    approveMutation.mutate({ id: adj.id });
                                  }
                                }}
                                disabled={approveMutation.isPending}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => {
                                  if (confirm("確定要拒絕此異動單嗎？")) {
                                    rejectMutation.mutate({ id: adj.id });
                                  }
                                }}
                                disabled={rejectMutation.isPending}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {(!adjustments || adjustments.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-slate-500">
                      尚無異動單
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
