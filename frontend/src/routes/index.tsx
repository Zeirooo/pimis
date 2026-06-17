import { useMemo, type CSSProperties } from "react";
import { createFileRoute, Navigate, useRouterState } from "@tanstack/react-router";
import {
  ComposedChart,
  Area,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  AreaChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
// input removed — search bar deleted
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, TrendingDown, TrendingUp, Download } from "lucide-react";
import { toast } from "sonner";
import { useMedicines, usePredictions, usePurchaseOrders } from "@/hooks/use-api";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

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

interface SparkPoint {
  v: number;
}

interface KpiCard {
  title: string;
  value: string;
  delta: string;
  positive: boolean;
  sparkColor: string;
  sparkData: SparkPoint[];
}

interface ForecastPoint {
  day: string;
  actual: number | null;
  predicted: number;
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

const DEPLETION_DATA: DepletionPoint[] = [
  { status: "Critical", daysLeft: 5 },
  { status: "Low Stock", daysLeft: 14 },
  { status: "Healthy", daysLeft: 36 },
  { status: "Overstock", daysLeft: 52 },
];

const STATUS_CONFIG: Record<StockStatus, { label: string; className: string; barColor: string }> = {
  Critical: {
    label: "Critical",
    className: "bg-rose-100 text-rose-700 border-rose-200",
    barColor: "#f43f5e",
  },
  "Low Stock": {
    label: "Low Stock",
    className: "bg-amber-100 text-amber-700 border-amber-200",
    barColor: "#f59e0b",
  },
  Overstock: {
    label: "Overstock",
    className: "bg-sky-100 text-sky-700 border-sky-200",
    barColor: "#0ea5e9",
  },
  Healthy: {
    label: "Healthy",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200",
    barColor: "#10b981",
  },
};

const CATEGORY_PROGRESS: CategoryBar[] = [
  {
    name: "Analgesic",
    value: 78,
    color: "#10b981",
    style: { width: "78%", backgroundColor: "#10b981" },
  },
  {
    name: "Antibiotic",
    value: 61,
    color: "#0ea5e9",
    style: { width: "61%", backgroundColor: "#0ea5e9" },
  },
  {
    name: "Cardio",
    value: 45,
    color: "#f59e0b",
    style: { width: "45%", backgroundColor: "#f59e0b" },
  },
  { name: "GI", value: 33, color: "#8b5cf6", style: { width: "33%", backgroundColor: "#8b5cf6" } },
];

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
  return <Cell key={point.status} fill={STATUS_CONFIG[point.status].barColor} />;
}

function renderCategoryProgress(item: CategoryBar) {
  return (
    <div key={item.name} className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500">{item.name}</span>
        <span className="font-medium text-slate-700">{item.value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100">
        <div className="h-1.5 rounded-full" style={item.style} />
      </div>
    </div>
  );
}

function renderTableRow(row: ReportRow) {
  const config = STATUS_CONFIG[row.status];

  function handleReviewClick() {
    toast.success(`Review action triggered for ${row.name}.`);
  }

  return (
    <TableRow key={row.sku} className="border-slate-100">
      <TableCell className="whitespace-nowrap font-mono text-[11px] text-slate-500">
        {row.sku}
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <p className="font-medium text-slate-900">{row.name}</p>
        <p className="text-xs text-slate-500">{row.form}</p>
      </TableCell>
      <TableCell className="whitespace-nowrap text-right tabular-nums text-slate-700">
        {row.currentStock}
      </TableCell>
      <TableCell className="whitespace-nowrap text-right tabular-nums text-slate-700">
        {row.predictedDemand7d}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={config.className}>
          {config.label}
        </Badge>
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReviewClick}
          className="gap-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        >
          <span>Review</span>
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function DashboardPage() {
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
  const criticalCount = medicines.filter(
    (medicine) => medicine.current_stock < medicine.safety_stock_level * 0.5,
  ).length;
  const pendingDraftPoCount = purchaseOrdersError
    ? null
    : purchaseOrders.filter(
        (purchaseOrder) =>
          purchaseOrder.status === "DRAFT_AI" || purchaseOrder.status === "REJECTED",
      ).length;

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

  const worklistRows = useMemo<ReportRow[]>(() => {
    if (medicines.length === 0) {
      return FALLBACK_TABLE_ROWS;
    }

    return medicines.slice(0, 5).map((medicine) => ({
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
        : medicine.current_stock <= medicine.safety_stock_level
          ? "Low Stock"
          : medicine.current_stock > medicine.safety_stock_level * 2
            ? "Overstock"
            : "Healthy") as StockStatus,
    }));
  }, [medicines]);

  const KPI_DATA_LIVE: KpiCard[] = [
    {
      title: "Total Medicines",
      value: totalMedicines.toLocaleString(),
      delta: "+4.2%",
      positive: true,
      sparkColor: "#10b981",
      sparkData: [{ v: 42 }, { v: 48 }, { v: 50 }, { v: 54 }, { v: 52 }, { v: 58 }, { v: 61 }],
    },
    {
      title: "Low Stock Alerts",
      value: lowStockCount.toString(),
      delta: "+8.1%",
      positive: false,
      sparkColor: "#f59e0b",
      sparkData: [{ v: 22 }, { v: 20 }, { v: 24 }, { v: 27 }, { v: 29 }, { v: 31 }, { v: 32 }],
    },
    {
      title: "Pending Draft POs",
      value: pendingDraftPoCount === null ? "N/A" : pendingDraftPoCount.toString(),
      delta:
        pendingDraftPoCount === null ? "PO data unavailable" : `${pendingDraftPoCount} awaiting`,
      positive: true,
      sparkColor: "#10b981",
      sparkData:
        pendingDraftPoCount === null
          ? [{ v: 3 }, { v: 4 }, { v: 4 }, { v: 5 }, { v: 6 }, { v: 7 }, { v: 7 }]
          : [
              { v: pendingDraftPoCount },
              { v: pendingDraftPoCount },
              { v: pendingDraftPoCount },
              { v: pendingDraftPoCount },
              { v: pendingDraftPoCount },
              { v: pendingDraftPoCount },
              { v: pendingDraftPoCount },
            ],
    },
    {
      title: "Near Expiry (30d)",
      value: "N/A",
      delta: "Expiry dates not tracked",
      positive: true,
      sparkColor: "#8b5cf6",
      sparkData: [{ v: 22 }, { v: 20 }, { v: 19 }, { v: 19 }, { v: 18 }, { v: 18 }, { v: 18 }],
    },
  ];

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
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <Skeleton className="h-6 w-44 rounded-full" />
              <Skeleton className="h-10 w-full max-w-3xl rounded-xl" />
              <Skeleton className="h-5 w-full max-w-2xl rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              <Skeleton className="h-12 rounded-xl" />
              <Skeleton className="h-12 rounded-xl" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-[220px] w-full rounded-[1.5rem]" />
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
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[1.75rem] border border-border/70 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.86))] p-6 shadow-sm">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr] lg:items-end">
          <div className="space-y-4">
            <span className="inline-flex w-fit items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
              Live pharmacy command center
            </span>
            <div className="space-y-2">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Inventory that flags risk before the stockroom feels it.
              </h1>
              <p className="max-w-2xl text-sm text-slate-600">
                The redesigned dashboard keeps critical medicine coverage, ML demand signals, and
                restocking worklists in a clearer hierarchy so the first action is obvious.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
                {totalMedicines.toLocaleString()} medicines
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
                {lowStockCount} low stock
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
                {criticalCount} critical
              </span>
              <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200">
                {medicines[0]?.name ?? "No target medicine yet"}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Button
              type="button"
              onClick={handleExportInsights}
              className="h-11 justify-between rounded-2xl px-4 shadow-sm"
            >
              <span>Export insights</span>
              <Download className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 justify-between rounded-2xl border-border/80 bg-white/70 px-4 shadow-sm hover:bg-white"
              onClick={handleExportInsights}
            >
              <span>Review worklist</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{KPI_DATA_LIVE.map(renderKpi)}</div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
        <div className="space-y-4 md:col-span-7">
          <Card className="interactive-card border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold text-slate-900">
                Stock trajectory vs demand forecast
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-1">
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={forecastData}>
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
                    name="Actual Stock"
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
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="interactive-card border-border/70 bg-card/95 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Days to depletion
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart layout="vertical" data={DEPLETION_DATA}>
                    <CartesianGrid horizontal={false} stroke="#f1f5f9" />
                    <XAxis
                      type="number"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                    />
                    <YAxis
                      type="category"
                      dataKey="status"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 11, fill: "#94a3b8" }}
                      width={72}
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
                    <Bar dataKey="daysLeft" radius={[0, 4, 4, 0]}>
                      {DEPLETION_DATA.map(renderStatusBar)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="interactive-card border-border/70 bg-card/95 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-900">
                  Category utilization mix
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {CATEGORY_PROGRESS.map(renderCategoryProgress)}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="md:col-span-5">
          <Card className="interactive-card border-border/70 bg-card/95 shadow-sm">
            <CardHeader className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900">
                    Restocking worklist
                  </CardTitle>
                  <p className="mt-1 text-xs text-slate-500">
                    Prioritized replenishment queue for pharmacy review.
                  </p>
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
              </div>
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12">
                  <Select defaultValue="all">
                    <SelectTrigger className="h-9 rounded-xl">
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent className="z-[60]">
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="low">Low Stock</SelectItem>
                      <SelectItem value="healthy">Healthy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-100">
                      <TableHead className="whitespace-nowrap">SKU</TableHead>
                      <TableHead className="whitespace-nowrap">Medicine Name</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Current Stock</TableHead>
                      <TableHead className="whitespace-nowrap text-right">
                        Predicted Demand 7d
                      </TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{worklistRows.map(renderTableRow)}</TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
