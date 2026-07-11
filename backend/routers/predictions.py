"""HTTP routes for demand prediction generation, history, and ML model management."""

from __future__ import annotations

import logging
from typing import Sequence, TypedDict

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.crud.crud_predictions import generate_demand_prediction, get_prediction_history
from backend.database.database import SessionLocal, get_db
from backend.database.models import Medicine
from backend.ml.registry import ModelRegistry, get_model_registry
from backend.ml.trainer import MODELS_DIR, train_all_models_for_medicine, train_batch
from backend.schemas.predictions import PredictionCreate, PredictionResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/predictions", tags=["ML Predictions"])


class TrainResponse(TypedDict):
    medicine_id: int
    status: str
    message: str


class TrainAllResponse(TypedDict):
    status: str
    medicine_count: int


class ModelStatusEntry(TypedDict):
    medicine_id: int
    is_loaded: bool
    medicine_name: str


class ModelStatusResponse(TypedDict):
    models: list[ModelStatusEntry]


@router.post("/", response_model=PredictionResponse, status_code=status.HTTP_201_CREATED)
async def create_prediction(
    req: PredictionCreate,
    db: AsyncSession = Depends(get_db),
    registry: ModelRegistry = Depends(get_model_registry),
) -> PredictionResponse:
    """Trigger the demand prediction engine for a medicine."""

    return await generate_demand_prediction(db, req, registry)


@router.get("/{medicine_id}", response_model=list[PredictionResponse])
async def list_predictions(
    medicine_id: int,
    db: AsyncSession = Depends(get_db),
) -> Sequence[PredictionResponse]:
    """Fetch prediction history for a specific medicine."""

    return await get_prediction_history(db, medicine_id)


async def _train_all_medicines(registry: ModelRegistry) -> None:
    """Background task: train every medicine that has enough transaction history."""

    async with SessionLocal() as db:
        result = await db.execute(select(Medicine.id))
        medicine_ids = result.scalars().all()

    await train_batch(SessionLocal, medicine_ids, registry, MODELS_DIR)


# Registered before /train/{medicine_id} -- FastAPI matches path routes in
# registration order, and a static "/train/all" would otherwise be swallowed
# by the dynamic "/train/{medicine_id}" (with medicine_id="all", a 422).
@router.post("/train/all")
async def train_all_medicines(
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    registry: ModelRegistry = Depends(get_model_registry),
) -> TrainAllResponse:
    """Kick off background training for every medicine in the catalogue."""

    result = await db.execute(select(Medicine.id))
    medicine_count = len(result.scalars().all())

    background_tasks.add_task(_train_all_medicines, registry)

    return TrainAllResponse(status="training_started", medicine_count=medicine_count)


@router.get("/models/status")
async def model_status(
    db: AsyncSession = Depends(get_db),
    registry: ModelRegistry = Depends(get_model_registry),
) -> ModelStatusResponse:
    """Report which medicines currently have a trained model loaded in memory."""

    result = await db.execute(select(Medicine.id, Medicine.name))
    medicines = result.all()

    entries = [
        ModelStatusEntry(
            medicine_id=medicine_id,
            is_loaded=registry.is_loaded(medicine_id),
            medicine_name=medicine_name,
        )
        for medicine_id, medicine_name in medicines
    ]

    return ModelStatusResponse(models=entries)


@router.post("/train/{medicine_id}")
async def train_medicine(
    medicine_id: int,
    db: AsyncSession = Depends(get_db),
    registry: ModelRegistry = Depends(get_model_registry),
) -> TrainResponse:
    """Train (or retrain) the Prophet model for a single medicine."""

    medicine = await db.get(Medicine, medicine_id)
    if medicine is None:
        raise HTTPException(status_code=404, detail="Medicine not found.")

    try:
        results = await train_all_models_for_medicine(db, medicine_id)
    except Exception:
        logger.exception("Unexpected error training medicine_id=%s", medicine_id)
        return TrainResponse(medicine_id=medicine_id, status="error", message="Training failed unexpectedly.")

    trained_models = [name for name, ok in results.items() if ok]
    if not trained_models:
        return TrainResponse(
            medicine_id=medicine_id,
            status="insufficient_data",
            message="Not enough transaction history to train any model (need at least 14 daily data points).",
        )

    await registry.reload(medicine_id, MODELS_DIR)
    return TrainResponse(
        medicine_id=medicine_id,
        status="trained",
        message=f"Trained models: {', '.join(trained_models)}.",
    )
