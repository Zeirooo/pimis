import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Eye,
  FileClock,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
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
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { toast } from "sonner";
import {
  useMedicines,
  usePurchaseOrders,
  useSuppliers,
  queryKeys,
  useCreateManualPurchaseOrder,
  useEvaluateRestocking,
} from "@/hooks/use-api";
import { apiFetch } from "@/lib/api-client";
import { handleApiError } from "@/lib/toast-handlers";
import { Skeleton } from "@/components/ui/skeleton";
import type { PurchaseOrderResponse } from "@/types/api.types";
import type { Supplier } from "@/types/api.types";

export type POStatus = "Pending AI" | "Rejected" | "Approved" | "Completed";

export type POItem = {
  name: string;
  qty: number;
  medicineId?: number;
};

export type PurchaseOrder = {
  poNumber: string;
  date: string;
  supplier: string;
  status: POStatus;
  items: POItem[];
  _rawId?: number;
  _rawStatus?: string;
};

type ManualPoLineItem = {
  id: string;
  medicineId: string;
  orderQuantity: string;
  unitPriceEstimate: string;
};

function createManualPoLineItem(overrides?: Partial<ManualPoLineItem>): ManualPoLineItem {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    medicineId: "",
    orderQuantity: "1",
    unitPriceEstimate: "",
    ...overrides,
  };
}

const STATUS_FILTER_VALUES = ["all", "Pending AI", "Rejected", "Approved", "Completed"] as const;
type StatusFilterValue = (typeof STATUS_FILTER_VALUES)[number];

const INITIAL_ORDERS: PurchaseOrder[] = [
  {
    poNumber: "PO-AI-20260401",
    date: "2026-04-01",
    supplier: "PT Kimia Farma",
    status: "Pending AI",
    items: [{ name: "Paracetamol 500mg", qty: 150 }],
  },
  {
    poNumber: "PO-2026-0142",
    date: "2026-03-28",
    supplier: "PT Dexa Medica",
    status: "Rejected",
    items: [
      { name: "Amoxicillin 500mg", qty: 80 },
      { name: "Ceftriaxone 1g", qty: 24 },
      { name: "Normal Saline 0.9% 500ml", qty: 200 },
    ],
  },
  {
    poNumber: "PO-2026-0098",
    date: "2026-03-15",
    supplier: "PT Kalbe Farma",
    status: "Approved",
    items: [
      { name: "Metformin 500mg", qty: 360 },
      { name: "Amlodipine 5mg", qty: 120 },
    ],
  },
  {
    poNumber: "PO-2026-0012",
    date: "2026-02-20",
    supplier: "PT Sanbe Farma",
    status: "Completed",
    items: [
      { name: "Omeprazole 20mg", qty: 90 },
      { name: "Ranitidine 150mg", qty: 60 },
      { name: "Ibuprofen 200mg", qty: 200 },
      { name: "Vitamin B Complex", qty: 48 },
    ],
  },
  {
    poNumber: "PO-2026-0188",
    date: "2026-04-02",
    supplier: "PT Indofarma",
    status: "Rejected",
    items: [
      { name: "Insulin Glargine 100IU", qty: 40 },
      { name: "Salbutamol Inhaler", qty: 35 },
    ],
  },
];

function mapApiPOToLocal(po: PurchaseOrderResponse, supplierNameById: Map<number, string>) {
  const statusMap: Record<string, POStatus> = {
    DRAFT_AI: "Pending AI",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    SENT_TO_VENDOR: "Approved",
    COMPLETED: "Completed",
  };
  return {
    poNumber: po.po_number,
    date: po.created_at.split("T")[0],
    supplier: supplierNameById.get(po.supplier_id) ?? `Supplier #${po.supplier_id}`,
    status: statusMap[po.status] ?? "Rejected",
    items: po.items.map((item) => ({
      name: `Medicine #${item.medicine_id}`,
      qty: item.order_quantity,
    })),
    _rawId: po.id,
    _rawStatus: po.status,
  };
}

function lineItemCount(po: PurchaseOrder): number {
  return po.items.reduce((sum, item) => sum + item.qty, 0);
}

function formatDisplayDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status, onClick }: { status: POStatus; onClick?: () => void }) {
  const styles: Record<POStatus, string> = {
    "Pending AI":
      "border border-violet-500/35 bg-violet-500/12 text-violet-800 shadow-none hover:bg-violet-500/15 dark:text-violet-200",
    "Rejected":
      "border border-amber-500/35 bg-amber-500/12 text-amber-900 shadow-none hover:bg-amber-500/15 dark:text-amber-100",
    Approved:
      "border border-sky-500/35 bg-sky-500/12 text-sky-900 shadow-none hover:bg-sky-500/15 dark:text-sky-100",
    Completed:
      "border border-success/30 bg-success-soft text-success shadow-none hover:bg-success-soft",
  };

  const badge = (
    <Badge
      className={`rounded-md font-medium ${styles[status]} ${onClick ? "cursor-pointer" : ""}`}
      variant="outline"
    >
      {status === "Pending AI" && <Bot className="mr-1 h-3 w-3 opacity-80" aria-hidden />}
      {status}
    </Badge>
  );

  if (!onClick) return badge;

  return (
    <button
      type="button"
      className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={onClick}
      aria-label={
        status === "Pending AI" ? "Open pending AI summary" : `Open ${status} purchase order review`
      }
    >
      {badge}
    </button>
  );
}

export function PurchaseOrdersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [activePoTab, setActivePoTab] = useState<"Recomended PO" | "draft-ai" | "history">("Recomended PO");
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editItems, setEditItems] = useState<PurchaseOrder["items"]>([]);
  const [selectedSummaryPO, setSelectedSummaryPO] = useState<PurchaseOrder | null>(null);
  const [isManualDialogOpen, setIsManualDialogOpen] = useState(false);
  const [manualSupplierId, setManualSupplierId] = useState("");
  const [manualMedicineSearch, setManualMedicineSearch] = useState("");
  const [isMedicineSuggestionsOpen, setIsMedicineSuggestionsOpen] = useState(false);
  const [manualPoNumber, setManualPoNumber] = useState("");
  const [manualItems, setManualItems] = useState<ManualPoLineItem[]>([]);
  const [isQuantityDialogOpen, setIsQuantityDialogOpen] = useState(false);
  const [selectedMedicineForQty, setSelectedMedicineForQty] = useState<any>(null);
  const [quantityInput, setQuantityInput] = useState("1");

  const { data: orders = [], isLoading, isError } = usePurchaseOrders();
  const { data: medicines = [] } = useMedicines();
  const { data: suppliers = [] } = useSuppliers();
  const queryClient = useQueryClient();
  const createManualPo = useCreateManualPurchaseOrder();
  const evaluateRestocking = useEvaluateRestocking();
  const draftCreationStarted = useRef(false);

  const supplierNameById = useMemo(
    () =>
      new Map<number, string>(suppliers.map((supplier: Supplier) => [supplier.id, supplier.name])),
    [suppliers],
  );

  const medicineNameById = useMemo(
    () => new Map<number, string>(medicines.map((medicine) => [medicine.id, medicine.name])),
    [medicines],
  );

  const mappedOrders = useMemo(
    () =>
      orders.map((po) => ({
        ...mapApiPOToLocal(po, supplierNameById),
        items: po.items.map((item) => ({
          name: medicineNameById.get(item.medicine_id) ?? `Medicine #${item.medicine_id}`,
          qty: item.order_quantity,
          medicineId: item.medicine_id,
        })),
      })),
    [orders, supplierNameById, medicineNameById],
  );

  const draftAiOrders = useMemo(
    () => mappedOrders.filter((po) => po.status === "Pending AI"),
    [mappedOrders],
  );

  const draftAiRows = useMemo(() => draftAiOrders.map((po) => ({ po })), [draftAiOrders]);

  const buildDraftAiReason = (po: PurchaseOrder) => {
    if (po.status !== "Pending AI") return null;

    const firstItem = po.items[0];
    if (!firstItem) {
      return {
        summary:
          "This draft was created by the restocking automation, but no line items are attached yet.",
        factors: ["No draft line items were found."],
      };
    }

    const medicine = medicines.find((item) => item.id === firstItem.medicineId);
    if (!medicine) {
      return {
        summary:
          "This draft was created by the restocking automation. The linked medicine record is not available right now.",
        factors: ["Linked medicine record not found in the current cache."],
      };
    }

    const recommendedQty = Math.max(medicine.safety_stock_level - medicine.current_stock, 1);
    const shouldApprove = medicine.current_stock <= medicine.safety_stock_level;

    return {
      summary: shouldApprove
        ? `AI created this draft because ${medicine.name} is at or below safety stock, so replenishment is recommended.`
        : `AI created this draft as a replenishment suggestion for ${medicine.name}. Review the quantity and supplier before approving.`,
      factors: [
        `Current stock: ${medicine.current_stock}`,
        `Safety stock: ${medicine.safety_stock_level}`,
        `Draft quantity: ${firstItem.qty}`,
        `Recommended minimum quantity: ${recommendedQty},`,
      ],
    };
  };

  const selectedDraftAiReason = useMemo(
    () => (selectedSummaryPO ? buildDraftAiReason(selectedSummaryPO) : null),
    [selectedSummaryPO, medicines],
  );

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return mappedOrders.filter((po) => {
      const matchesStatus = statusFilter === "all" || po.status === statusFilter;
      const matchesQuery =
        !q ||
        po.poNumber.toLowerCase().includes(q) ||
        po.supplier.toLowerCase().includes(q) ||
        po.items.some((item) => item.name.toLowerCase().includes(q));
      return matchesStatus && matchesQuery;
    });
  }, [mappedOrders, searchQuery, statusFilter]);

  const filteredHistoryOrders = useMemo(
    () => filteredOrders.filter((po) => po.status !== "Pending AI"),
    [filteredOrders],
  );

  const kpiDraftAi = useMemo(
    () => mappedOrders.filter((o) => o.status === "Pending AI").length,
    [mappedOrders],
  );
  const kpiPending = useMemo(
    () => mappedOrders.filter((o) => o.status === "Rejected").length,
    [mappedOrders],
  );
  const kpiApproved = useMemo(
    () => mappedOrders.filter((o) => o.status === "Approved").length,
    [mappedOrders],
  );
  const kpiCompleted = useMemo(
    () => mappedOrders.filter((o) => o.status === "Completed").length,
    [mappedOrders],
  );

  const selectedSupplier = useMemo(
    () => suppliers.find((supplier) => String(supplier.id) === manualSupplierId) ?? null,
    [manualSupplierId, suppliers],
  );

  const manualMedicines = useMemo(() => {
    if (!manualSupplierId) return [];
    return medicines.filter((medicine) => {
      // Support both snake_case and camelCase supplier id shapes from API
      const sid = (medicine as any).supplier_id ?? (medicine as any).supplierId;
      return String(sid) === manualSupplierId;
    });
  }, [manualSupplierId, medicines]);

  const supplierComboboxOptions = useMemo<ComboboxOption[]>(() => {
    return suppliers.map((supplier) => ({
      value: String(supplier.id),
      label: supplier.name,
    }));
  }, [suppliers]);

  const filteredManualMedicines = useMemo(() => {
    if (!manualSupplierId) return [];
    const query = manualMedicineSearch.trim().toLowerCase();
    return manualMedicines.filter((medicine) => {
      const name = medicine.name?.toLowerCase() ?? "";
      const sku = ((medicine as any).sku_code ?? (medicine as any).skuCode ?? "").toLowerCase();
      return !query || name.includes(query) || sku.includes(query);
    });
  }, [manualMedicineSearch, manualMedicines, manualSupplierId]);

  const shouldShowMedicineSuggestions =
    isMedicineSuggestionsOpen &&
    manualSupplierId &&
    manualMedicineSearch.trim().length > 0;

  // Debug logs to help trace why medicines may not appear in the UI
  useEffect(() => {
    try {
      // eslint-disable-next-line no-console
      console.debug("PO Dialog Debug:", {
        manualSupplierId,
        manualMedicineSearch,
        manualMedicinesCount: manualMedicines.length,
        filteredCount: filteredManualMedicines.length,
        manualItemsCount: manualItems.length,
      });
    } catch (e) {
      /* ignore */
    }
  }, [manualSupplierId, manualMedicineSearch, manualMedicines, filteredManualMedicines, manualItems]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const draftPoId = params.get("draftPoId");
    const draftMedicineId = params.get("draftMedicineId");
    const supplierId = params.get("supplierId");

    if (!draftPoId && draftMedicineId && supplierId && !draftCreationStarted.current) {
      draftCreationStarted.current = true;
      void evaluateRestocking
        .mutateAsync({
          medicineId: Number(draftMedicineId),
          supplierId: Number(supplierId),
        })
        .then((result) => {
          if (result.draft_po_id) {
            window.history.replaceState(
              {},
              "",
              `${window.location.pathname}?draftPoId=${result.draft_po_id}`,
            );
          }
        })
        .catch((err) => {
          draftCreationStarted.current = false;
          handleApiError("Create draft PO", err);
        });
      return;
    }

    if (!draftPoId || !orders.length) return;

    const draftOrder = mappedOrders.find((po) => po._rawId === Number(draftPoId));
    if (!draftOrder) return;

    setStatusFilter("Pending AI");
    setSelectedPO(null);
    setIsDialogOpen(false);
    setSelectedSummaryPO(draftOrder);
    setActivePoTab("draft-ai");
    window.history.replaceState({}, "", window.location.pathname);
  }, [mappedOrders, orders.length]);

  const approveMutation = useMutation({
    mutationFn: (poId: number) =>
      apiFetch(`/api/restocking/purchase-orders/${poId}/approve`, { method: "PATCH" }),

    onMutate: async (poId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.purchaseOrders });
      const snapshot = queryClient.getQueryData(queryKeys.purchaseOrders);
      queryClient.setQueryData(queryKeys.purchaseOrders, (old: PurchaseOrderResponse[]) =>
        (old ?? []).map((po) => (po.id === poId ? { ...po, status: "APPROVED" as const } : po)),
      );
      return { snapshot };
    },

    onError: (err, _poId, context) => {
      queryClient.setQueryData(queryKeys.purchaseOrders, context?.snapshot);
      handleApiError("Approve PO", err);
    },

    onSuccess: () => {
      toast.success("Purchase order approved successfully.");
      handleDialogOpenChange(false);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (poId: number) =>
      apiFetch(`/api/restocking/purchase-orders/${poId}/reject`, { method: "PATCH" }),

    onMutate: async (poId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.purchaseOrders });
      const snapshot = queryClient.getQueryData(queryKeys.purchaseOrders);
      queryClient.setQueryData(queryKeys.purchaseOrders, (old: PurchaseOrderResponse[]) =>
        (old ?? []).map((po) => (po.id === poId ? { ...po, status: "REJECTED" as const } : po)),
      );
      return { snapshot };
    },

    onError: (err, _poId, context) => {
      queryClient.setQueryData(queryKeys.purchaseOrders, context?.snapshot);
      handleApiError("Reject PO", err);
    },

    onSuccess: () => {
      toast.success("Purchase order rejected.");
      handleDialogOpenChange(false);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders });
    },
  });

  function openReview(po: PurchaseOrder) {
    setSelectedPO(po);
    setActivePoTab("Recomended PO");
    setIsDialogOpen(true);
    toast.success(`Opened ${po.poNumber} for review.`);
  }

  function openEdit(po: PurchaseOrder) {
    setSelectedPO(po);
    setEditItems(po.items);
    setIsDialogOpen(false);
    setIsEditDialogOpen(true);
  }

  function handleEditDialogOpenChange(open: boolean) {
    setIsEditDialogOpen(open);
    if (!open) {
      setSelectedPO(null);
      setEditItems([]);
    }
  }

  function handleSaveEditChanges() {
    if (!selectedPO) return;

    queryClient.setQueryData<PurchaseOrderResponse[] | undefined>(
      queryKeys.purchaseOrders,
      (old) =>
        old?.map((po) => {
          if (po.id !== selectedPO._rawId) return po;
          return {
            ...po,
            items: po.items.map((item) => {
              const editedItem = editItems.find((edited) => edited.medicineId === item.medicine_id);
              return editedItem
                ? { ...item, order_quantity: editedItem.qty }
                : item;
            }),
          };
        }),
    );

    setSelectedPO((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) => {
              const edited = editItems.find((edited) => edited.medicineId === item.medicineId);
              return edited ? { ...item, qty: edited.qty } : item;
            }),
          }
        : null,
    );

    toast.success(`Updated ${selectedPO.poNumber}`);
    handleEditDialogOpenChange(false);
  }

  function openDraftAiSummary(po: PurchaseOrder) {
    setSelectedPO(null);
    setIsDialogOpen(false);
    setSelectedSummaryPO(po);
    setActivePoTab("draft-ai");
  }

  function handleDialogOpenChange(open: boolean) {
    setIsDialogOpen(open);
    if (!open) {
      setSelectedPO(null);
    }
  }

  function handleApprove() {
    if (!selectedPO?._rawId) return;
    approveMutation.mutate(selectedPO._rawId);
  }

  function handleReject() {
    if (!selectedPO?._rawId) return;
    rejectMutation.mutate(selectedPO._rawId);
  }

  function handleCreateManualPo() {
    // Open manual PO dialog without pre-selecting supplier or medicines.
    setManualSupplierId("");
    setManualMedicineSearch("");
    setIsMedicineSuggestionsOpen(false);
    setManualItems([]);
    // Use the dialog open handler to pref fill a PO number
    handleManualDialogOpenChange(true);
  }

  function handleManualDialogOpenChange(open: boolean) {
    setIsManualDialogOpen(open);
    if (!open) {
      setManualSupplierId("");
      setManualMedicineSearch("");
      setIsMedicineSuggestionsOpen(false);
      setManualPoNumber("");
      setManualItems([]);
    } else {
      // Prefill a sensible PO number when opening the manual PO dialog
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
      setManualPoNumber(`PO-MANUAL-${datePart}-${rand}`);
    }
  }

  function handleManualSupplierChange(value: string) {
    setManualSupplierId(value);
    setManualMedicineSearch("");
    setIsMedicineSuggestionsOpen(false);
    setManualItems([]);
  }

  function addMedicineByValue(medicineValue: string) {
    if (!medicineValue) return;
    const exists = manualItems.some((it) => it.medicineId === medicineValue);
    if (exists) return;
    const medicine = medicines.find((m) => String(m.id) === medicineValue);
    if (medicine) {
      setSelectedMedicineForQty(medicine);
      setQuantityInput("1");
      setIsQuantityDialogOpen(true);
    }
  }

  function handleConfirmQuantity() {
    if (!selectedMedicineForQty || !quantityInput) return;
    const qty = parseInt(quantityInput, 10);
    if (Number.isNaN(qty) || qty < 1) {
      toast.error("Please enter a valid quantity.");
      return;
    }
    setManualItems((current) => [
      ...current,
      createManualPoLineItem({
        medicineId: String(selectedMedicineForQty.id),
        orderQuantity: qty.toString(),
      }),
    ]);
    setManualMedicineSearch("");
    setIsMedicineSuggestionsOpen(false);
    setIsQuantityDialogOpen(false);
    setSelectedMedicineForQty(null);
    setQuantityInput("1");
  }

  function handleManualItemChange(
    itemId: string,
    field: keyof Omit<ManualPoLineItem, "id">,
    value: string,
  ) {
    setManualItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
    );
  }

  function handleAddManualItem() {
    setManualItems((current) => [...current, createManualPoLineItem()]);
  }

  function handleRemoveManualItem(itemId: string) {
    setManualItems((current) => current.filter((item) => item.id !== itemId));
  }

  function handleSubmitManualPo() {
    const supplierId = Number(manualSupplierId);
    if (!supplierId) return;

    const items = manualItems
      .map((item) => ({
        medicine_id: Number(item.medicineId),
        order_quantity: Number(item.orderQuantity),
        unit_price_estimate: item.unitPriceEstimate.trim()
          ? Number(item.unitPriceEstimate)
          : undefined,
      }))
      .filter(
        (item) =>
          item.medicine_id && Number.isFinite(item.order_quantity) && item.order_quantity > 0,
      );

    if (items.length === 0) {
      toast.error("Please add at least one medicine before creating the PO.");
      return;
    }

    createManualPo.mutate(
      {
        supplier_id: supplierId,
        po_number: manualPoNumber.trim() || undefined,
        items,
      },
      {
        onSuccess: (po) => {
          toast.success(`Manual PO ${po.po_number} created.`);
          handleManualDialogOpenChange(false);
        },
        onError: (err) => handleApiError("Create manual PO", err),
      },
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Purchase Orders & Restocking
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor draft restocking orders, approvals, and supplier fulfilment from backend data.
          </p>
        </div>
        <div className="flex w-full flex-col gap-3 lg:w-auto lg:min-w-[min(100%,520px)]">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search PO Number or Supplier..."
              className="bg-surface border-border pl-9"
              aria-label="Search purchase orders"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilterValue)}
            >
              <SelectTrigger
                className="w-full bg-surface border-border sm:w-[200px]"
                aria-label="Filter by status"
              >
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Pending AI">Pending AI</SelectItem>
                <SelectItem value="Rejected">Rejected</SelectItem>
                <SelectItem value="Approved">Approved</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              className="shrink-0 shadow-sm sm:ml-auto"
              onClick={handleCreateManualPo}
            >
              <Plus className="h-4 w-4" />
              Create Manual PO
            </Button>
          </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Draft Pending AI"
          value={String(kpiDraftAi)}
          subtext="Awaiting pharmacist review"
          icon={Bot}
          tone="neutral"
        />
        <KpiCard
          label="Draft Pending approval"
          value={String(kpiPending)}
          subtext="Finance / clinical queue"
          icon={FileClock}
          tone="warning"
        />
        <KpiCard
          label="Draft Approved (open)"
          value={String(kpiApproved)}
          subtext="Released to suppliers"
          icon={ClipboardList}
          tone="neutral"
        />
        <KpiCard
          label="Completed (30d)"
          value={String(kpiCompleted)}
          subtext="Closed PO archive"
          icon={CheckCircle2}
          tone="success"
        />
      </section>

      <Card className="border-border bg-surface shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight">
                Purchase order register
              </CardTitle>
              <CardDescription>
                {filteredOrders.length} of {orders.length} POs
                {searchQuery.trim() || statusFilter !== "all" ? " after filters" : ""}.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShoppingCart className="h-4 w-4" />
              <span>Review opens the approval workspace.</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs
            value={activePoTab}
            onValueChange={(value) => setActivePoTab(value as "Recomended PO" | "draft-ai" | "history")}
            className="w-full"
          >
            <div className="border-b border-border px-4 py-3">
              <TabsList className="grid w-fit grid-cols-3 bg-muted/40">
                <TabsTrigger value="Recomended PO" className="gap-2">
                  Recomended PO
                </TabsTrigger>
                <TabsTrigger value="draft-ai" className="gap-2">
                  Pending AI
                  <span className="rounded-full bg-violet-500/12 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                    {kpiDraftAi}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="history" className="gap-2">
                  History
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="Recomended PO" className="m-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="pl-6 font-semibold text-foreground whitespace-nowrap">
                        PO Number
                      </TableHead>
                      <TableHead className="font-semibold text-foreground whitespace-nowrap">
                        Date
                      </TableHead>
                      <TableHead className="font-semibold text-foreground whitespace-nowrap">
                        Supplier
                      </TableHead>
                      <TableHead className="text-right font-semibold text-foreground whitespace-nowrap">
                        Total Items
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
                        <TableRow key={`skeleton-row-${i}`}>
                          {["pl-6", "", "", "text-right", "", "pr-6 text-right"].map((cls, j) => (
                            <TableCell key={`skeleton-cell-${i}-${j}`} className={cls}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : isError ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-12 text-center text-destructive text-sm"
                        >
                          Failed to load purchase orders. Check server connection.
                        </TableCell>
                      </TableRow>
                    ) : filteredOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                          No purchase orders match your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOrders.map((po) => (
                        <TableRow key={`${po.poNumber}-${po.date}`} className="border-border">
                          <TableCell className="pl-6 font-mono text-xs font-medium text-foreground">
                            {po.poNumber}
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {formatDisplayDate(po.date)}
                          </TableCell>
                          <TableCell
                            className="max-w-[220px] truncate font-medium text-foreground"
                            title={po.supplier}
                          >
                            {po.supplier}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {lineItemCount(po)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              status={po.status}
                              onClick={
                                po.status === "Pending AI" ? () => openDraftAiSummary(po) : undefined
                              }
                            />
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <div className="inline-flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-muted-foreground hover:text-foreground"
                                onClick={() => openReview(po)}
                              >
                                <Eye className="h-4 w-4" />
                                Review
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => openEdit(po)}
                              >
                                <Edit3 className="h-4 w-4" />
                                Edit
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="history" className="m-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="pl-6 font-semibold text-foreground whitespace-nowrap">
                        PO Number
                      </TableHead>
                      <TableHead className="font-semibold text-foreground whitespace-nowrap">
                        Date
                      </TableHead>
                      <TableHead className="font-semibold text-foreground whitespace-nowrap">
                        Supplier
                      </TableHead>
                      <TableHead className="text-right font-semibold text-foreground whitespace-nowrap">
                        Total Items
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
                        <TableRow key={`history-skeleton-row-${i}`}>
                          {['pl-6', '', '', 'text-right', '', 'pr-6 text-right'].map((cls, j) => (
                            <TableCell key={`history-skeleton-cell-${i}-${j}`} className={cls}>
                              <Skeleton className="h-4 w-full" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : isError ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-12 text-center text-destructive text-sm"
                        >
                          Failed to load purchase orders. Check server connection.
                        </TableCell>
                      </TableRow>
                    ) : filteredHistoryOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                          No historical purchase orders match your filters.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHistoryOrders.map((po) => (
                        <TableRow key={`${po.poNumber}-${po.date}`} className="border-border">
                          <TableCell className="pl-6 font-mono text-xs font-medium text-foreground">
                            {po.poNumber}
                          </TableCell>
                          <TableCell className="tabular-nums text-muted-foreground">
                            {formatDisplayDate(po.date)}
                          </TableCell>
                          <TableCell
                            className="max-w-[220px] truncate font-medium text-foreground"
                            title={po.supplier}
                          >
                            {po.supplier}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {lineItemCount(po)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={po.status} />
                          </TableCell>
                          <TableCell className="pr-6 text-right">
                            <div className="inline-flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-muted-foreground hover:text-foreground"
                                onClick={() => openReview(po)}
                              >
                                <Eye className="h-4 w-4" />
                                Review
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => openEdit(po)}
                              >
                                <Edit3 className="h-4 w-4" />
                                Edit
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="draft-ai" className="m-0 p-4 pt-4">
              <div className="space-y-4">
                <div className="rounded-lg border border-violet-200 bg-violet-50/70 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-violet-900">
                        <Bot className="h-4 w-4" />
                        Pending AI manager tab
                      </div>
                      <p className="mt-1 text-sm text-violet-900/80">
                        Review the draft data, AI rationale, and safety-stock signal before approving or rejecting.
                      </p>
                    </div>
                    {selectedSummaryPO ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSummaryPO(null)}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>

                  {selectedSummaryPO ? (
                    <div className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                      <div className="rounded-lg border border-violet-200 bg-white/80 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Selected draft</p>
                        <div className="mt-2 space-y-2 text-sm text-foreground">
                          <p className="font-mono text-xs text-muted-foreground">{selectedSummaryPO.poNumber}</p>
                          <p>
                            <span className="font-medium">Supplier:</span> {selectedSummaryPO.supplier}
                          </p>
                          <p>
                            <span className="font-medium">Date:</span> {formatDisplayDate(selectedSummaryPO.date)}
                          </p>
                          <p>
                            <span className="font-medium">Total items:</span> {lineItemCount(selectedSummaryPO)}
                          </p>
                          <div className="pt-1">
                            <StatusBadge status={selectedSummaryPO.status} />
                          </div>
                        </div>
                      </div>

                      {selectedDraftAiReason ? (
                        <div className="rounded-lg border border-violet-200 bg-white/80 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">Inspection reason</p>
                          <p className="mt-2 text-sm text-violet-950">{selectedDraftAiReason.summary}</p>
                          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-violet-900/80">
                            {selectedDraftAiReason.factors.map((factor, idx) => (
                              <li key={`draft-reason-${idx}`}>{factor}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-lg border border-dashed border-violet-200 bg-white/60 p-4 text-sm text-violet-900/80">
                      Click a Pending AI badge to inspect a specific draft.
                    </div>
                  )}
                </div>

                <div className="grid gap-3 xl:grid-cols-2">
                  {draftAiRows.length === 0 ? (
                    <div className="rounded-lg border border-border bg-background p-4 text-sm text-muted-foreground xl:col-span-2">
                      No Pending AI purchase orders are available right now.
                    </div>
                  ) : (
                    draftAiRows.map(({ po }) => (
                      <div
                        key={po.poNumber}
                        className="rounded-lg border border-border bg-background p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-mono text-xs text-muted-foreground">{po.poNumber}</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                              {po.supplier}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Date
                            </p>
                            <p className="mt-1 text-foreground">{formatDisplayDate(po.date)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">
                              Items
                            </p>
                            <p className="mt-1 text-foreground">{lineItemCount(po)}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <StatusBadge
                            status={po.status}
                            onClick={() => setSelectedSummaryPO(po)}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openReview(po)}
                          >
                            Open review
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={isManualDialogOpen} onOpenChange={handleManualDialogOpenChange}>
        <DialogContent className="border-border-strong bg-background sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Manual PO</DialogTitle>
            <DialogDescription>
              Select a supplier and add one or more medicines to create a draft purchase order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/*Supplier Selection */}
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Select Supplier *</label>
              <Combobox
                options={supplierComboboxOptions}
                value={manualSupplierId}
                onValueChange={handleManualSupplierChange}
                placeholder="Search Supplier"
                searchPlaceholder="Search supplier..."
                emptyMessage="No supplier found."
                showAllOnEmptySearch={true}
              />
            </div>

            {/*Medicine Search */}
            <div className="border-t border-border pt-4">
              {manualSupplierId ? (
                <div className="grid gap-2">
                  <div className="flex items-end justify-between gap-4">
                    <p className="text-sm font-medium text-foreground">Search Medicine</p>
                    <Button type="button" variant="outline" size="sm" onClick={() => setManualItems([])}>
                      Clear selected
                    </Button>
                  </div>

                  <div className="relative">
                    <Input
                      value={manualMedicineSearch}
                      onChange={(e) => {
                        setManualMedicineSearch(e.target.value);
                        setIsMedicineSuggestionsOpen(true);
                      }}
                      onFocus={() => setIsMedicineSuggestionsOpen(true)}
                      onBlur={() => {
                        if (!manualMedicineSearch.trim()) {
                          setIsMedicineSuggestionsOpen(false);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          if (filteredManualMedicines.length > 0) {
                            addMedicineByValue(String(filteredManualMedicines[0].id));
                          } else {
                            toast.info("No matching medicine to add.");
                          }
                        }
                      }}
                      placeholder={`Type medicine name or SKU available medicines from ${selectedSupplier?.name}.`}
                      className="bg-background border-border"
                    />

                    {shouldShowMedicineSuggestions && (
                      <div className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-y-auto rounded-md border border-border bg-background shadow-xl">
                        {filteredManualMedicines.length > 0 ? (
                          filteredManualMedicines.map((medicine) => {
                            const medId = String(medicine.id);
                            const alreadyAdded = manualItems.some((item) => item.medicineId === medId);
                            return (
                              <button
                                key={`med-${medId}`}
                                type="button"
                                className={
                                  "w-full rounded-md border-b border-border p-3 text-left" +
                                  (alreadyAdded
                                    ? " bg-muted/40 text-muted-foreground"
                                    : " bg-background hover:border-primary hover:bg-muted/50")
                                }
                                onClick={() => {
                                  if (alreadyAdded) return;
                                  const medicine = filteredManualMedicines.find((m) => String(m.id) === medId);
                                  if (medicine) {
                                    setSelectedMedicineForQty(medicine);
                                    setQuantityInput("1");
                                    setIsQuantityDialogOpen(true);
                                  }
                                }}
                                disabled={alreadyAdded}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-medium text-foreground">{medicine.name}</p>
                                    {((medicine as any).sku_code || (medicine as any).skuCode) && (
                                      <p className="text-xs text-muted-foreground">SKU: {(medicine as any).sku_code ?? (medicine as any).skuCode}</p>
                                    )}
                                  </div>
                                  {alreadyAdded ? (
                                    <span className="text-xs text-success">Added</span>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">Tap to add</span>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        ) : (
                          <div className="rounded-b-md border-t border-border p-4 text-sm text-muted-foreground">
                            No medicines match your search.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {`Available: ${manualMedicines.length}`}
                  </p>

                  <div className="mt-4 border-t border-border pt-4">
                    <div className="mb-3">
                      <p className="text-sm font-medium text-foreground">Selected Medicines ({manualItems.length})</p>
                    </div>

                    {manualItems.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                        Pick medicines from the list above to add them to the PO.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {manualItems.map((item) => {
                          const medicine = medicines.find((m) => String(m.id) === item.medicineId);
                          return (
                            <div key={item.id} className="flex items-center gap-3 p-3 rounded-md border border-border bg-muted/30">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{medicine?.name || `Medicine #${item.medicineId}`}</p>
                                {(medicine as any)?.sku_code && (
                                  <p className="text-xs text-muted-foreground">SKU: {(medicine as any).sku_code}</p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="flex items-center gap-1 bg-background rounded-md border border-border p-1">
                                  <label className="text-xs text-muted-foreground px-1">Qty:</label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={item.orderQuantity}
                                    onChange={(e) => handleManualItemChange(item.id, "orderQuantity", e.target.value)}
                                    className="w-14 h-7 border-0 bg-background text-sm text-center"
                                  />
                                </div>

                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveManualItem(item.id)}
                                  className="h-7 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  title="Remove from PO"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* PO Number Optional */}
                  <div className="grid gap-2 mt-4">
                    <label className="text-xs font-medium text-muted-foreground">PO Number (optional)</label>
                    <Input value={manualPoNumber} onChange={(e) => setManualPoNumber(e.target.value)} placeholder="e.g., PO-2026-001" className="bg-background border-border h-9 text-sm" />
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Please select a supplier first to search medicines.</div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleManualDialogOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmitManualPo}
              disabled={
                createManualPo.isPending ||
                !manualSupplierId ||
                manualItems.length === 0 ||
                manualItems.some((item) => !item.medicineId || Number(item.orderQuantity) < 1)
              }
              className="gap-2"
            >
              {createManualPo.isPending ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Creating…
                </>
              ) : (
                <>
                  <ShoppingCart className="h-4 w-4" />
                  Create PO
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isQuantityDialogOpen} onOpenChange={setIsQuantityDialogOpen}>
        <DialogContent className="border-border-strong bg-background sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Medicine Quantity</DialogTitle>
            <DialogDescription>
              Enter the quantity for {selectedMedicineForQty?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Medicine</label>
              <div className="p-3 rounded-md border border-border bg-muted/30">
                <p className="text-sm font-medium text-foreground">{selectedMedicineForQty?.name}</p>
                {((selectedMedicineForQty as any)?.sku_code || (selectedMedicineForQty as any)?.skuCode) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    SKU: {(selectedMedicineForQty as any).sku_code ?? (selectedMedicineForQty as any).skuCode}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Quantity *</label>
              <Input
                type="number"
                min="1"
                value={quantityInput}
                onChange={(e) => setQuantityInput(e.target.value)}
                placeholder="Enter quantity..."
                className="bg-background border-border"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsQuantityDialogOpen(false);
                setSelectedMedicineForQty(null);
                setQuantityInput('1');
              }}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleConfirmQuantity}>
              Add to PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={handleEditDialogOpenChange}>
        <DialogContent className="border-border-strong bg-background sm:max-w-lg">
          {selectedPO ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-base">Edit {selectedPO.poNumber}</DialogTitle>
                <DialogDescription>
                  Adjust quantities for the selected purchase order before saving.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-sm text-muted-foreground">
                  Supplier: <span className="font-semibold text-foreground">{selectedPO.supplier}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">Order date: {formatDisplayDate(selectedPO.date)}</span>
                  <span className="text-border">|</span>
                  <span className="inline-flex items-center gap-2">
                    Status <StatusBadge status={selectedPO.status} />
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Edit line items</h3>
                <div className="space-y-2">
                  {editItems.map((item, idx) => (
                    <div
                      key={`${selectedPO.poNumber}-edit-${idx}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                      </div>
                      <Input
                        type="number"
                        value={item.qty}
                        min={1}
                        className="w-24"
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          setEditItems((current) =>
                            current.map((line, lineIndex) =>
                              lineIndex === idx ? { ...line, qty: Number.isFinite(value) ? value : 0 } : line,
                            ),
                          );
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => handleEditDialogOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSaveEditChanges}>
                  Save changes
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground" aria-live="polite">
              Select a purchase order to edit.
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="border-border-strong bg-background sm:max-w-lg">
          {selectedPO ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-mono text-base">{selectedPO.poNumber}</DialogTitle>
                <DialogDescription>
                  Review line quantities before releasing to procurement.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-sm text-muted-foreground">
                  Supplier:{" "}
                  <span className="font-semibold text-foreground">{selectedPO.supplier}</span>
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    Order date: {formatDisplayDate(selectedPO.date)}
                  </span>
                  <span className="text-border">|</span>
                  <span className="inline-flex items-center gap-2">
                    Status <StatusBadge status={selectedPO.status} />
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Line items</h3>
                <div className="overflow-hidden rounded-lg border border-border">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Medicine
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                          Qty
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPO.items.map((item, idx) => (
                        <tr
                          key={`${selectedPO.poNumber}-${idx}`}
                          className="border-b border-border last:border-0 bg-background"
                        >
                          <td className="px-3 py-2.5 text-foreground">{item.name}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-medium text-foreground">
                            {item.qty.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleReject}
                  disabled={rejectMutation.isPending || selectedPO.status === "Completed"}
                >
                  {rejectMutation.isPending ? "Rejecting…" : "Reject PO"}
                </Button>
                <Button
                  type="button"
                  onClick={handleApprove}
                  disabled={
                    approveMutation.isPending ||
                    selectedPO.status === "Approved" ||
                    selectedPO.status === "Completed"
                  }
                >
                  {approveMutation.isPending ? "Approving…" : "Approve PO"}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="py-6 text-center text-sm text-muted-foreground" aria-live="polite">
              Select a purchase order to view details.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
