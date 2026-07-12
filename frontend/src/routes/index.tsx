import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { createFileRoute, Link, Navigate, useRouterState } from "@tanstack/react-router";
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
import { ShoppingCart, TrendingDown, TrendingUp, Download } from "lucide-react";
import { toast } from "sonner";
import {
  useEvaluateRestocking,
  useMedicines,
  usePurchaseOrders,
  useReportSummary,
  useSuppliers,
} from "@/hooks/use-api";
import { ReportsPage } from "@/pages/Reports";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/toast-handlers";
import type { RestockingEvalResponse } from "@/types/api.types";

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

interface KpiCard {
  title: string;
  value: string;
  delta: string;
  positive: boolean;
  sparkColor: string;
  sparkData: { v: number }[];
}

interface DepletionPoint {
  status: StockStatus;
  daysLeft: number;
}

interface CategoryBar {
  name: string;
  value: number;
  color: string;
  style: CSSProperties;
}

interface ReportRow {
  sku: string;
  medicine: string;
  stock: number;
  safetyStock: number;
  difference: number;
  status: "Critical" | "Warning";
  supplier: string;
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
type DashboardMode = "stock" | "financial";

type RestockAlertMedicine = {
  id: number;
  name: string;
  currentStock: number;
  safetyStockLevel: number;
  supplierId: number;
  status: "Critical" | "Warning";
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
    medicine: "Paracetamol 500mg",
    stock: 30,
    safetyStock: 20,
    difference: 10,
    status: "Warning",
    supplier: "Metro Pharma",
  },
  {
    sku: "MED-0002",
    medicine: "Amoxicillin 500mg",
    stock: 12,
    safetyStock: 20,
    difference: -8,
    status: "Critical",
    supplier: "Harapan Sehat",
  },
];

const RESTOCK_PRIORITY_STATUS_CONFIG: Record<
  ReportRow["status"],
  { label: string; className: string; stockClassName: string; differenceClassName: string }
> = {
  Critical: {
    label: "Critical",
    className: "bg-rose-50 text-rose-500 border-rose-200",
    stockClassName: "text-rose-500",
    differenceClassName: "text-rose-500",
  },
  Warning: {
    label: "Warning",
    className: "bg-orange-100 text-orange-500 border-orange-200",
    stockClassName: "text-orange-400",
    differenceClassName: "text-orange-400",
  },
};

function SparklineCard({ item, index }: { item: KpiCard; index: number }) {
  const gradientId = `sparkGrad-${index}`;
  const unavailable = item.value === "N/A";

  return (
    <Card className="interactive-card border-border/70 bg-card/95 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{item.title}</p>
            <p className="text-2xl font-semibold text-slate-900">{item.value}</p>
            <div className="inline-flex items-center gap-1 text-xs">
              {unavailable ? null : item.positive ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
              )}
              <span
                className={
                  unavailable
                    ? "text-slate-500"
                    : item.positive
                      ? "text-emerald-600"
                      : "text-amber-600"
                }
              >
                {item.delta}
              </span>
            </div>
          </div>
          <div className="h-8 w-24">
            <ResponsiveContainer width="100%" height={32}>
              <AreaChart data={item.sparkData}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={item.sparkColor} stopOpacity={0.28} />
                    <stop offset="95%" stopColor={item.sparkColor} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={item.sparkColor}
                  fill={`url(#${gradientId})`}
                  strokeWidth={1.5}
                  dot={false}
                />
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
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function renderKpi(item: KpiCard, index: number) {
  return <SparklineCard key={item.title} item={item} index={index} />;
}

function renderStatusBar(point: DepletionPoint) {
  return null;
}

function renderCategoryProgress(item: CategoryBar) {
  const formattedValue = Number.isInteger(item.value)
    ? item.value.toFixed(0)
    : item.value.toFixed(1);

  return (
    <div key={item.name} className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{item.name}</span>
        <span className="font-medium text-slate-700">{formattedValue}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div className="h-1.5 rounded-full" style={item.style} />
      </div>
    </div>
  );
}

function renderRestockPriorityRow(row: ReportRow) {
  const config = RESTOCK_PRIORITY_STATUS_CONFIG[row.status];
  const differenceIsPositive = row.difference > 0;

  return (
    <TableRow key={row.sku} className="border-border/60">
      <TableCell className="border-r border-border/60 pl-6 align-top">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-slate-900">{row.medicine}</div>
          <div className="truncate text-[11px] text-slate-500">{row.sku}</div>
        </div>
      </TableCell>
      <TableCell
        className={`border-r border-border/60 align-top text-right tabular-nums font-semibold ${config.stockClassName}`}
      >
        {row.stock.toLocaleString()}
      </TableCell>
      <TableCell className="border-r border-border/60 align-top text-right tabular-nums font-semibold text-slate-900">
        {row.safetyStock.toLocaleString()}
      </TableCell>
      <TableCell
        className={`border-r border-border/60 align-top pr-4 text-right tabular-nums font-semibold ${config.differenceClassName}`}
      >
        {differenceIsPositive
          ? `▲${row.difference.toLocaleString()}`
          : `▼${Math.abs(row.difference).toLocaleString()}`}
      </TableCell>
      <TableCell className="border-r border-border/60 align-top pl-4">
        <Badge variant="outline" className={config.className}>
          {config.label}
        </Badge>
      </TableCell>
      <TableCell className="align-top text-slate-600">{row.supplier}</TableCell>
    </TableRow>
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

function formatRelativeTime(timestamp: number | null): string {
  if (timestamp === null) return "Never";

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hr ago`;

  const elapsedDays = Math.floor(elapsedHours / 24);
  return `${elapsedDays} day${elapsedDays === 1 ? "" : "s"} ago`;
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
  activeMedicineCount,
  inventoryHealthPercent,
  lowStockCount,
  pendingDraftPoCount,
  restockUpdatedAt,
  restockAlertMedicines,
  draftPurchaseOrders,
  expandedPanel,
  onTogglePanel,
  onRestockMedicine,
}: {
  totalMedicines: number;
  activeMedicineCount: number;
  inventoryHealthPercent: number;
  lowStockCount: number;
  pendingDraftPoCount: number | null;
  restockUpdatedAt: number | null;
  restockAlertMedicines: RestockAlertMedicine[];
  draftPurchaseOrders: DraftPurchaseOrder[];
  expandedPanel: DashboardPanel;
  onTogglePanel: (panel: DashboardPanel) => void;
  onRestockMedicine: (medicine: RestockAlertMedicine) => void;
}) {
  const overlayOpen = expandedPanel !== null;

  return (
    <div className="relative">
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-12">
        <div className="order-2 md:order-2 lg:col-span-3">
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
                  Healthy
                </div>
              </div>

              <div className="text-[2rem] font-semibold tabular-nums tracking-tight text-foreground lg:text-[2.15rem]">
                {totalMedicines.toLocaleString()}
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-success/20 pt-3 text-[11px] font-medium text-muted-foreground">
                <span>
                  <span className="font-semibold text-slate-800">
                    {activeMedicineCount.toLocaleString()}
                  </span>{" "}
                  Active Items
                </span>
                <span>
                  Inventory health{" "}
                  <span className="font-semibold text-emerald-700">
                    {inventoryHealthPercent.toFixed(0)}%
                  </span>
                </span>
              </div>
            </div>
          </SummaryCardLink>
        </div>

        <button
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
              <div className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
                Action required
              </div>
            </div>
            <div className="text-[2rem] font-semibold tabular-nums tracking-tight text-foreground lg:text-[2.15rem]">
              {lowStockCount.toLocaleString()}
            </div>

            <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-amber-100 pt-3 text-[11px] font-medium text-muted-foreground">
              <span>
                <span className="font-semibold text-rose-700">
                  {
                    restockAlertMedicines.filter((medicine) => medicine.status === "Critical")
                      .length
                  }
                </span>{" "}
                Critical
              </span>
              <span>
                <span className="font-semibold text-amber-700">
                  {restockAlertMedicines.filter((medicine) => medicine.status === "Warning").length}
                </span>{" "}
                Warning
              </span>
              <span>
                Last updated{" "}
                <span className="font-semibold text-slate-700">
                  {formatRelativeTime(restockUpdatedAt)}
                </span>
              </span>
            </div>
          </div>
        </button>

        <button
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
              <div className="rounded-full bg-sky-100 px-2.5 py-0.5 text-[10px] font-semibold text-sky-700">
                {pendingDraftPoCount === null ? "Unavailable" : "Needs Approval"}
              </div>
            </div>
            <div className="text-[2rem] font-semibold tabular-nums tracking-tight text-foreground lg:text-[2.15rem]">
              {pendingDraftPoCount === null ? "N/A" : pendingDraftPoCount.toLocaleString()}
            </div>
            <div className="mt-auto border-t border-sky-100 pt-3 text-[11px] font-medium text-muted-foreground">
              Awaiting Approval
            </div>
          </div>
        </button>
      </div>

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
                      <div className="flex shrink-0 items-center gap-2">
                        <div
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${medicine.status === "Critical" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"}`}
                        >
                          {medicine.status}
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 text-slate-700 shadow-sm hover:bg-slate-200 hover:text-slate-900"
                          onClick={() => onRestockMedicine(medicine)}
                        >
                          <ShoppingCart className="h-4 w-4" />
                          Restock
                        </Button>
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
  const [dashboardMode, setDashboardMode] = useState<DashboardMode>("stock");
  const [restockDialogOpen, setRestockDialogOpen] = useState(false);
  const [restockEvaluation, setRestockEvaluation] = useState<RestockingEvalResponse | null>(null);
  const [restockMedicineId, setRestockMedicineId] = useState<number | null>(null);
  const [restockSupplierId, setRestockSupplierId] = useState<string>("");
  const [restockUpdatedAt, setRestockUpdatedAt] = useState<number | null>(null);
  const {
    data: medicines = [],
    isLoading: medicinesLoading,
    isError: medicinesError,
    refetch: refetchMedicines,
  } = useMedicines();
  const { data: suppliers = [] } = useSuppliers();
  const { data: purchaseOrders = [], isError: purchaseOrdersError } = usePurchaseOrders();
  const evaluateRestocking = useEvaluateRestocking();

  useEffect(() => {
    if (medicines.length > 0) {
      setRestockUpdatedAt(Date.now());
    }
  }, [medicines]);

  const totalMedicines = medicines.length;
  const activeMedicineCount = medicines.filter((medicine) => medicine.current_stock > 0).length;
  const inventoryHealthPercent =
    totalMedicines === 0
      ? 0
      : (medicines.filter((medicine) => medicine.current_stock - medicine.safety_stock_level > 15)
          .length /
          totalMedicines) *
        100;
  const supplierNameById = useMemo(
    () => new Map<number, string>(suppliers.map((supplier) => [supplier.id, supplier.name])),
    [suppliers],
  );
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

  const restockAlertMedicines = useMemo(
    () =>
      medicines
        .filter((medicine) => {
          const currentGap = medicine.current_stock - medicine.safety_stock_level;
          return currentGap <= 15;
        })
        .sort((left, right) => {
          const leftCritical = left.current_stock < left.safety_stock_level;
          const rightCritical = right.current_stock < right.safety_stock_level;
          if (leftCritical !== rightCritical) return leftCritical ? -1 : 1;

          const leftGap = left.current_stock - left.safety_stock_level;
          const rightGap = right.current_stock - right.safety_stock_level;
          return leftGap - rightGap;
        })
        .map(
          (medicine): RestockAlertMedicine => ({
            id: medicine.id,
            name: medicine.name,
            currentStock: medicine.current_stock,
            safetyStockLevel: medicine.safety_stock_level,
            supplierId: medicine.supplier_id,
            status: medicine.current_stock < medicine.safety_stock_level ? "Critical" : "Warning",
          }),
        ),
    [medicines],
  );
  const lowStockCount = restockAlertMedicines.length;
  const { data: reportSummary, isError: reportError } = useReportSummary();
  const forecastSource = reportError || !reportSummary ? "demo" : reportSummary.data_source;

  const forecastData = useMemo<ForecastPoint[]>(() => {
    if (!reportSummary?.ml_series.length) {
      return FALLBACK_FORECAST_DATA;
    }

    return reportSummary.ml_series.map((point) => ({
      day: point.name,
      actual: point.actual_consumption,
      predicted: point.predicted_demand,
    }));
  }, [reportSummary]);

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
        const value = (stock / safeTotal) * 100;
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
      .filter((medicine) => medicine.current_stock - medicine.safety_stock_level <= 15)
      .sort((left, right) => {
        const leftCritical = left.current_stock < left.safety_stock_level;
        const rightCritical = right.current_stock < right.safety_stock_level;
        if (leftCritical !== rightCritical) return leftCritical ? -1 : 1;

        const leftGap = left.current_stock - left.safety_stock_level;
        const rightGap = right.current_stock - right.safety_stock_level;
        return leftGap - rightGap;
      })
      .map((medicine) => {
        const predictedDemand7d = Math.max(
          medicine.safety_stock_level,
          Math.round(medicine.current_stock * 0.75 + medicine.safety_stock_level * 0.5),
        );
        const etaDays = Math.max(
          1,
          Math.ceil(medicine.current_stock / Math.max(predictedDemand7d / 7, 1)),
        );

        return {
          sku: medicine.sku_code,
          medicine: medicine.name,
          stock: medicine.current_stock,
          safetyStock: medicine.safety_stock_level,
          difference: medicine.current_stock - medicine.safety_stock_level,
          status: medicine.current_stock < medicine.safety_stock_level ? "Critical" : "Warning",
          supplier: supplierNameById.get(medicine.supplier_id) ?? "Unassigned supplier",
        };
      });
  }, [medicines, supplierNameById]);

  function handleExportInsights() {
    toast.success("Restocking insights export is queued.");
  }

  function handleRetryConnection() {
    void refetchMedicines();
  }

  function handleRestockMedicine(medicine: RestockAlertMedicine) {
    setRestockMedicineId(medicine.id);
    setRestockSupplierId(String(medicine.supplierId));
    evaluateRestocking.mutate(
      { medicineId: medicine.id },
      {
        onSuccess: (result) => {
          setRestockEvaluation(result);
          setRestockDialogOpen(true);
          if (result.status === "Low Stock") {
            toast.info(
              `${result.medicine_name} is low stock. Choose a supplier to create the draft PO.`,
            );
            return;
          }
          toast.info(`${result.medicine_name} is still above the restock threshold.`);
        },
        onError: (err) => handleApiError("Evaluate restocking", err),
      },
    );
  }

  function handleRestockDialogOpenChange(open: boolean) {
    setRestockDialogOpen(open);
    if (!open) {
      setRestockEvaluation(null);
      setRestockMedicineId(null);
      setRestockSupplierId("");
    }
  }

  function handleCreateRestockPo() {
    if (!restockEvaluation) return;
    const medicineId = restockMedicineId ?? restockEvaluation.medicine_id;
    const supplierId = Number(restockSupplierId);
    if (!medicineId || !supplierId) return;

    window.location.assign(
      `/purchase-orders?draftMedicineId=${medicineId}&supplierId=${supplierId}`,
    );
  }

  const modeSwitcher = (
    <div className="inline-flex rounded-full bg-[#d9f3df] p-1 shadow-sm">
      <div className="relative grid min-w-[280px] grid-cols-2 rounded-full">
        <span
          aria-hidden
          className={[
            "absolute inset-y-0 left-0 w-1/2 rounded-full bg-white shadow-[0_10px_24px_rgba(34,197,94,0.18)] transition-transform duration-300 ease-out",
            dashboardMode === "financial" ? "translate-x-full" : "translate-x-0",
          ].join(" ")}
        />
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setDashboardMode("stock")}
          className={[
            "relative z-10 rounded-full px-5 transition-all duration-300 hover:bg-transparent hover:text-current",
            dashboardMode === "stock"
              ? "bg-white/95 font-semibold text-[#0f5132] shadow-[0_4px_12px_rgba(15,81,50,0.18)]"
              : "text-black/70",
          ].join(" ")}
        >
          Stock page
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setDashboardMode("financial")}
          className={[
            "relative z-10 rounded-full px-5 transition-all duration-300 hover:bg-transparent hover:text-current",
            dashboardMode === "financial"
              ? "bg-white/95 font-semibold text-[#0f5132] shadow-[0_4px_12px_rgba(15,81,50,0.18)]"
              : "text-black/70",
          ].join(" ")}
        >
          Financial page
        </Button>
      </div>
    </div>
  );

  if (dashboardMode === "financial") {
    return (
      <div className="space-y-4">
        {modeSwitcher}
        <ReportsPage />
      </div>
    );
  }

  if (medicinesLoading) {
    return (
      <div className="space-y-6">
        {modeSwitcher}
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
      <div className="space-y-4">
        {modeSwitcher}
        <Card className="border-border/70 bg-card/95 shadow-sm">
          <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground">
                Inventory data failed to load
              </h2>
              <p className="max-w-lg text-sm text-muted-foreground">
                Check the backend connection or seed the demo database, then refresh the page.
              </p>
            </div>
            <Button type="button" onClick={handleRetryConnection} variant="outline">
              Retry connection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {modeSwitcher}
      <DashboardSnapshot
        totalMedicines={totalMedicines}
        activeMedicineCount={activeMedicineCount}
        inventoryHealthPercent={inventoryHealthPercent}
        lowStockCount={lowStockCount}
        pendingDraftPoCount={pendingReviewPurchaseOrders.length}
        restockUpdatedAt={restockUpdatedAt}
        restockAlertMedicines={restockAlertMedicines}
        draftPurchaseOrders={pendingReviewPurchaseOrders.map((po) => ({
          id: po.id,
          poNumber: po.po_number,
          createdAt: po.created_at,
          itemCount: po.items.reduce((sum, item) => sum + item.order_quantity, 0),
        }))}
        expandedPanel={expandedPanel}
        onTogglePanel={setExpandedPanel}
        onRestockMedicine={handleRestockMedicine}
      />

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div>
          <Card className="interactive-card overflow-hidden border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
              <div>
                <CardTitle className="text-base font-semibold text-slate-900">
                  Stock Consumption Forecast
                </CardTitle>
              </div>
              <div className="rounded-full border border-border/70 bg-surface px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                {forecastSource === "ml"
                  ? "ML live"
                  : forecastSource === "fallback"
                    ? "Fallback live"
                    : "Demo data"}
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
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#94a3b8" }}
                  />
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
        </div>

        <div>
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
              </Button>
            </CardHeader>
            <CardContent className="max-h-[22rem] overflow-auto pt-1 pr-1">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="border-r border-border/60 pl-6 font-semibold text-slate-500">
                      Medicine
                    </TableHead>
                    <TableHead className="border-r border-border/60 text-right font-semibold text-slate-500">
                      Stock
                    </TableHead>
                    <TableHead className="border-r border-border/60 text-right font-semibold text-slate-500">
                      Safety Stock
                    </TableHead>
                    <TableHead className="border-r border-border/60 text-right font-semibold text-slate-500">
                      Difference
                    </TableHead>
                    <TableHead className="border-r border-border/60 font-semibold text-slate-500">
                      Status
                    </TableHead>
                    <TableHead className="font-semibold text-slate-500">Supplier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>{worklistRows.map(renderRestockPriorityRow)}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={restockDialogOpen} onOpenChange={handleRestockDialogOpenChange}>
        <DialogContent className="border-border-strong bg-background sm:max-w-lg">
          {restockEvaluation ? (
            <>
              <DialogHeader>
                <DialogTitle>Draft AI review</DialogTitle>
                <DialogDescription>
                  Review the AI draft before creating the purchase order for manager approval.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Medicine</p>
                  <p className="font-semibold text-foreground">{restockEvaluation.medicine_name}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Current stock</p>
                    <p className="font-medium text-foreground">
                      {restockEvaluation.current_stock.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Safety stock</p>
                    <p className="font-medium text-foreground">
                      {medicines
                        .find((m) => m.id === restockEvaluation.medicine_id)
                        ?.safety_stock_level.toLocaleString() ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Predicted demand</p>
                    <p className="font-medium text-foreground">
                      {restockEvaluation.predicted_demand.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Recommended PO qty</p>
                    <p className="font-medium text-foreground">
                      {restockEvaluation.recommended_po_qty.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="rounded-md border border-border bg-background p-3 text-sm text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground">Draft AI summary</p>
                  <p>{restockEvaluation.draft_ai_summary ?? "No summary available."}</p>
                  {restockEvaluation.draft_ai_factors.length ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {restockEvaluation.draft_ai_factors.map((factor) => (
                        <li key={factor}>{factor}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Supplier</p>
                  <select
                    value={restockSupplierId}
                    onChange={(event) => setRestockSupplierId(event.target.value)}
                    className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none"
                  >
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={String(supplier.id)}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleRestockDialogOpenChange(false)}
                >
                  Close
                </Button>
                <Button type="button" onClick={handleCreateRestockPo} disabled={!restockSupplierId}>
                  Open Purchase Orders
                </Button>
                <Button asChild type="button" variant="secondary">
                  <Link to="/purchase-orders">View Purchase Orders</Link>
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground">Checking stock...</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
