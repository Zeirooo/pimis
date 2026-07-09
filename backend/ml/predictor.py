"""Runs inference for a single medicine/date, preferring Prophet over scikit-learn.

Fallback order: Prophet -> scikit-learn (GradientBoostingRegressor) ->
signal the caller (returns (0, 0.0)) to use the heuristic forecaster.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date

import pandas as pd
from prophet import Prophet
from sklearn.pipeline import Pipeline

from backend.database.models import InventoryTransaction
from backend.ml.features import FEATURE_COLUMNS, build_daily_series, build_inference_features
from backend.ml.registry import ModelRegistry

logger = logging.getLogger(__name__)

_MIN_CONFIDENCE = 0.5
_MAX_PROPHET_CONFIDENCE = 0.95
_MAX_SKLEARN_CONFIDENCE = 0.85
_MIN_YHAT_FOR_CONFIDENCE = 1.0


async def predict_demand(
    medicine_id: int,
    target_date: date,
    registry: ModelRegistry,
    transactions: list[InventoryTransaction],
) -> tuple[int, float]:
    """Forecast demand for a medicine on a target date.

    Tries the medicine's trained Prophet model first, then its scikit-learn
    model, and returns (0, 0.0) when neither is available or usable --
    signaling the caller to fall back to the heuristic forecaster.
    """

    prophet_model = registry.get_prophet(medicine_id)
    if prophet_model is not None:
        result = await _predict_with_prophet(prophet_model, target_date, medicine_id)
        if result is not None:
            return result

    sklearn_model = registry.get_sklearn(medicine_id)
    if sklearn_model is not None:
        result = await _predict_with_sklearn(sklearn_model, transactions, target_date, medicine_id)
        if result is not None:
            return result

    return 0, 0.0


def _run_prophet_predict(model: Prophet, target_date: date) -> pd.DataFrame:
    future = pd.DataFrame({"ds": [pd.Timestamp(target_date)]})
    return model.predict(future)


async def _predict_with_prophet(model: Prophet, target_date: date, medicine_id: int) -> tuple[int, float] | None:
    try:
        forecast = await asyncio.to_thread(_run_prophet_predict, model, target_date)
    except Exception:
        logger.exception("Prophet prediction failed for medicine_id=%s", medicine_id)
        return None

    row = forecast.iloc[0]
    yhat = float(row["yhat"])
    yhat_lower = float(row["yhat_lower"])
    yhat_upper = float(row["yhat_upper"])

    predicted_demand = max(1, round(yhat))

    yhat_for_confidence = max(yhat, _MIN_YHAT_FOR_CONFIDENCE)
    confidence_score = 1 - (yhat_upper - yhat_lower) / (2 * yhat_for_confidence)
    confidence_score = max(_MIN_CONFIDENCE, min(_MAX_PROPHET_CONFIDENCE, confidence_score))

    return predicted_demand, round(confidence_score, 2)


def _run_sklearn_predict(model: Pipeline, features_row: dict[str, float]) -> "pd.Series[float]":
    features_df = pd.DataFrame([features_row], columns=FEATURE_COLUMNS)
    return model.predict(features_df)


async def _predict_with_sklearn(
    model: Pipeline,
    transactions: list[InventoryTransaction],
    target_date: date,
    medicine_id: int,
) -> tuple[int, float] | None:
    daily_series = build_daily_series(transactions)
    features_row = build_inference_features(daily_series, target_date)
    if features_row is None:
        return None

    try:
        prediction = await asyncio.to_thread(_run_sklearn_predict, model, features_row)
    except Exception:
        logger.exception("Sklearn prediction failed for medicine_id=%s", medicine_id)
        return None

    yhat = float(prediction[0])
    predicted_demand = max(1, round(yhat))

    # No native prediction interval from GradientBoostingRegressor, so confidence
    # is approximated from how much history backed the fit, capped below Prophet's
    # ceiling to reflect that this is the secondary/less mature model.
    observed_days = len(daily_series)
    confidence_score = min(_MAX_SKLEARN_CONFIDENCE, 0.5 + observed_days * 0.01)
    confidence_score = max(_MIN_CONFIDENCE, confidence_score)

    return predicted_demand, round(confidence_score, 2)
