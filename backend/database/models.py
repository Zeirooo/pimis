from __future__ import annotations

import enum
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Boolean, Date, DateTime, Enum as SAEnum, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database.database import Base


class UserRole(str, enum.Enum):
    STAFF_PHARMACY = "STAFF_PHARMACY"
    PHARMACY_MANAGER = "PHARMACY_MANAGER"
    MANAJER_INSTALASI = "PHARMACY_MANAGER"
    SYSTEM_ADMIN = "SYSTEM_ADMIN"


class TransactionType(str, enum.Enum):
    INCOMING = "INCOMING"
    OUTGOING = "OUTGOING"


class POStatus(str, enum.Enum):
    DRAFT_AI = "DRAFT_AI"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    SENT_TO_VENDOR = "SENT_TO_VENDOR"
    COMPLETED = "COMPLETED"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(length=150), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(length=255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="user_role"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    inventory_transactions: Mapped[list["InventoryTransaction"]] = relationship(
        back_populates="created_by_user",
    )
    reviewed_purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(
        back_populates="reviewed_by_user",
    )


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(length=255), nullable=False)
    contact_person: Mapped[str | None] = mapped_column(String(length=255), nullable=True)
    email: Mapped[str | None] = mapped_column(String(length=255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(length=50), nullable=True)
    status: Mapped[str] = mapped_column(String(length=50), default="Active", nullable=False)

    medicines: Mapped[list["Medicine"]] = relationship(back_populates="supplier")
    purchase_orders: Mapped[list["PurchaseOrder"]] = relationship(back_populates="supplier")


class Medicine(Base):
    __tablename__ = "medicines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sku_code: Mapped[str] = mapped_column(String(length=100), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(length=255), nullable=False)
    category: Mapped[str] = mapped_column(String(length=150), nullable=False)
    unit_measurement: Mapped[str] = mapped_column(String(length=50), nullable=False)
    current_stock: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    safety_stock_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)

    supplier: Mapped["Supplier"] = relationship(back_populates="medicines")
    transactions: Mapped[list["InventoryTransaction"]] = relationship(back_populates="medicine")
    purchase_order_items: Mapped[list["PurchaseOrderItem"]] = relationship(back_populates="medicine")
    demand_predictions: Mapped[list["DemandPrediction"]] = relationship(back_populates="medicine")


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    medicine_id: Mapped[int] = mapped_column(ForeignKey("medicines.id"), nullable=False)
    transaction_type: Mapped[TransactionType] = mapped_column(
        SAEnum(TransactionType, name="transaction_type"),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    reference_note: Mapped[str | None] = mapped_column(String(length=500), nullable=True)

    timestamp: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        nullable=False,
    )
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

    medicine: Mapped["Medicine"] = relationship(back_populates="transactions")
    created_by_user: Mapped["User"] = relationship(back_populates="inventory_transactions")


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    po_number: Mapped[str] = mapped_column(String(length=100), unique=True, index=True, nullable=False)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("suppliers.id"), nullable=False)
    status: Mapped[POStatus] = mapped_column(SAEnum(POStatus, name="po_status"), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        nullable=False,
    )

    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    supplier: Mapped["Supplier"] = relationship(back_populates="purchase_orders")
    items: Mapped[list["PurchaseOrderItem"]] = relationship(back_populates="purchase_order")

    reviewed_by_user: Mapped[Optional["User"]] = relationship(back_populates="reviewed_purchase_orders")


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    po_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id"), nullable=False)
    medicine_id: Mapped[int] = mapped_column(ForeignKey("medicines.id"), nullable=False)
    order_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price_estimate: Mapped[float | None] = mapped_column(Float, nullable=True)

    purchase_order: Mapped["PurchaseOrder"] = relationship(back_populates="items")
    medicine: Mapped["Medicine"] = relationship(back_populates="purchase_order_items")


class DemandPrediction(Base):
    __tablename__ = "demand_predictions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    medicine_id: Mapped[int] = mapped_column(ForeignKey("medicines.id"), nullable=False)
    target_date: Mapped[date] = mapped_column(Date, nullable=False)
    predicted_demand: Mapped[int] = mapped_column(Integer, nullable=False)
    confidence_score: Mapped[float] = mapped_column(Float, nullable=False)

    calculated_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=func.now(),
        nullable=False,
    )

    medicine: Mapped["Medicine"] = relationship(back_populates="demand_predictions")

