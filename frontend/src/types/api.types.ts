export type TransactionType = "INCOMING" | "OUTGOING";
export type POStatus = "DRAFT_AI" | "APPROVED" | "REJECTED" | "SENT_TO_VENDOR" | "COMPLETED";
export type PredictionDataSource = "ml" | "fallback" | "demo";

export interface Supplier {
  id: number;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  status: "Active" | "Inactive";
}

export interface SupplierUpdate {
  status?: "Active" | "Inactive";
}

export interface Medicine {
  id: number;
  sku_code: string;
  name: string;
  category: string;
  unit_measurement: string;
  current_stock: number;
  safety_stock_level: number;
  supplier_id: number;
}

export interface MedicineCreate {
  sku_code: string;
  name: string;
  category: string;
  unit_measurement: string;
  current_stock: number;
  safety_stock_level: number;
  supplier_id: number;
}

export type MedicineUpdate = Partial<MedicineCreate>;

export interface TransactionCreate {
  medicine_id: number;
  transaction_type: TransactionType;
  quantity: number;
  reference_note?: string | null;
  created_by: number;
}

export interface TransactionResponse extends TransactionCreate {
  id: number;
  timestamp: string;
  current_stock: number;
}

export interface PredictionResponse {
  id: number;
  medicine_id: number;
  target_date: string;
  predicted_demand: number;
  confidence_score: number;
  calculated_at: string;
}

export interface ReportCategoryPoint {
  name: string;
  fast_moving: number;
  slow_moving: number;
}

export interface ReportSeriesPoint {
  name: string;
  actual_consumption: number;
  predicted_demand: number;
  source: PredictionDataSource;
}

export interface ReportSummaryResponse {
  data_source: PredictionDataSource;
  target_medicine_id: number | null;
  target_medicine_name: string | null;
  forecast_accuracy: number;
  inventory_value: number;
  risk_value: number;
  turnover_ratio: number;
  overview: ReportCategoryPoint[];
  ml_series: ReportSeriesPoint[];
  updated_at: string;
}

export interface TrainAllModelsResponse {
  status: string;
  medicine_count: number;
}

export interface TrainMedicineResponse {
  medicine_id: number;
  status: string;
  message: string;
}

export interface ModelStatusEntry {
  medicine_id: number;
  is_loaded: boolean;
  medicine_name: string;
}

export interface ModelStatusResponse {
  models: ModelStatusEntry[];
}

export interface POItem {
  id: number;
  po_id: number;
  medicine_id: number;
  order_quantity: number;
  unit_price_estimate: number | null;
}

export interface PurchaseOrderResponse {
  id: number;
  po_number: string;
  supplier_id: number;
  status: POStatus;
  created_at: string;
  reviewed_by: number | null;
  items: POItem[];
}

export interface ManualPurchaseOrderItemCreate {
  medicine_id: number;
  order_quantity: number;
  unit_price_estimate?: number | null;
}

export interface RestockingEvalResponse {
  medicine_id: number;
  medicine_name: string;
  current_stock: number;
  predicted_demand: number;
  status: "Enough Stock" | "Low Stock";
  recommended_po_qty: number;
  draft_po_id: number | null;
  draft_ai_summary: string | null;
  draft_ai_factors: string[];
}

export interface ManualPurchaseOrderCreate {
  supplier_id?: number | null;
  po_number?: string | null;
  reviewed_by?: number | null;
  items: ManualPurchaseOrderItemCreate[];
}
