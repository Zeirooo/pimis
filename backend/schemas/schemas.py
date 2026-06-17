from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from backend.database.models import POStatus, TransactionType, UserRole


class UserBase(BaseModel):
    username: str
    hashed_password: str
    role: UserRole
    is_active: bool = True


class UserCreate(UserBase):
    pass


class UserResponse(UserBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class SupplierBase(BaseModel):
    name: str
    contact_person: str | None = None
    email: str | None = None
    phone: str | None = None


class SupplierCreate(SupplierBase):
    pass


class SupplierResponse(SupplierBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class MedicineBase(BaseModel):
    sku_code: str
    name: str
    category: str
    unit_measurement: str
    current_stock: int
    safety_stock_level: int
    supplier_id: int


class MedicineCreate(MedicineBase):
    pass


class MedicineUpdate(BaseModel):
    sku_code: str | None = None
    name: str | None = None
    category: str | None = None
    unit_measurement: str | None = None
    current_stock: int | None = Field(default=None, ge=0)
    safety_stock_level: int | None = Field(default=None, ge=0)
    supplier_id: int | None = None


class MedicineResponse(MedicineBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class InventoryTransactionBase(BaseModel):
    medicine_id: int
    transaction_type: TransactionType
    quantity: int
    reference_note: str | None = None
    created_by: int


class InventoryTransactionCreate(InventoryTransactionBase):
    pass


class InventoryTransactionResponse(InventoryTransactionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: datetime


class PurchaseOrderBase(BaseModel):
    po_number: str
    supplier_id: int
    status: POStatus
    reviewed_by: int | None = None


class PurchaseOrderCreate(PurchaseOrderBase):
    pass


class PurchaseOrderResponse(PurchaseOrderBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime


class PurchaseOrderItemBase(BaseModel):
    po_id: int
    medicine_id: int
    order_quantity: int
    unit_price_estimate: float | None = None


class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    pass


class PurchaseOrderItemResponse(PurchaseOrderItemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class DemandPredictionBase(BaseModel):
    medicine_id: int
    target_date: date
    predicted_demand: int
    confidence_score: float


class DemandPredictionCreate(DemandPredictionBase):
    pass


class DemandPredictionResponse(DemandPredictionBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    calculated_at: datetime

