import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import {
  Package,
  Store,
  ArrowDownToLine,
  FileText,
  ClipboardCheck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold text-slate-800">多倉庫進銷存管理系統</h1>
          <p className="text-slate-600 text-lg">請登入以繼續使用系統</p>
          <Button asChild size="lg">
            <a href={getLoginUrl()}>登入系統</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">歡迎回來，{user?.name || "使用者"}</h1>
          <p className="text-slate-600 mt-1">
            角色：{user?.role === "admin" ? "總管" : user?.role === "store_manager" ? "店長" : "一般使用者"}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <QuickActionCard
            title="商品管理"
            description="新增、編輯商品主檔"
            icon={Package}
            href="/products"
            color="bg-blue-500"
          />
          <QuickActionCard
            title="分店管理"
            description="管理分店與 LINE 群組綁定"
            icon={Store}
            href="/stores"
            color="bg-green-500"
          />
          <QuickActionCard
            title="入庫作業"
            description="記錄商品入庫"
            icon={ArrowDownToLine}
            href="/inbound"
            color="bg-purple-500"
          />
          <QuickActionCard
            title="異動單"
            description="補帳、箱散轉換"
            icon={FileText}
            href="/adjustments"
            color="bg-orange-500"
          />
          <QuickActionCard
            title="月盤點"
            description="執行庫存盤點"
            icon={ClipboardCheck}
            href="/stocktake"
            color="bg-teal-500"
          />
          <QuickActionCard
            title="庫存查詢"
            description="查看即時庫存與預警"
            icon={AlertTriangle}
            href="/inventory"
            color="bg-red-500"
          />
        </div>

        <LowStockAlerts />
      </div>
    </DashboardLayout>
  );
}

function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  color,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string;
}) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer hover:shadow-lg transition-shadow">
        <CardHeader className="flex flex-row items-center gap-4">
          <div className={`p-3 rounded-lg ${color}`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}

function LowStockAlerts() {
  const { data: lowStockItems, isLoading } = trpc.inventory.getLowStock.useQuery({});

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            庫存預警
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-slate-200 rounded w-3/4"></div>
            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!lowStockItems || lowStockItems.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-green-500" />
            庫存預警
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-600">目前沒有庫存預警項目</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          庫存預警 ({lowStockItems.length} 項)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {lowStockItems.slice(0, 5).map((item) => (
            <div
              key={`${item.inventory.storeId}-${item.inventory.productId}`}
              className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200"
            >
              <div>
                <span className="font-medium">{item.product.name}</span>
                <span className="text-slate-500 ml-2">({item.store.name})</span>
              </div>
              <div className="text-right">
                <span className="text-amber-700">
                  {item.inventory.quantityCase} 箱 / {item.inventory.quantityUnit} 散
                </span>
              </div>
            </div>
          ))}
          {lowStockItems.length > 5 && (
            <Link href="/inventory">
              <Button variant="link" className="p-0">
                查看全部 {lowStockItems.length} 項預警
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
