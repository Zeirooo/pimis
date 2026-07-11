"""Trains and persists per-medicine demand forecasting models (Prophet + scikit-learn)."""

from __future__ import annotations

import asyncio
import logging
import os
import tempfile
from typing import TYPE_CHECKING, Sequence

import joblib
import pandas as pd
from prophet import Prophet
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.pipeline import Pipeline
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from backend.database.models import InventoryTransaction, TransactionType
from backend.ml.features import FEATURE_COLUMNS, build_supervised_dataset, build_time_series_df

if TYPE_CHECKING:
    from backend.ml.registry import ModelRegistry

logger = logging.getLogger(__name__)

MIN_TRAINING_DATA_POINTS = 14
# lag_14 needs 15 raw daily points to produce even one non-NaN training row, so
# a handful of raw days above MIN_TRAINING_DATA_POINTS are effectively required
# before the sklearn model can be fit; this guards against training on 1-2 rows.
MIN_SKLEARN_SUPERVISED_ROWS = 3
MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models"))

# Bounds how many Prophet/sklearn fits run at once during a batch sweep
# (train/all, startup backfill). Each fit is CPU-heavy; unbounded concurrency
# would starve the shared default thread pool that also serves single-medicine
# predict/train requests.
_TRAINING_CONCURRENCY = asyncio.Semaphore(2)

# Prevents two batch sweeps (e.g. the startup backfill and a manually
# triggered /train/all) from running at the same time and duplicating work.
_sweep_lock = asyncio.Lock()


def _atomic_dump(obj: object, model_path: str) -> None:
    """Write a pickle atomically: fit can be killed mid-write without corrupting
    the previous (or a concurrently-written) model file at `model_path`."""

    models_dir = os.path.dirname(model_path)
    fd, tmp_path = tempfile.mkstemp(dir=models_dir, prefix=".tmp-", suffix=".pkl")
    try:
        os.close(fd)
        joblib.dump(obj, tmp_path)
        os.replace(tmp_path, model_path)
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise


async def _fetch_outgoing_transactions(db: AsyncSession, medicine_id: int) -> list[InventoryTransaction]:
    """Load all OUTGOING transactions for a medicine, oldest and newest included."""

    stmt = select(InventoryTransaction).where(
        InventoryTransaction.medicine_id == medicine_id,
        InventoryTransaction.transaction_type == TransactionType.OUTGOING,
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


def _fit_prophet(df: pd.DataFrame) -> Prophet:
    """Blocking Prophet fit, run off the event loop via asyncio.to_thread."""

    model = Prophet(
        weekly_seasonality=True,
        yearly_seasonality=False,
        daily_seasonality=False,
        changepoint_prior_scale=0.05,
        uncertainty_samples=100,
    )
    model.fit(df)
    return model


def _save_prophet_model(transactions: list[InventoryTransaction], medicine_id: int, models_dir: str) -> bool:
    """Build the daily series, fit Prophet, and persist it. Synchronous by design."""

    df = build_time_series_df(transactions)
    if len(df) < MIN_TRAINING_DATA_POINTS:
        logger.info(
            "Not enough data points to train Prophet for medicine_id=%s (%d < %d)",
            medicine_id,
            len(df),
            MIN_TRAINING_DATA_POINTS,
        )
        return False

    try:
        model = _fit_prophet(df)
        os.makedirs(models_dir, exist_ok=True)
        model_path = os.path.join(models_dir, f"prophet_{medicine_id}.pkl")
        _atomic_dump(model, model_path)
    except Exception:
        logger.exception("Prophet training failed for medicine_id=%s", medicine_id)
        return False

    logger.info("Trained and saved Prophet model for medicine_id=%s -> %s", medicine_id, model_path)
    return True


async def train_model_for_medicine(db: AsyncSession, medicine_id: int, models_dir: str = MODELS_DIR) -> bool:
    """Train and persist a Prophet model for one medicine.

    Returns False (without raising) when there isn't enough transaction
    history yet, or when training fails for any reason. Returns True only
    when a model was successfully fit and saved to disk.
    """

    transactions = await _fetch_outgoing_transactions(db, medicine_id)
    return await asyncio.to_thread(_save_prophet_model, transactions, medicine_id, models_dir)


def train_sklearn_model(transactions: list[InventoryTransaction], medicine_id: int, models_dir: str = MODELS_DIR) -> bool:
    """Train and persist a GradientBoostingRegressor demand model for one medicine.

    Synchronous by design (unlike train_model_for_medicine) so callers that
    already have `transactions` in hand can offload the fit to a worker
    thread themselves via asyncio.to_thread instead of this function issuing
    its own database query.

    Features: lag_7, lag_14, rolling_mean_7, day_of_week, is_weekend.
    Suited to medicines with irregular/non-seasonal demand or with too little
    history (>=14 but <30 days) for Prophet's seasonal model to be reliable.
    """

    df = build_time_series_df(transactions)
    if len(df) < MIN_TRAINING_DATA_POINTS:
        logger.info(
            "Not enough data points to train sklearn model for medicine_id=%s (%d < %d)",
            medicine_id,
            len(df),
            MIN_TRAINING_DATA_POINTS,
        )
        return False

    supervised = build_supervised_dataset(df)
    if len(supervised) < MIN_SKLEARN_SUPERVISED_ROWS:
        logger.info(
            "Not enough supervised rows after feature engineering for medicine_id=%s (%d < %d)",
            medicine_id,
            len(supervised),
            MIN_SKLEARN_SUPERVISED_ROWS,
        )
        return False

    try:
        features = supervised[FEATURE_COLUMNS]
        target = supervised["y"]

        pipeline = Pipeline([("regressor", GradientBoostingRegressor(n_estimators=100, max_depth=3))])
        pipeline.fit(features, target)

        os.makedirs(models_dir, exist_ok=True)
        model_path = os.path.join(models_dir, f"sklearn_{medicine_id}.pkl")
        _atomic_dump(pipeline, model_path)
    except Exception:
        logger.exception("Sklearn training failed for medicine_id=%s", medicine_id)
        return False

    logger.info("Trained and saved sklearn model for medicine_id=%s -> %s", medicine_id, model_path)
    return True


async def train_all_models_for_medicine(
    db: AsyncSession, medicine_id: int, models_dir: str = MODELS_DIR
) -> dict[str, bool]:
    """Train both the Prophet and scikit-learn models for one medicine.

    Fetches transaction history once and fits both models off the event loop.
    Returns which of the two models were successfully trained, e.g.
    {"prophet": True, "sklearn": False}.
    """

    transactions = await _fetch_outgoing_transactions(db, medicine_id)

    prophet_trained = await asyncio.to_thread(_save_prophet_model, transactions, medicine_id, models_dir)
    sklearn_trained = await asyncio.to_thread(train_sklearn_model, transactions, medicine_id, models_dir)

    return {"prophet": prophet_trained, "sklearn": sklearn_trained}


async def train_batch(
    session_factory: async_sessionmaker[AsyncSession],
    medicine_ids: Sequence[int],
    registry: "ModelRegistry",
    models_dir: str = MODELS_DIR,
    *,
    skip_if_fully_loaded: bool = False,
) -> bool:
    """Train a batch of medicines with bounded concurrency, reloading the
    registry for each medicine that trained successfully.

    Shared by the startup backfill and the /train/all endpoint so there is
    exactly one sweep implementation (and one lock) instead of two duplicated
    sequential loops. Returns False without training anything if another
    sweep is already in progress, which also prevents two sweeps from racing
    on the same medicine's model files.
    """

    if _sweep_lock.locked():
        logger.info("Training sweep already in progress; skipping this request.")
        return False

    async def _train_one(medicine_id: int) -> None:
        if (
            skip_if_fully_loaded
            and registry.is_prophet_loaded(medicine_id)
            and registry.is_sklearn_loaded(medicine_id)
        ):
            return

        async with _TRAINING_CONCURRENCY:
            try:
                async with session_factory() as db:
                    results = await train_all_models_for_medicine(db, medicine_id, models_dir)
                if results["prophet"] or results["sklearn"]:
                    await registry.reload(medicine_id, models_dir)
            except Exception:
                logger.exception("Batch training failed for medicine_id=%s", medicine_id)

    async with _sweep_lock:
        await asyncio.gather(*(_train_one(medicine_id) for medicine_id in medicine_ids))

    return True
