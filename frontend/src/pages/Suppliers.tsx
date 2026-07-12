import { useMemo, useState } from "react";
import { Building2, Eye, Mail, MapPin, Phone, Plus, Search, User } from "lucide-react";
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
import { Label } from "@/components/ui/label";
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
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  useSuppliers as useApiSuppliers,
  useCreateMedicine,
  useMedicines,
  useUpdateSupplier,
} from "@/hooks/use-api";

export type SupplierCategory = "Distributor" | "Manufacturer";

export type SupplierStatus = "Active" | "On Review" | "Inactive";

/** Canonical supplier record for the directory (static mock until API integration). */
export interface Supplier {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  category: SupplierCategory;
  status: SupplierStatus;
  address: string;
}

const CATEGORY_OPTIONS: SupplierCategory[] = ["Distributor", "Manufacturer"];

const INITIAL_SUPPLIERS: Supplier[] = [
  {
    id: "sup-kf-001",
    companyName: "PT Kimia Farma (Persero) Tbk",
    contactPerson: "Budi Santoso",
    phone: "+62 21 4287 3088",
    email: "b2b.orders@kimiafarma.co.id",
    category: "Manufacturer",
    status: "Active",
    address: "Jl. Veteran I No. 9, Gambir, Jakarta Pusat 10110",
  },
  {
    id: "sup-sf-002",
    companyName: "PT Sanbe Farma",
    contactPerson: "Dr. Rina Wijaya",
    phone: "+62 22 203 0123",
    email: "hospital.channel@sanbe.co.id",
    category: "Distributor",
    status: "Active",
    address: "Jl. Soekarno-Hatta No. 476, Bandung 40286",
  },
  {
    id: "sup-kb-003",
    companyName: "PT Kalbe Farma Tbk",
    contactPerson: "Andre Kusuma",
    phone: "+62 21 460 0181",
    email: "institutional.sales@kalbe.co.id",
    category: "Manufacturer",
    status: "On Review",
    address: "Jl. Let. Jend. Suprapto Kav. 4, Jakarta 10510",
  },
  {
    id: "sup-dx-004",
    companyName: "PT Dexa Medica",
    contactPerson: "Melati Anggraini",
    phone: "+62 21 8778 0101",
    email: "pharma.logistics@dexa-medica.com",
    category: "Distributor",
    status: "Active",
    address: "Jl. Dr. Saharjo No. 45, Tebet, Jakarta Selatan 12850",
  },
  {
    id: "sup-ph-005",
    companyName: "PT Pharos Indonesia",
    contactPerson: "Hendra Gunawan",
    phone: "+62 21 2929 2800",
    email: "procurement@pharos.co.id",
    category: "Manufacturer",
    status: "Inactive",
    address: "Jl. Letjen S. Parman Kav. 87, Slipi, Jakarta Barat 11420",
  },
];

type AddSupplierForm = {
  companyName: string;
  contactPerson: string;
  phone: string;
  email: string;
  category: SupplierCategory | "";
  address: string;
};

const emptyAddForm: AddSupplierForm = {
  companyName: "",
  contactPerson: "",
  phone: "",
  email: "",
  category: "",
  address: "",
};

function StatusBadge({ status }: { status: SupplierStatus }) {
  const styles: Record<SupplierStatus, string> = {
    Active:
      "border border-success/35 bg-success-soft text-success shadow-none hover:bg-success-soft dark:text-success",
    "On Review":
      "border border-warning/35 bg-warning-soft text-warning shadow-none hover:bg-warning-soft dark:text-warning",
    Inactive:
      "border border-border-strong bg-muted text-muted-foreground shadow-none hover:bg-muted dark:text-muted-foreground",
  };

  return (
    <Badge className={`rounded-md font-medium ${styles[status]}`} variant="outline">
      {status}
    </Badge>
  );
}

export function SuppliersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const { data: apiSuppliers = [] } = useApiSuppliers();
  const { data: medicines = [] } = useMedicines();
  const createMedicine = useCreateMedicine();
  const updateSupplier = useUpdateSupplier();

  const [isCreateMedOpen, setIsCreateMedOpen] = useState(false);
  const [medSku, setMedSku] = useState("");
  const [medName, setMedName] = useState("");
  const [medCategory, setMedCategory] = useState("");
  const [medUnit, setMedUnit] = useState("");
  const [medCurrentStock, setMedCurrentStock] = useState("0");
  const [medSafetyStock, setMedSafetyStock] = useState("0");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [addForm, setAddForm] = useState<AddSupplierForm>(emptyAddForm);

  const displayedSuppliers = useMemo(() => {
    const merged = [...suppliers];
    const findMatchIndex = (name: string) =>
      merged.findIndex((supplier) => {
        const a = supplier.companyName.toLowerCase();
        const b = name.toLowerCase();
        return a === b || a.includes(b) || b.includes(a);
      });

    for (const apiSupplier of apiSuppliers) {
      const mapped = {
        id: String(apiSupplier.id),
        companyName: apiSupplier.name || "",
        contactPerson: apiSupplier.contact_person || "",
        phone: apiSupplier.phone || "",
        email: apiSupplier.email || "",
        category: "Distributor" as SupplierCategory,
        status:
          apiSupplier.status === "Inactive"
            ? ("Inactive" as SupplierStatus)
            : ("Active" as SupplierStatus),
        address: "",
      };

      const matchIndex = findMatchIndex(mapped.companyName);
      if (matchIndex >= 0) {
        merged[matchIndex] = {
          ...merged[matchIndex],
          ...mapped,
          email: mapped.email || merged[matchIndex].email,
          contactPerson: mapped.contactPerson || merged[matchIndex].contactPerson,
          phone: mapped.phone || merged[matchIndex].phone,
          status: merged[matchIndex].status,
        };
      } else {
        merged.push(mapped);
      }
    }

    return merged;
  }, [apiSuppliers, suppliers]);

  const filteredSuppliers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return displayedSuppliers;
    return displayedSuppliers.filter(
      (s) => s.companyName.toLowerCase().includes(q) || s.contactPerson.toLowerCase().includes(q),
    );
  }, [displayedSuppliers, searchQuery]);

  const medicinesBySupplier = useMemo(() => {
    const map = new Map<number, typeof medicines>();
    for (const m of medicines) {
      const arr = map.get(m.supplier_id) || [];
      arr.push(m);
      map.set(m.supplier_id, arr);
    }
    return map;
  }, [medicines]);

  function openAddDialog() {
    setAddForm(emptyAddForm);
    setAddDialogOpen(true);
  }

  function handleAddDialogChange(open: boolean) {
    setAddDialogOpen(open);
    if (!open) {
      setAddForm(emptyAddForm);
    }
  }

  function openDetails(supplier: Supplier) {
    setSelectedSupplier(supplier);
    setDetailsOpen(true);
    toast.success(`Viewing ${supplier.companyName}.`);
  }

  function openCreateMedForSelected() {
    if (!selectedSupplier) return;
    setMedSku("");
    setMedName("");
    setMedCategory("");
    setMedUnit("");
    setMedCurrentStock("0");
    setMedSafetyStock("0");
    setIsCreateMedOpen(true);
  }

  async function handleCreateMedSubmit() {
    if (!selectedSupplier) return;
    // Try to find a matching backend supplier by company name
    const matched = apiSuppliers.find((s) =>
      String(s.name).toLowerCase().includes(selectedSupplier.companyName.toLowerCase()),
    );
    if (!matched) {
      toast.error("No matching backend supplier found. Sync suppliers first.");
      return;
    }

    const payload = {
      sku_code: medSku.trim() || `MED-${Date.now()}`,
      name: medName.trim() || "New Medicine",
      category: medCategory.trim() || "General",
      unit_measurement: medUnit.trim() || "unit",
      current_stock: Number(medCurrentStock) || 0,
      safety_stock_level: Number(medSafetyStock) || 0,
      supplier_id: matched.id,
    };

    try {
      const med = await createMedicine.mutateAsync(payload);
      toast.success(`Created medicine ${med.name} for ${selectedSupplier.companyName}`);
      setIsCreateMedOpen(false);
    } catch (err) {
      toast.error("Failed to create medicine.");
    }
  }

  function handleDetailsDialogChange(open: boolean) {
    setDetailsOpen(open);
    if (!open) {
      setSelectedSupplier(null);
    }
  }

  async function handleSupplierStatusChange(status: Extract<SupplierStatus, "Active" | "Inactive">) {
    if (!selectedSupplier) return;

    const namesMatch = (a: string, b: string) => {
      const left = a.toLowerCase();
      const right = b.toLowerCase();
      return left === right || left.includes(right) || right.includes(left);
    };

    setSelectedSupplier({ ...selectedSupplier, status });
    setSuppliers((prev) =>
      prev.map((supplier) =>
        namesMatch(supplier.companyName, selectedSupplier.companyName)
          ? { ...supplier, status }
          : supplier,
      ),
    );

    const supplierId = Number(selectedSupplier.id);
    if (Number.isFinite(supplierId)) {
      try {
        await updateSupplier.mutateAsync({ id: supplierId, payload: { status } });
      } catch (err) {
        toast.error("Failed to update supplier status.");
        return;
      }
    }

    toast.success(`${selectedSupplier.companyName} marked ${status.toLowerCase()}.`);
  }

  function handleSaveSupplier() {
    if (
      !addForm.companyName.trim() ||
      !addForm.contactPerson.trim() ||
      !addForm.phone.trim() ||
      !addForm.email.trim() ||
      !addForm.category ||
      !addForm.address.trim()
    ) {
      toast.error("Please complete all supplier fields before saving.");
      return;
    }

    const newSupplier: Supplier = {
      id: `sup-new-${Date.now()}`,
      companyName: addForm.companyName.trim(),
      contactPerson: addForm.contactPerson.trim(),
      phone: addForm.phone.trim(),
      email: addForm.email.trim(),
      category: addForm.category,
      status: "Active",
      address: addForm.address.trim(),
    };

    setSuppliers((prev) => [newSupplier, ...prev]);
    toast.success(`${newSupplier.companyName} added successfully.`);
    handleAddDialogChange(false);
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center lg:w-auto lg:min-w-[min(100%,420px)]">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by company name or contact..."
              className="bg-surface border-border pl-9"
              aria-label="Search suppliers"
            />
          </div>
          <Button type="button" className="shrink-0 shadow-sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4" />
            Add Supplier
          </Button>
        </div>
      </div>

      <Card className="border-border bg-surface shadow-sm overflow-hidden">
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg font-bold tracking-tight">Registered vendors</CardTitle>
          <CardDescription>
            {filteredSuppliers.length} of {displayedSuppliers.length} suppliers
            {searchQuery.trim() ? ` matching “${searchQuery.trim()}”` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="pl-6 font-semibold text-foreground whitespace-nowrap">
                    Company Name
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Contact Person
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Phone
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Email
                  </TableHead>
                  <TableHead className="font-semibold text-foreground whitespace-nowrap">
                    Category
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
                {filteredSuppliers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      No suppliers match your search.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSuppliers.map((row) => (
                    <TableRow key={row.id} className="border-border">
                      <TableCell className="pl-6">
                        <div className="flex items-center gap-2">
                          <Building2
                            className="h-4 w-4 shrink-0 text-muted-foreground"
                            aria-hidden
                          />
                          <span
                            className="max-w-[220px] truncate font-medium text-foreground"
                            title={row.companyName}
                          >
                            {row.companyName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.contactPerson}</TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                        {row.phone}
                      </TableCell>
                      <TableCell
                        className="max-w-[200px] truncate text-muted-foreground"
                        title={row.email}
                      >
                        {row.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.category}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="pr-6 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-muted-foreground hover:text-foreground"
                          onClick={() => openDetails(row)}
                        >
                          <Eye className="h-4 w-4" />
                          Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={addDialogOpen} onOpenChange={handleAddDialogChange}>
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto border-border-strong bg-background sm:max-w-lg">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveSupplier();
            }}
          >
            <DialogHeader>
              <DialogTitle>Add supplier</DialogTitle>
              <DialogDescription>
                Capture vendor master data. Entries stay in this browser session until the API is
                connected.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-1 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-4">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="sup-company">Company name</Label>
                <Input
                  id="sup-company"
                  value={addForm.companyName}
                  onChange={(e) => setAddForm((f) => ({ ...f, companyName: e.target.value }))}
                  placeholder="PT …"
                  className="bg-surface border-border"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sup-contact">Contact person</Label>
                <Input
                  id="sup-contact"
                  value={addForm.contactPerson}
                  onChange={(e) => setAddForm((f) => ({ ...f, contactPerson: e.target.value }))}
                  placeholder="Full name"
                  className="bg-surface border-border"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="sup-phone">Phone number</Label>
                <Input
                  id="sup-phone"
                  value={addForm.phone}
                  onChange={(e) => setAddForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+62 …"
                  className="bg-surface border-border font-mono text-sm"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="sup-email">Email</Label>
                <Input
                  id="sup-email"
                  type="email"
                  value={addForm.email}
                  onChange={(e) => setAddForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="procurement@example.co.id"
                  className="bg-surface border-border"
                />
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label>Category</Label>
                <Select
                  value={addForm.category || undefined}
                  onValueChange={(value) =>
                    setAddForm((f) => ({ ...f, category: value as SupplierCategory }))
                  }
                >
                  <SelectTrigger className="bg-surface border-border">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="z-[60]">
                    {CATEGORY_OPTIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="sup-address">Office address</Label>
                <Textarea
                  id="sup-address"
                  value={addForm.address}
                  onChange={(e) => setAddForm((f) => ({ ...f, address: e.target.value }))}
                  placeholder="Street, district, city, postal code"
                  rows={4}
                  className="min-h-[100px] resize-y bg-surface border-border"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleAddDialogChange(false)}
                className="hover:bg-muted"
              >
                Cancel
              </Button>
              <Button type="submit">Save Supplier</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsOpen} onOpenChange={handleDetailsDialogChange}>
        <DialogContent className="max-h-[min(92vh,760px)] overflow-y-auto border-border-strong bg-background sm:max-w-md">
          {selectedSupplier ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-start gap-2 pr-6 text-left">
                  <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
                  <span>{selectedSupplier.companyName}</span>
                </DialogTitle>
                <DialogDescription>Vendor profile snapshot</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                  <User className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Contact
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {selectedSupplier.contactPerson}
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
                    <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Phone
                      </p>
                      <p className="break-words font-mono text-xs text-foreground">
                        {selectedSupplier.phone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-lg border border-border bg-background px-3 py-2.5">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Email
                      </p>
                      <p className="break-all text-xs text-foreground">{selectedSupplier.email}</p>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Category</span>
                  <Badge variant="secondary" className="font-medium">
                    {selectedSupplier.category}
                  </Badge>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">Status</span>
                  <Select
                    value={selectedSupplier.status === "Inactive" ? "Inactive" : "Active"}
                    disabled={updateSupplier.isPending}
                    onValueChange={(value) =>
                      handleSupplierStatusChange(
                        value as Extract<SupplierStatus, "Active" | "Inactive">,
                      )
                    }
                  >
                    <SelectTrigger className="h-8 w-[116px] border-border bg-background text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[70]">
                      <SelectItem value="Active">Active</SelectItem>
                      <SelectItem value="Inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button type="button" size="sm" onClick={openCreateMedForSelected}>
                    + Add medicine for this supplier
                  </Button>
                </div>
                <div className="mt-4">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">Medicines</h3>
                  {(() => {
                    // try to find backend supplier id
                    const matched = apiSuppliers.find((s) =>
                      String(s.name)
                        .toLowerCase()
                        .includes(selectedSupplier.companyName.toLowerCase()),
                    );
                    if (!matched) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          No linked backend supplier found.
                        </p>
                      );
                    }

                    const meds = medicinesBySupplier.get(matched.id) || [];
                    if (meds.length === 0) {
                      return (
                        <p className="text-sm text-muted-foreground">
                          No medicines registered for this supplier.
                        </p>
                      );
                    }

                    return (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>SKU</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Unit</TableHead>
                              <TableHead className="text-right">Stock</TableHead>
                              <TableHead className="text-right">Safety</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {meds.map((m) => (
                              <TableRow key={m.id}>
                                <TableCell className="font-mono text-xs">{m.sku_code}</TableCell>
                                <TableCell>{m.name}</TableCell>
                                <TableCell>{m.unit_measurement}</TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {m.current_stock}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {m.safety_stock_level}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    );
                  })()}
                </div>
                <div className="flex gap-2 rounded-lg border border-border bg-background p-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Office address
                    </p>
                    <p className="text-sm leading-relaxed text-foreground">
                      {selectedSupplier.address}
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleDetailsDialogChange(false)}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : (
            <p className="py-6 text-center text-sm text-muted-foreground" aria-live="polite">
              No supplier selected.
            </p>
          )}
        </DialogContent>
      </Dialog>
      <Dialog open={isCreateMedOpen} onOpenChange={setIsCreateMedOpen}>
        <DialogContent className="max-h-[min(90vh,720px)] overflow-y-auto border-border-strong bg-background sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create medicine</DialogTitle>
            <DialogDescription>Add a medicine record linked to this supplier.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label>SKU</Label>
              <Input
                value={medSku}
                onChange={(e) => setMedSku(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Category</Label>
                <Input
                  value={medCategory}
                  onChange={(e) => setMedCategory(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
              <div className="grid gap-2">
                <Label>Unit</Label>
                <Input
                  value={medUnit}
                  onChange={(e) => setMedUnit(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Current stock</Label>
                <Input
                  type="number"
                  value={medCurrentStock}
                  onChange={(e) => setMedCurrentStock(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
              <div className="grid gap-2">
                <Label>Safety stock</Label>
                <Input
                  type="number"
                  value={medSafetyStock}
                  onChange={(e) => setMedSafetyStock(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setIsCreateMedOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateMedSubmit}
              disabled={createMedicine.isPending}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
