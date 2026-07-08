import { useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, AlertTriangle, Calendar, DollarSign, Download, TrendingUp } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useMedicines } from "@/hooks/use-api";
import { Skeleton } from "@/components/ui/skeleton";

/** KPI tile definition for the analytics header strip */
export interface MetricCard {
  id: string;
  title: string;
  value: string;
  subtext?: string;
  icon: LucideIcon;
  valueClassName?: string;
  iconClassName?: string;
}

/** Shared chart row shape: overview bars use movement fields; ML tab uses consumption fields */
export interface ChartData {
  name: string;
  fastMoving?: number;
  slowMoving?: number;
  actualConsumption?: number;
  predictedDemand?: number;
}

/** Row payload for anomaly and financial expiry tables (discriminated by `kind`) */
export type ReportRow =
  | {
      kind: "anomaly";
      id: string;
      medicine: string;
      expectedStock: number;
      actualStock: number;
      variance: number;
    }
  | {
      kind: "financial";
      id: string;
      sku: string;
      medicine: string;
      batch: string;
      expiryDate: string;
      remainingQty: number;
      potentialFinancialLossIdr: number;
    };

const overviewData: ChartData[] = [
  { name: "Cardiovascular", fastMoving: 840, slowMoving: 190 },
  { name: "Antibiotic", fastMoving: 620, slowMoving: 260 },
  { name: "Metabolic", fastMoving: 510, slowMoving: 140 },
  { name: "Analgesic", fastMoving: 780, slowMoving: 95 },
  { name: "Respiratory", fastMoving: 430, slowMoving: 175 },
];

const mlData: ChartData[] = [
  { name: "Mon", actualConsumption: 112, predictedDemand: 108 },
  { name: "Tue", actualConsumption: 124, predictedDemand: 121 },
  { name: "Wed", actualConsumption: 118, predictedDemand: 126 },
  { name: "Thu", actualConsumption: 132, predictedDemand: 128 },
  { name: "Fri", actualConsumption: 128, predictedDemand: 131 },
  { name: "Sat", actualConsumption: 96, predictedDemand: 99 },
  { name: "Sun", actualConsumption: 88, predictedDemand: 91 },
];

const ANOMALY_ROWS: Extract<ReportRow, { kind: "anomaly" }>[] = [
  {
    kind: "anomaly",
    id: "an-01",
    medicine: "Paracetamol 500mg",
    expectedStock: 420,
    actualStock: 312,
    variance: -108,
  },
  {
    kind: "anomaly",
    id: "an-02",
    medicine: "Ceftriaxone 1g",
    expectedStock: 64,
    actualStock: 22,
    variance: -42,
  },
  {
    kind: "anomaly",
    id: "an-03",
    medicine: "Metformin 500mg",
    expectedStock: 280,
    actualStock: 402,
    variance: 122,
  },
  {
    kind: "anomaly",
    id: "an-04",
    medicine: "Omeprazole 20mg",
    expectedStock: 150,
    actualStock: 118,
    variance: -32,
  },
];

const FINANCIAL_ROWS: Extract<ReportRow, { kind: "financial" }>[] = [
  {
    kind: "financial",
    id: "fin-01",
    sku: "MED-4412",
    medicine: "Amoxicillin 500mg",
    batch: "BTH-26-014",
    expiryDate: "2026-06-12",
    remainingQty: 180,
    potentialFinancialLossIdr: 2_450_000,
  },
  {
    kind: "financial",
    id: "fin-02",
    sku: "MED-8821",
    medicine: "Insulin Glargine",
    batch: "BTH-25-902",
    expiryDate: "2026-05-03",
    remainingQty: 42,
    potentialFinancialLossIdr: 4_180_000,
  },
  {
    kind: "financial",
    id: "fin-03",
    sku: "MED-1190",
    medicine: "Salbutamol Inhaler",
    batch: "BTH-26-033",
    expiryDate: "2026-07-21",
    remainingQty: 60,
    potentialFinancialLossIdr: 1_020_000,
  },
  {
    kind: "financial",
    id: "fin-04",
    sku: "MED-3304",
    medicine: "Amlodipine 5mg",
    batch: "BTH-25-771",
    expiryDate: "2026-04-28",
    remainingQty: 320,
    potentialFinancialLossIdr: 850_000,
  },
];

const KPI_METRICS: MetricCard[] = [
  {
    id: "inv-value",
    title: "Total Inventory Value",
    value: "Rp 145.000.000",
    icon: DollarSign,
    iconClassName: "text-primary",
  },
  {
    id: "ml-accuracy",
    title: "ML Forecast Accuracy",
    value: "92.4%",
    subtext: "Baseline model from transaction history",
    icon: Activity,
    iconClassName: "text-sky-600 dark:text-sky-400",
  },
  {
    id: "risk-value",
    title: "Risk Value (Expiring < 90 Days)",
    value: "Rp 8.500.000",
    icon: AlertTriangle,
    iconClassName: "text-destructive",
    valueClassName: "text-destructive",
  },
  {
    id: "turnover",
    title: "Inventory Turnover Ratio",
    value: "4.2x",
    icon: TrendingUp,
    iconClassName: "text-emerald-600 dark:text-emerald-400",
  },
];

function formatIdr(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatExpiry(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function VarianceBadge({ variance }: { variance: number }) {
  if (variance === 0) {
    return (
      <Badge variant="secondary" className="tabular-nums">
        0
      </Badge>
    );
  }
  if (variance < 0) {
    return (
      <Badge variant="destructive" className="tabular-nums">
        {variance.toLocaleString("id-ID")}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="border-emerald-500/35 bg-emerald-500/10 text-emerald-900 tabular-nums dark:text-emerald-100"
    >
      +{variance.toLocaleString("id-ID")}
    </Badge>
  );
}

function ChartFallback({ label }: { label: string }) {
  return (
    <div className="flex aspect-[16/9] min-h-[220px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 text-center">
      <p className="text-sm font-medium text-foreground">Chart unavailable</p>
      <p className="max-w-sm text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export function ReportsPage() {
  const [reportScope, setReportScope] = useState("hospital-wide");
  const { data: medicines = [], isLoading } = useMedicines();

  const totalInventoryValue = medicines.reduce((acc, m) => acc + m.current_stock * 15000, 0);
  const riskValue = medicines
    .filter((m) => m.current_stock <= m.safety_stock_level)
    .reduce((acc, m) => acc + m.current_stock * 15000, 0);

  const ANOMALY_ROWS = medicines
    .filter((m) => m.current_stock !== m.safety_stock_level)
    .slice(0, 4)
    .map((m, i) => ({
      kind: "anomaly" as const,
      id: `an-${i + 1}`,
      medicine: m.name,
      expectedStock: m.safety_stock_level,
      actualStock: m.current_stock,
      variance: m.current_stock - m.safety_stock_level,
    }));

  const KPI_METRICS_LIVE: MetricCard[] = [
    {
      id: "inv-value",
      title: "Total Inventory Value",
      value: new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(totalInventoryValue),
      icon: DollarSign,
      iconClassName: "text-primary",
    },
    {
      id: "ml-accuracy",
      title: "ML Forecast Accuracy",
      value: "92.4%",
      subtext: "Baseline model from transaction history",
      icon: Activity,
      iconClassName: "text-sky-600 dark:text-sky-400",
    },
    {
      id: "risk-value",
      title: "Risk Value (Expiring < 90 Days)",
      value: new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0,
      }).format(riskValue),
      icon: AlertTriangle,
      iconClassName: "text-destructive",
      valueClassName: "text-destructive",
    },
    {
      id: "turnover",
      title: "Inventory Turnover Ratio",
      value: "4.2x",
      icon: TrendingUp,
      iconClassName: "text-emerald-600 dark:text-emerald-400",
    },
  ];

  const safeOverview = useMemo(
    () =>
      overviewData.filter(
        (d) => typeof d.fastMoving === "number" && typeof d.slowMoving === "number",
      ),
    [],
  );

  const safeMl = useMemo(
    () =>
      mlData.filter(
        (d) => typeof d.actualConsumption === "number" && typeof d.predictedDemand === "number",
      ),
    [],
  );

  function handleDateRangeClick() {
    toast.success("Last 30 Days filter toggled.");
  }

  function handleExportClick() {
    toast.success("Report export has been triggered.");
  }

  return (
    <div className="mt-6 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto">
          <Select value={reportScope} onValueChange={setReportScope}>
            <SelectTrigger
              className="w-full bg-surface border-border sm:w-[200px]"
              aria-label="Report scope"
            >
              <SelectValue placeholder="Scope" />
            </SelectTrigger>
            <SelectContent className="z-[60]">
              <SelectItem value="hospital-wide">Hospital-wide</SelectItem>
              <SelectItem value="inpatient">Inpatient pharmacy</SelectItem>
              <SelectItem value="outpatient">Outpatient pharmacy</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            onClick={handleDateRangeClick}
            className="gap-2 bg-surface border-border hover:bg-slate-100"
          >
            <Calendar className="h-4 w-4" />
            Last 30 Days
          </Button>
          <Button type="button" onClick={handleExportClick} className="gap-2 shadow-sm">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))
          : KPI_METRICS_LIVE.map((metric) => {
              const Icon = metric.icon;
              return (
                <Card
                  key={metric.id}
                  className="relative overflow-hidden border-border bg-surface shadow-sm transition-shadow hover:shadow-md"
                >
                  <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary/25" aria-hidden />
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {metric.title}
                    </CardTitle>
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10",
                        metric.iconClassName,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p
                      className={cn(
                        "text-2xl font-bold tabular-nums tracking-tight text-foreground",
                        metric.valueClassName,
                      )}
                    >
                      {metric.value}
                    </p>
                    {metric.subtext ? (
                      <p className="mt-2 text-xs leading-snug text-muted-foreground">
                        {metric.subtext}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
      </section>

      <Tabs defaultValue="overview" className="w-full space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-1 gap-1 bg-muted p-1 sm:grid-cols-3 sm:gap-0">
          <TabsTrigger value="overview" className="text-sm">
            Overview
          </TabsTrigger>
          <TabsTrigger value="ml" className="text-sm">
            ML Predictions
          </TabsTrigger>
          <TabsTrigger value="financial" className="text-sm">
            Financial Risk
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-6 focus-visible:outline-none">
          <Card className="border-border bg-surface shadow-sm">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg font-bold tracking-tight">Stock movement</CardTitle>
              <p className="text-sm text-muted-foreground">
                Fast-moving vs slow-moving therapeutic classes (units dispensed, trailing 30 days).
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              {safeOverview.length > 0 ? (
                <div className="h-[min(360px,50vh)] w-full min-h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={safeOverview} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                      <XAxis
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        interval={0}
                        angle={-12}
                        textAnchor="end"
                        height={56}
                      />
                      <YAxis tick={{ fontSize: 11 }} width={40} />
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
                      <Legend />
                      <Bar
                        dataKey="fastMoving"
                        name="Fast-moving"
                        fill="hsl(214 72% 42%)"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="slowMoving"
                        name="Slow-moving"
                        fill="hsl(215 16% 62%)"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ChartFallback label="Add overview movement data to render this chart." />
              )}
            </CardContent>
          </Card>

          <Card className="border-border bg-surface shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg font-bold tracking-tight">Recent anomalies</CardTitle>
              <p className="text-sm text-muted-foreground">
                Variance between expected on-hand stock (ERP) and observed cycle-count / ADC
                telemetry.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="pl-6 font-semibold text-foreground whitespace-nowrap">
                        Medicine
                      </TableHead>
                      <TableHead className="text-right font-semibold text-foreground whitespace-nowrap">
                        Expected Stock
                      </TableHead>
                      <TableHead className="text-right font-semibold text-foreground whitespace-nowrap">
                        Actual Stock
                      </TableHead>
                      <TableHead className="pr-6 text-right font-semibold text-foreground whitespace-nowrap">
                        Variance
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading
                      ? Array.from({ length: 4 }).map((_, i) => (
                          <TableRow key={i} className="border-border">
                            {["pl-6", "", "", "pr-6 text-right"].map((cls, j) => (
                              <TableCell key={j} className={cls}>
                                <Skeleton className="h-4 w-full" />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))
                      : ANOMALY_ROWS.map((row) => (
                          <TableRow key={row.id} className="border-border">
                            <TableCell className="pl-6 font-medium text-foreground">
                              {row.medicine}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {row.expectedStock.toLocaleString("id-ID")}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-muted-foreground">
                              {row.actualStock.toLocaleString("id-ID")}
                            </TableCell>
                            <TableCell className="pr-6 text-right">
                              <VarianceBadge variance={row.variance} />
                            </TableCell>
                          </TableRow>
                        ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ml" className="mt-0 space-y-6 focus-visible:outline-none">
          <Card className="border-border bg-surface shadow-sm">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg font-bold tracking-tight">Predictive engine</CardTitle>
              <p className="text-sm text-muted-foreground">
                Seven-day inpatient consumption vs modelled demand from transaction history.
              </p>
            </CardHeader>
            <CardContent className="pt-6">
              {safeMl.length > 0 ? (
                <div className="h-[min(360px,50vh)] w-full min-h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={safeMl} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} width={36} />
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
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="actualConsumption"
                        name="Actual consumption"
                        stroke="hsl(214 72% 42%)"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="predictedDemand"
                        name="Predicted demand"
                        stroke="hsl(280 55% 48%)"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                        dot={{ r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ChartFallback label="Add ML series data to render this chart." />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial" className="mt-0 focus-visible:outline-none">
          <Card className="border-border bg-surface shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-lg font-bold tracking-tight">
                Valuation & expiry exposure
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Batches with expiry under 90 days — potential write-off if not rotated or returned.
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="pl-6 font-semibold text-foreground whitespace-nowrap">
                        SKU
                      </TableHead>
                      <TableHead className="font-semibold text-foreground whitespace-nowrap">
                        Medicine
                      </TableHead>
                      <TableHead className="font-semibold text-foreground whitespace-nowrap">
                        Batch
                      </TableHead>
                      <TableHead className="font-semibold text-foreground whitespace-nowrap">
                        Expiry Date
                      </TableHead>
                      <TableHead className="text-right font-semibold text-foreground whitespace-nowrap">
                        Remaining Qty
                      </TableHead>
                      <TableHead className="pr-6 text-right font-semibold text-foreground whitespace-nowrap">
                        Potential Financial Loss (Rp)
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {FINANCIAL_ROWS.map((row) => (
                      <TableRow key={row.id} className="border-border">
                        <TableCell className="pl-6 font-mono text-xs text-muted-foreground">
                          {row.sku}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {row.medicine}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {row.batch}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {formatExpiry(row.expiryDate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {row.remainingQty.toLocaleString("id-ID")}
                        </TableCell>
                        <TableCell className="pr-6 text-right font-semibold tabular-nums text-destructive">
                          {formatIdr(row.potentialFinancialLossIdr)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
