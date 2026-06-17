import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Download, Search, TrendingUp } from "lucide-react";
import { toast } from "sonner";

type Status = "Low Stock" | "Critical" | "Overstock" | "Healthy";

interface Row {
  sku: string;
  name: string;
  form: string;
  current: number;
  predicted: number;
  status: Status;
}

const ROWS: Row[] = [
  {
    sku: "MED-0001",
    name: "Paracetamol 500mg",
    form: "Tablet · Box of 100",
    current: 30,
    predicted: 140,
    status: "Low Stock",
  },
  {
    sku: "MED-0002",
    name: "Amoxicillin 500mg",
    form: "Capsule · Strip of 10",
    current: 12,
    predicted: 80,
    status: "Critical",
  },
  {
    sku: "MED-0003",
    name: "Metformin 500mg",
    form: "Tablet · Bottle of 60",
    current: 220,
    predicted: 150,
    status: "Overstock",
  },
  {
    sku: "MED-0004",
    name: "Amlodipine 5mg",
    form: "Tablet · Strip of 30",
    current: 75,
    predicted: 70,
    status: "Healthy",
  },
  {
    sku: "MED-0005",
    name: "Omeprazole 20mg",
    form: "Capsule · Box of 50",
    current: 18,
    predicted: 90,
    status: "Low Stock",
  },
  {
    sku: "MED-0006",
    name: "Ibuprofen 200mg",
    form: "Tablet · Box of 100",
    current: 45,
    predicted: 110,
    status: "Low Stock",
  },
  {
    sku: "MED-0007",
    name: "Ceftriaxone 1g",
    form: "Injection · Vial",
    current: 8,
    predicted: 35,
    status: "Critical",
  },
  {
    sku: "MED-0008",
    name: "Insulin Glargine",
    form: "Injection · Pen",
    current: 60,
    predicted: 65,
    status: "Healthy",
  },
  {
    sku: "MED-0009",
    name: "Salbutamol",
    form: "Inhaler · 200 doses",
    current: 25,
    predicted: 90,
    status: "Low Stock",
  },
  {
    sku: "MED-0010",
    name: "Ranitidine 150mg",
    form: "Tablet · Strip of 20",
    current: 5,
    predicted: 40,
    status: "Critical",
  },
];

function StatusBadge({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    "Low Stock": "bg-danger-soft text-danger border border-danger/20 hover:bg-danger-soft",
    Critical:
      "bg-critical-soft text-critical border border-critical/30 hover:bg-critical-soft font-semibold",
    Overstock: "bg-success-soft text-success border border-success/20 hover:bg-success-soft",
    Healthy: "bg-muted text-muted-foreground border border-border hover:bg-muted",
  };
  return (
    <Badge className={`${styles[status]} rounded-md font-medium`}>
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current mr-1.5" />
      {status}
    </Badge>
  );
}

export function RestockingTable() {
  const [filter, setFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return ROWS.filter((r) => {
      const matchesFilter =
        filter === "all" ||
        (filter === "low" && r.status === "Low Stock") ||
        (filter === "critical" && r.status === "Critical") ||
        (filter === "overstock" && r.status === "Overstock");
      const q = query.trim().toLowerCase();
      const matchesQuery =
        !q || r.sku.toLowerCase().includes(q) || r.name.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query]);

  function handleExport() {
    toast.success("Restocking table export has been triggered.");
  }

  return (
    <section className="rounded-xl border border-border bg-surface shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Smart Restocking Alerts
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              AI-powered suggestions for purchase orders
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search medicine or SKU..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9 w-full sm:w-64 bg-background border-border"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-full sm:w-40 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="low">Low Stock</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="overstock">Overstock</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExport}
              className="gap-1.5 hover:bg-slate-100 hover:text-slate-900"
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60 hover:bg-muted/60 border-b border-border">
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground py-3">
                SKU
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Medicine Name
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-right">
                Current Stock
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-right">
                Predicted Demand (7d)
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                Status
              </TableHead>
              <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-right">
                Action
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => {
              const handleReview = () => {
                toast.success(`Review requested for ${row.name}.`);
              };
              const deficit = row.predicted > row.current;
              return (
                <TableRow
                  key={row.sku}
                  className="border-b border-border last:border-0 hover:bg-muted/40 transition-colors"
                >
                  <TableCell className="py-4 font-mono text-xs text-muted-foreground">
                    {row.sku}
                  </TableCell>
                  <TableCell className="py-4">
                    <div className="font-medium text-foreground">{row.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{row.form}</div>
                  </TableCell>
                  <TableCell className="py-4 text-right tabular-nums font-semibold text-foreground">
                    {row.current}
                  </TableCell>
                  <TableCell className="py-4 text-right">
                    <span className="inline-flex items-center gap-1 tabular-nums font-medium text-foreground">
                      {deficit && <TrendingUp className="h-3.5 w-3.5 text-danger" />}
                      {row.predicted}
                    </span>
                  </TableCell>
                  <TableCell className="py-4">
                    <StatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="py-4 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleReview}
                      className="gap-1.5 hover:bg-primary hover:text-primary-foreground hover:border-primary"
                    >
                      Review PO
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">
                  No medicines match your filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="px-6 py-3 border-t border-border bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
        <span>
          Showing <span className="font-semibold text-foreground">{filtered.length}</span> of{" "}
          <span className="font-semibold text-foreground">{ROWS.length}</span> alerts
        </span>
        <span>Updated 2 minutes ago</span>
      </div>
    </section>
  );
}
