import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useRouterState } from "@tanstack/react-router";
import { Pencil, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import { toast } from "sonner";
import {
  useCreateMedicine,
  useDeleteMedicine,
  useMedicines,
  useEvaluateRestocking,
  useSuppliers,
  useUpdateMedicine,
} from "@/hooks/use-api";
import { medicineSchema, type MedicineFormData } from "@/schemas";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";
import { handleApiError } from "@/lib/toast-handlers";
import type { RestockingEvalResponse } from "@/types/api.types";

type MedicineRow = {
  id: number;
  sku: string;
  name: string;
  category: string;
  unit: string;
  currentStock: number;
  safetyStock: number;
  supplierId: number;
};

type InventoryFocus = "all" | "alerts";

const CATEGORY_OPTIONS = [
  "Analgesic / Antipyretic",
  "Antibiotic",
  "Antidiabetic",
  "Gastrointestinal",
  "Cardiovascular",
] as const;

const UNIT_OPTIONS = [
  "Tablets (box of 100)",
  "Capsules (strip of 10)",
  "Tablets (bottle of 60)",
  "Vials (powder for injection)",
  "Pre-filled pens",
] as const;

function StockStatusBadge({
  currentStock,
  safetyStock,
}: {
  currentStock: number;
  safetyStock: number;
}) {
  const healthy = currentStock > safetyStock;
  if (healthy) {
    return (
      <Badge
        className="rounded-md font-medium border border-success/20 bg-success-soft text-success shadow-none hover:bg-success-soft"
        variant="outline"
      >
        <span className="relative mr-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        Healthy
      </Badge>
    );
  }
  return (
    <Badge variant="destructive" className="rounded-md font-medium shadow-none">
      <span className="relative mr-1.5 inline-flex h-1.5 w-1.5 rounded-full bg-destructive-foreground/80" />
      Low Stock
    </Badge>
  );
}

export function InventoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingSku, setEditingSku] = useState<string | null>(null);
  const [restockDialogOpen, setRestockDialogOpen] = useState(false);
  const [restockEvaluation, setRestockEvaluation] = useState<RestockingEvalResponse | null>(null);
  const [restockMedicineId, setRestockMedicineId] = useState<number | null>(null);
  const [restockSupplierId, setRestockSupplierId] = useState<string>("");
  const dashboardSearch = useRouterState({
    select: (state) => (state.location.search as { focus?: string } | undefined) ?? {},
  });

  const { data: medicines = [], isLoading, isError } = useMedicines();
  const { data: suppliers = [] } = useSuppliers();
  const createMedicine = useCreateMedicine();
  const updateMedicine = useUpdateMedicine();
  const deleteMedicine = useDeleteMedicine();
  const evaluateRestocking = useEvaluateRestocking();

  const supplierNameById = useMemo(
    () => new Map<number, string>(suppliers.map((supplier) => [supplier.id, supplier.name])),
    [suppliers],
  );

  const medicineRows: MedicineRow[] = useMemo(
    () =>
      medicines.map((m) => ({
        id: m.id,
        sku: m.sku_code,
        name: m.name,
        category: m.category,
        unit: m.unit_measurement,
        currentStock: m.current_stock,
        safetyStock: m.safety_stock_level,
        supplierId: m.supplier_id,
      })),
    [medicines],
  );

  const dashboardFocus: InventoryFocus = dashboardSearch.focus === "alerts" ? "alerts" : "all";

  const filteredMedicines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return medicineRows.filter((m) => {
      const matchesQuery =
        !q || m.sku.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
      const matchesFocus = dashboardFocus === "all" ? true : m.currentStock <= m.safetyStock;

      return matchesQuery && matchesFocus;
    });
  }, [dashboardFocus, medicineRows, searchQuery]);

  const dashboardFocusLabel =
    dashboardFocus === "alerts" ? "Showing medicines that need restock review." : null;

  const form = useForm<MedicineFormData>({
    resolver: zodResolver(medicineSchema),
    defaultValues: { name: "", sku: "", category: "", unit: "", safetyStock: 0 },
  });

  function openAddDialog() {
    form.reset();
    setEditingSku(null);
    setAddDialogOpen(true);
  }

  function openEditDialog(row: MedicineRow) {
    form.reset({
      name: row.name,
      sku: row.sku,
      category: row.category,
      unit: row.unit,
      safetyStock: row.safetyStock,
    });
    setEditingSku(row.sku);
    setAddDialogOpen(true);
  }

  function handleDialogOpenChange(open: boolean) {
    setAddDialogOpen(open);
    if (!open) {
      setEditingSku(null);
      form.reset();
    }
  }

  function handleSaveMedicine(data: MedicineFormData) {
    const existing = editingSku ? medicineRows.find((m) => m.sku === editingSku) : null;
    const fallbackSupplierId = suppliers[0]?.id ?? null;

    if (!existing && fallbackSupplierId === null) {
      toast.error("Add a supplier first", {
        description: "This inventory item needs a real supplier before it can be saved.",
      });
      return;
    }

    const payload = {
      sku_code: data.sku,
      name: data.name,
      category: data.category,
      unit_measurement: data.unit,
      safety_stock_level: data.safetyStock,
      supplier_id: existing?.supplierId ?? fallbackSupplierId,
    };

    if (existing) {
      updateMedicine.mutate(
        { id: existing.id, payload },
        {
          onSuccess: () => {
            toast.success(`${data.name} updated.`);
            handleDialogOpenChange(false);
          },
          onError: (err) => handleApiError("Update medicine", err),
        },
      );
      return;
    }

    createMedicine.mutate(
      { ...payload, current_stock: 0 },
      {
        onSuccess: () => {
          toast.success(`${data.name} added to inventory.`);
          handleDialogOpenChange(false);
        },
        onError: (err) => handleApiError("Add medicine", err),
      },
    );
  }

  function handleDelete(sku: string) {
    const target = medicineRows.find((m) => m.sku === sku);
    if (!target) return;

    deleteMedicine.mutate(target.id, {
      onSuccess: () => toast.success(`${target.name} deleted.`),
      onError: (err) => handleApiError("Delete medicine", err),
    });
  }

  function handleRestock(row: MedicineRow) {
    setRestockMedicineId(row.id);
    setRestockSupplierId(String(row.supplierId));
    evaluateRestocking.mutate(
      { medicineId: row.id },
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

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto lg:justify-end">
          <div className="relative flex-1 min-w-0 lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by SKU or medicine name..."
              className="bg-surface border-border pl-9"
              aria-label="Search inventory"
            />
          </div>
          <Button type="button" className="shrink-0 shadow-sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4" />
            Add New Medicine
          </Button>
        </div>
      </div>

      {dashboardFocusLabel ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-amber-900">Dashboard drilldown</p>
            <p className="text-xs text-amber-800">{dashboardFocusLabel}</p>
          </div>
          <Link
            to="/inventory"
            className="inline-flex items-center justify-center rounded-full border border-amber-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-amber-900 transition-colors hover:bg-white"
          >
            Clear filter
          </Link>
        </div>
      ) : null}

      <Card className="border-border bg-surface shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg font-bold tracking-tight">Stock register</CardTitle>
          <CardDescription>
            {filteredMedicines.length} of {medicineRows.length} items shown
            {searchQuery.trim() ? ` matching "${searchQuery.trim()}"` : ""}.
          </CardDescription>
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
                    Medicine Name
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Category
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Unit
                  </TableHead>
                  <TableHead className="text-right font-semibold text-foreground whitespace-nowrap">
                    Current Stock
                  </TableHead>
                  <TableHead className="text-right font-semibold text-foreground whitespace-nowrap">
                    Safety Stock
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Status
                  </TableHead>
                  <TableHead className="pr-6 text-right font-semibold text-foreground whitespace-nowrap">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell
                          key={j}
                          className={j === 0 ? "pl-6" : j === 7 ? "pr-6 text-right" : ""}
                        >
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : isError ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-destructive text-sm">
                      Failed to load medicines. Check API connectivity.
                    </TableCell>
                  </TableRow>
                ) : filteredMedicines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                      No medicines match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMedicines.map((row) => (
                    <TableRow key={row.sku} className="border-border">
                      <TableCell className="pl-6 font-mono text-xs text-muted-foreground">
                        {row.sku}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">{row.category}</TableCell>
                      <TableCell
                        className="max-w-[200px] truncate text-muted-foreground"
                        title={row.unit}
                      >
                        {row.unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium text-foreground">
                        {row.currentStock.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row.safetyStock.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <StockStatusBadge
                          currentStock={row.currentStock}
                          safetyStock={row.safetyStock}
                        />
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {row.currentStock <= row.safetyStock ? (
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => handleRestock(row)}
                              disabled={
                                evaluateRestocking.isPending && restockMedicineId === row.id
                              }
                            >
                              <ShoppingCart className="h-4 w-4" />
                              {evaluateRestocking.isPending && restockMedicineId === row.id
                                ? "Checking…"
                                : "Restock"}
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-foreground"
                            aria-label={`Edit ${row.name}`}
                            onClick={() => openEditDialog(row)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                            aria-label={`Delete ${row.name}`}
                            onClick={() => handleDelete(row.sku)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={addDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="border-border-strong bg-background sm:max-w-md">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSaveMedicine)}>
              <DialogHeader>
                <DialogTitle>{editingSku ? "Edit medicine" : "Add new medicine"}</DialogTitle>
                <DialogDescription>
                  {editingSku
                    ? "Update catalogue fields. Stock levels sync with the backend."
                    : "Register a new medicine in the formulary."}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="e.g. Paracetamol 500mg"
                          className="bg-surface border-border"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled={Boolean(editingSku)}
                          className="bg-surface border-border font-mono text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-surface border-border">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="z-[60]">
                          {CATEGORY_OPTIONS.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit measurement</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-surface border-border">
                            <SelectValue placeholder="Select unit" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="z-[60]">
                          {UNIT_OPTIONS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {u}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="safetyStock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Safety stock level</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          {...field}
                          className="bg-surface border-border tabular-nums"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDialogOpenChange(false)}
                  className="hover:bg-slate-100"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMedicine.isPending || updateMedicine.isPending}
                >
                  {createMedicine.isPending || updateMedicine.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

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
                {(() => {
                  const draftAIFactors = restockEvaluation.draft_ai_factors ?? [];

                  return (
                    <>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Medicine
                        </p>
                        <p className="font-semibold text-foreground">
                          {restockEvaluation.medicine_name}
                        </p>
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
                            {medicineRows
                              .find((m) => m.id === restockEvaluation.medicine_id)
                              ?.safetyStock.toLocaleString() ?? "-"}
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
                        {draftAIFactors.length ? (
                          <ul className="mt-2 list-disc space-y-1 pl-5">
                            {draftAIFactors.map((factor) => (
                              <li key={factor}>{factor}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">Supplier</p>
                        <Select value={restockSupplierId} onValueChange={setRestockSupplierId}>
                          <SelectTrigger className="bg-background border-border">
                            <SelectValue placeholder="Choose supplier" />
                          </SelectTrigger>
                          <SelectContent className="z-[60]">
                            {suppliers.map((supplier) => (
                              <SelectItem key={supplier.id} value={String(supplier.id)}>
                                {supplier.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  );
                })()}
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
