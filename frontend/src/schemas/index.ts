import { z } from "zod";

export const supplierSchema = z.object({
  companyName: z.string().min(3, "Min 3 characters"),
  contactPerson: z.string().min(2, "Required"),
  phone: z.string().regex(/^\+\d{7,15}$/, "Format: +62XXXXXXXXXX"),
  email: z.string().email("Invalid email"),
  category: z.enum(["Distributor", "Manufacturer"]),
  address: z.string().min(10, "Enter a complete address"),
});

export const medicineSchema = z.object({
  name: z.string().min(2, "Required"),
  sku: z.string().min(3, "Required"),
  category: z.string().min(1, "Select a category"),
  unit: z.string().min(1, "Select a unit"),
  currentStock: z.coerce.number().int().min(0, "Must be ≥ 0"),
  safetyStock: z.coerce.number().int().min(0, "Must be ≥ 0"),
});

export const transactionSchema = z.object({
  medicine_id: z.number({ required_error: "Select a medicine" }),
  transaction_type: z.enum(["INCOMING", "OUTGOING"]),
  quantity: z.coerce.number().int().min(1, "Must be ≥ 1"),
  reference_note: z.string().optional(),
  created_by: z.number().default(1), // hardcoded until auth
});

export type SupplierFormData = z.infer<typeof supplierSchema>;
export type MedicineFormData = z.infer<typeof medicineSchema>;
export type TransactionFormData = z.infer<typeof transactionSchema>;
