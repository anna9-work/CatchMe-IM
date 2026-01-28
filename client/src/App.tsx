import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Products from "./pages/Products";
import Stores from "./pages/Stores";
import Inbound from "./pages/Inbound";
import Adjustments from "./pages/Adjustments";
import StockTake from "./pages/StockTake";
import Inventory from "./pages/Inventory";
import Transactions from "./pages/Transactions";
import Users from "./pages/Users";
import DashboardLayout from "./components/DashboardLayout";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/products" component={Products} />
      <Route path="/stores" component={Stores} />
      <Route path="/inbound" component={Inbound} />
      <Route path="/adjustments" component={Adjustments} />
      <Route path="/stocktake" component={StockTake} />
      <Route path="/inventory" component={Inventory} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/users" component={Users} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
