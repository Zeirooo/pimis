from __future__ import annotations

from typing import Sequence

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.crud.crud_transactions import create_inventory_transaction, get_transaction_history
from backend.database.database import get_db
from backend.schemas.transactions import TransactionCreate, TransactionResponse


router = APIRouter(prefix="/api/transactions", tags=["Transactions"])


@router.post("/", response_model=TransactionResponse, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    tx_in: TransactionCreate,
    db: AsyncSession = Depends(get_db),
) -> TransactionResponse:
    """
    Record a new inventory transaction and update medicine stock.
    """

    return await create_inventory_transaction(db, tx_in)


@router.get("/", response_model=list[TransactionResponse])
async def list_transactions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> Sequence[TransactionResponse]:
    """
    Fetch transaction history (most recent first) with pagination.
    """

    return await get_transaction_history(db, skip=skip, limit=limit)

