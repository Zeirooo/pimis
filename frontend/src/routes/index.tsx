import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { createFileRoute, Link, Navigate, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Download } from "lucide-react";
import { toast } from "sonner";
import { useMedicines, usePredictions, usePurchaseOrders } from "@/hooks/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { fadeInUp, listItem, staggerContainer } from "@/lib/motion";

// Hoisted so the two summary-card buttons share one object identity instead
// of allocating a fresh literal on every render.
const SUMMARY_CARD_TAP = { scale: 0.98 };

export const Route = createFileRoute("/")({
  component: DashboardRoute,
});

function DashboardRoute() {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (!user) {
    return <Navigate to="/login" search={{ redirect: pathname }} replace />;
  }

  return <DashboardPage />;
}

type StockStatus = "Critical" | "Low Stock" | "Overstock" | "Healthy";

interface ForecastPoint {
  day: string;
  actual: number | null;
  predicted: number;
}

interface CategoryBar {
  name: string;
  value: number;
  color: string;
  style: CSSProperties;
}

interface ReportRow {
  sku: string;
  name: string;
  form: string;
  currentStock: number;
  predictedDemand7d: number;
  status: StockStatus;
}

const FALLBACK_FORECAST_DATA: ForecastPoint[] = [
  { day: "D1", actual: 640, predicted: 632 },
  { day: "D2", actual: 624, predicted: 618 },
  { day: "D3", actual: 612, predicted: 606 },
  { day: "D4", actual: 598, predicted: 594 },
  { day: "D5", actual: 586, predicted: 580 },
  { day: "D6", actual: 572, predicted: 568 },
  { day: "D7", actual: 560, predicted: 555 },
  { day: "D8", actual: null, predicted: 548 },
  { day: "D9", actual: null, predicted: 540 },
  { day: "D10", actual: null, predicted: 533 },
];

const STATUS_CONFIG: Record<StockStatus, { label: string; className: string }> = {
  Critical: {
    label: "Critical",
    className: "bg-critical-soft text-critical border-critical/20",
  },
  "Low Stock": {
    label: "Low Stock",
    className: "bg-warning-soft text-warning border-warning/20",
  },
  Overstock: {
    label: "Overstock",
    className: "bg-info-soft text-info border-info/20",
  },
  Healthy: {
    label: "Healthy",
    className: "bg-success-soft text-success border-success/20",
  },
};

const CATEGORY_COLORS = ["#10b981", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6"];

type DashboardPanel = "restock" | "draftPos" | null;

type RestockAlertMedicine = {
  id: number;
  name: string;
  currentStock: number;
  safetyStockLevel: number;
  isCritical: boolean;
};

type DraftPurchaseOrder = {
  id: number;
  poNumber: string;
  createdAt: string;
  itemCount: number;
};

const FALLBACK_TABLE_ROWS: ReportRow[] = [
  {
    sku: "MED-0001",
    name: "Paracetamol 500mg",
    form: "Tablet · Box of 100",
    currentStock: 30,
    predictedDemand7d: 140,
    status: "Low Stock",
  },
  {
    sku: "MED-0002",
    name: "Amoxicillin 500mg",
    form: "Capsule · Strip of 10",
    currentStock: 12,
    predictedDemand7d: 80,
    status: "Critical",
  },
  {
    sku: "MED-0003",
    name: "Metformin 500mg",
    form: "Tablet · Bottle of 60",
    currentStock: 220,
    predictedDemand7d: 150,
    status: "Overstock",
  },
  {
    sku: "MED-0004",
    name: "Amlodipine 5mg",
    form: "Tablet · Strip of 30",
    currentStock: 75,
    predictedDemand7d: 70,
    status: "Healthy",
  },
  {
    sku: "MED-0005",
    name: "Omeprazole 20mg",
    form: "Capsule · Box of 50",
    currentStock: 18,
    predictedDemand7d: 90,
    status: "Low Stock",
  },
];

function renderCategoryProgress(item: CategoryBar) {
  return (
    <div key={item.name} className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{item.name}</span>
        <span className="font-medium text-foreground">{item.value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div className="h-1.5 rounded-full" style={item.style} />
      </div>
    </div>
  );
}

function renderCompactWorklistRow(row: ReportRow) {
  const config = STATUS_CONFIG[row.status];

  function handleReviewClick() {
    toast.success(`Review action triggered for ${row.name}.`);
  }

  return (
    <motion.div
      key={row.sku}
      variants={listItem}
      className="flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-background/70 px-3 py-2.5"
    >
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{row.name}</p>
          <Badge variant="outline" className={config.className}>
            {config.label}
          </Badge>
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          {row.sku} · {row.form}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-4 text-right">
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Stock</div>
          <div className="text-sm font-semibold tabular-nums text-foreground">
            {row.currentStock}
          </div>
        </div>
        <div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">7d need</div>
          <div className="text-sm font-semibold tabular-nums text-foreground">
            {row.predictedDemand7d}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReviewClick}
          className="gap-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <span>Review</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

function formatDisplayDate(isoDate: string): string {
  const parsedDate = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsedDate.getTime())) return isoDate;
  return parsedDate.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function SummaryCardLink({
  to,
  search,
  className,
  children,
}: {
  to: string;
  search?: Record<string, string>;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      to={to as never}
      search={search as never}
      className={`group block h-full rounded-2xl border border-border/70 bg-card/90 p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${className ?? ""}`}
    >
      {children}
    </Link>
  );
}

function DashboardSnapshot({
  totalMedicines,
  lowStockCount,
  pendingDraftPoCount,
  restockAlertMedicines,
  draftPurchaseOrders,
  expandedPanel,
  onTogglePanel,
}: {
  totalMedicines: number;
  lowStockCount: number;
  pendingDraftPoCount: number | null;
  restockAlertMedicines: RestockAlertMedicine[];
  draftPurchaseOrders: DraftPurchaseOrder[];
  expandedPanel: DashboardPanel;
  onTogglePanel: (panel: DashboardPanel) => void;
}) {
  const overlayOpen = expandedPanel !== null;

  return (
    <div className="relative">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid gap-3 md:grid-cols-2 lg:grid-cols-12"
      >
        <motion.div variants={listItem} className="order-2 md:order-2 lg:col-span-3">
          <SummaryCardLink
            to="/inventory"
            search={{ focus: "all" }}
            className="border-success/25 bg-success-soft/45"
          >
            <div className="flex h-full flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-success">
                    Medicines
                  </div>
                </div>
                <div className="rounded-full bg-success-soft px-2.5 py-0.5 text-[10px] font-semibold text-success">
                  Inventory
                </div>
              </div>

              <div className="text-[2rem] font-semibold tabular-nums tracking-tight text-foreground lg:text-[2.15rem]">
                {totalMedicines.toLocaleString()}
              </div>
            </div>
          </SummaryCardLink>
        </motion.div>

        <motion.button
          variants={listItem}
          whileTap={SUMMARY_CARD_TAP}
          type="button"
          onClick={() => onTogglePanel(expandedPanel === "restock" ? null : "restock")}
          className="order-1 rounded-2xl border border-warning/25 bg-warning-soft/45 p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 md:order-1 lg:col-span-6"
          aria-expanded={expandedPanel === "restock"}
        >
          <div className="flex h-full flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-warning">
                  Restock Alerts
                </div>
              </div>
              <div className="rounded-full bg-warning-soft px-2.5 py-0.5 text-[10px] font-semibold text-warning">
                Needs review
              </div>
            </div>
            <div className="text-[2rem] font-semibold tabular-nums tracking-tight text-foreground lg:text-[2.15rem]">
              {lowStockCount.toLocaleString()}
            </div>
          </div>
        </motion.button>

        <motion.button
          variants={listItem}
          whileTap={SUMMARY_CARD_TAP}
          type="button"
          onClick={() => onTogglePanel(expandedPanel === "draftPos" ? null : "draftPos")}
          className="order-3 rounded-2xl border border-info/25 bg-info-soft/45 p-3 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 md:order-3 lg:col-span-3"
          aria-expanded={expandedPanel === "draftPos"}
        >
          <div className="flex h-full flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-info">
                  Draft PO
                </div>
              </div>
              <div className="rounded-full bg-info-soft px-2.5 py-0.5 text-[10px] font-semibold text-info">
                {pendingDraftPoCount === null ? "Unavailable" : "Awaiting"}
              </div>
            </div>
            <div className="text-[2rem] font-semibold tabular-nums tracking-tight text-foreground lg:text-[2.15rem]">
              {pendingDraftPoCount === null ? "N/A" : pendingDraftPoCount.toLocaleString()}
            </div>
          </div>
        </motion.button>
      </motion.div>

      {overlayOpen ? (
        <div
          className={`absolute left-0 top-full z-50 mt-2 px-1 ${expandedPanel === "draftPos" ? "w-[min(40rem,calc(100vw-1rem))] lg:w-[calc(50%-0.375rem)]" : "w-[min(40rem,calc(100vw-1rem))] lg:w-[calc(50%-0.375rem)]"}`}
        >
          <div className="max-h-[22rem] overflow-auto rounded-2xl border border-border/70 bg-background/95 shadow-xl ring-1 ring-black/5 backdrop-blur">
            {expandedPanel === "restock" ? (
              <div className="p-3 sm:p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-warning">
                      Restock Alerts
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onTogglePanel(null)}
                    className="rounded-full px-2.5"
                  >
                    Close
                  </Button>
                </div>

                <div className="mt-3 space-y-2">
                  {restockAlertMedicines.slice(0, 5).map((medicine) => (
                    <div
                      key={medicine.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-warning/15 bg-warning-soft/35 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-foreground">
                          {medicine.name}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Stock {medicine.currentStock} · Safety {medicine.safetyStockLevel}
                        </div>
                      </div>
                      <div
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${medicine.isCritical ? "bg-critical-soft text-critical" : "bg-warning-soft text-warning"}`}
                      >
                        {medicine.isCritical ? "Critical" : "Below safety"}
                      </div>
                    </div>
                  ))}
                  {restockAlertMedicines.length > 5 ? (
                    <div className="px-1 text-[11px] text-muted-foreground">and more</div>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild type="button" size="sm" className="rounded-full">
                    <Link to="/inventory" search={{ focus: "alerts" }}>
                      Open restocking menu
                    </Link>
                  </Button>
                </div>
              </div>
            ) : null}

            {expandedPanel === "draftPos" ? (
              <div className="p-3 sm:p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">
                      Draft Purchase Orders
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onTogglePanel(null)}
                    className="rounded-full px-2.5"
                  >
                    Close
                  </Button>
                </div>

                <div className="mt-3 space-y-2">
                  {draftPurchaseOrders.slice(0, 5).map((po) => (
                    <div
                      key={po.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/75 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-foreground">
                          {po.poNumber}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatDisplayDate(po.createdAt)} · {po.itemCount} item
                          {po.itemCount === 1 ? "" : "s"}
                        </div>
                      </div>
                      <div className="shrink-0 rounded-full bg-violet-100 px-2.5 py-0.5 text-[10px] font-semibold text-violet-700">
                        Pending AI
                      </div>
                    </div>
                  ))}
                  {draftPurchaseOrders.length > 5 ? (
                    <div className="px-1 text-[11px] text-muted-foreground">see more</div>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild type="button" size="sm" className="rounded-full">
                    <Link to="/purchase-orders">Review drafted POs</Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DashboardPage() {
  const [expandedPanel, setExpandedPanel] = useState<DashboardPanel>(null);
  const {
    data: medicines = [],
    isLoading: medicinesLoading,
    isError: medicinesError,
    refetch: refetchMedicines,
  } = useMedicines();
  const { data: purchaseOrders = [], isError: purchaseOrdersError } = usePurchaseOrders();

  const totalMedicines = medicines.length;
  const lowStockCount = medicines.filter(
    (medicine) => medicine.current_stock <= medicine.safety_stock_level,
  ).length;
  const pendingReviewPurchaseOrders = useMemo(
    () =>
      purchaseOrdersError
        ? []
        : purchaseOrders
            .filter((purchaseOrder) => purchaseOrder.status === "DRAFT_AI")
            .sort(
              (left, right) =>
                new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
            ),
    [purchaseOrders, purchaseOrdersError],
  );

  const pendingDraftPoCount = purchaseOrdersError ? null : pendingReviewPurchaseOrders.length;

  const restockAlertMedicines = useMemo(
    () =>
      medicines
        .filter((medicine) => medicine.current_stock <= medicine.safety_stock_level)
        .sort((left, right) => {
          const leftCritical = left.current_stock < left.safety_stock_level * 0.5;
          const rightCritical = right.current_stock < right.safety_stock_level * 0.5;
          if (leftCritical !== rightCritical) return leftCritical ? -1 : 1;
          return left.current_stock - right.current_stock;
        })
        .map((medicine) => ({
          id: medicine.id,
          name: medicine.name,
          currentStock: medicine.current_stock,
          safetyStockLevel: medicine.safety_stock_level,
          isCritical: medicine.current_stock < medicine.safety_stock_level * 0.5,
        })),
    [medicines],
  );

  const targetMedicineId = medicines[0]?.id ?? null;
  const { data: predictions = [] } = usePredictions(targetMedicineId);

  const forecastData = useMemo<ForecastPoint[]>(() => {
    if (predictions.length === 0) {
      return FALLBACK_FORECAST_DATA;
    }

    return predictions.slice(0, 10).map((prediction, index) => ({
      day: `D${index + 1}`,
      actual: index < 7 ? prediction.predicted_demand : null,
      predicted: prediction.predicted_demand,
    }));
  }, [predictions]);

  const categoryProgress = useMemo<CategoryBar[]>(() => {
    if (medicines.length === 0) {
      return [];
    }

    const categoryTotals = medicines.reduce((totals, medicine) => {
      const categoryName = medicine.category.trim() || "Uncategorized";
      const currentTotal = totals.get(categoryName) ?? 0;
      totals.set(categoryName, currentTotal + medicine.current_stock);
      return totals;
    }, new Map<string, number>());

    const totalStock = Array.from(categoryTotals.values()).reduce((sum, value) => sum + value, 0);
    const safeTotal = totalStock > 0 ? totalStock : 1;

    return Array.from(categoryTotals.entries())
      .map(([name, stock], index) => {
        const value = Math.round((stock / safeTotal) * 100);
        const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];

        return {
          name,
          value,
          color,
          style: { width: `${value}%`, backgroundColor: color },
        };
      })
      .sort((left, right) => right.value - left.value)
      .slice(0, 4);
  }, [medicines]);

  const worklistRows = useMemo<ReportRow[]>(() => {
    if (medicines.length === 0) {
      return FALLBACK_TABLE_ROWS;
    }

    return medicines
      .filter((medicine) => medicine.current_stock <= medicine.safety_stock_level)
      .sort((left, right) => {
        const leftCritical = left.current_stock < left.safety_stock_level * 0.5;
        const rightCritical = right.current_stock < right.safety_stock_level * 0.5;
        if (leftCritical !== rightCritical) return leftCritical ? -1 : 1;
        return left.current_stock - right.current_stock;
      })
      .map((medicine) => ({
        sku: medicine.sku_code,
        name: medicine.name,
        form: medicine.unit_measurement,
        currentStock: medicine.current_stock,
        predictedDemand7d: Math.max(
          medicine.safety_stock_level,
          Math.round(medicine.current_stock * 0.75 + medicine.safety_stock_level * 0.5),
        ),
        status: (medicine.current_stock < medicine.safety_stock_level * 0.5
          ? "Critical"
          : "Low Stock") as StockStatus,
      }));
  }, [medicines]);

  function handleExportInsights() {
    toast.success("Restocking insights export is queued.");
  }

  function handleRetryConnection() {
    void refetchMedicines();
  }

  if (medicinesLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-[1.75rem] border border-border/60 bg-card/90 p-6 shadow-sm">
          <div className="grid gap-6 lg:grid-cols-[1.25fr_0.95fr]">
            <div className="space-y-4">
              <Skeleton className="h-6 w-32 rounded-full" />
              <Skeleton className="h-10 w-full max-w-3xl rounded-xl" />
              <Skeleton className="h-5 w-full max-w-2xl rounded-xl" />
              <div className="flex gap-2">
                <Skeleton className="h-10 w-32 rounded-full" />
                <Skeleton className="h-10 w-32 rounded-full" />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-24 rounded-2xl" />
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Skeleton className="h-[340px] rounded-[1.5rem]" />
          <Skeleton className="h-[340px] rounded-[1.5rem]" />
        </div>
      </div>
    );
  }

  if (medicinesError) {
    return (
      <Card className="border-border/70 bg-card/95 shadow-sm">
        <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Inventory data failed to load</h2>
            <p className="max-w-lg text-sm text-muted-foreground">
              Check the backend connection or seed the demo database, then refresh the page.
            </p>
          </div>
          <Button type="button" onClick={handleRetryConnection} variant="outline">
            Retry connection
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <DashboardSnapshot
        totalMedicines={totalMedicines}
        lowStockCount={lowStockCount}
        pendingDraftPoCount={pendingDraftPoCount}
        restockAlertMedicines={restockAlertMedicines}
        draftPurchaseOrders={pendingReviewPurchaseOrders.map((po) => ({
          id: po.id,
          poNumber: po.po_number,
          createdAt: po.created_at,
          itemCount: po.items.reduce((sum, item) => sum + item.order_quantity, 0),
        }))}
        expandedPanel={expandedPanel}
        onTogglePanel={setExpandedPanel}
      />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]"
      >
        <motion.div variants={fadeInUp}>
        <Card className="interactive-card overflow-hidden border-border/70 bg-card/95 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                Forecast pressure
              </CardTitle>
            </div>
            <div className="rounded-full border border-border/70 bg-surface px-3 py-1 text-[11px] font-medium text-muted-foreground">
              Updated live
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-1">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={forecastData}>
                <defs>
                  <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#ffffff",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    color: "#0f172a",
                    zIndex: 50,
                  }}
                  itemStyle={{ color: "#0f172a" }}
                />
                <Area
                  dataKey="actual"
                  name="Actual stock"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#actualGrad)"
                  dot={false}
                  connectNulls={false}
                  type="monotone"
                />
                <Line
                  dataKey="predicted"
                  name="Demand forecast"
                  stroke="#38bdf8"
                  strokeWidth={1.5}
                  strokeDasharray="5 3"
                  dot={false}
                  connectNulls
                  type="monotone"
                />
              </AreaChart>
            </ResponsiveContainer>

            <div className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Category stock share</h3>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {categoryProgress.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-2xl border border-border/60 bg-background/70 p-3"
                  >
                    {renderCategoryProgress(item)}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
        <Card
          className="interactive-card flex flex-col overflow-hidden border-border/70 bg-card/95 shadow-sm"
          id="restocking-worklist"
        >
          <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
            <div>
              <CardTitle className="text-base font-semibold text-foreground">
                Restocking priorities
              </CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportInsights}
              className="gap-1.5 rounded-full border-border/80 bg-white/70 hover:bg-white"
            >
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
          </CardHeader>
          <CardContent className="max-h-[22rem] space-y-2 overflow-y-auto pt-1 pr-1">
            <motion.div
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
              className="space-y-2"
            >
              {worklistRows.map(renderCompactWorklistRow)}
            </motion.div>
          </CardContent>
        </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}
