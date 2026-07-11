"""In-memory registry of trained Prophet and scikit-learn models, keyed by medicine id."""

from __future__ import annotations

import asyncio
import logging
import os

import joblib
from fastapi import Request
from prophet import Prophet
from sklearn.pipeline import Pipeline

logger = logging.getLogger(__name__)

_PROPHET_PREFIX = "prophet_"
_SKLEARN_PREFIX = "sklearn_"
_MODEL_FILE_SUFFIX = ".pkl"


class ModelRegistry:
    """Thread-safe in-memory store of loaded Prophet and scikit-learn models.

    Intended to be constructed once per process and shared via FastAPI
    dependency injection rather than accessed as a module-level global.
    """

    def __init__(self) -> None:
        self._prophet_models: dict[int, Prophet] = {}
        self._sklearn_models: dict[int, Pipeline] = {}
        self._lock = asyncio.Lock()

    async def load_all(self, models_dir: str) -> None:
        """Scan `models_dir` for prophet_/sklearn_ pickle files and load them all."""

        if not os.path.isdir(models_dir):
            logger.warning("Model directory does not exist, skipping load: %s", models_dir)
            return

        async with self._lock:
            for filename in os.listdir(models_dir):
                medicine_id, prefix = _parse_model_filename(filename)
                if medicine_id is None or prefix is None:
                    continue

                model_path = os.path.join(models_dir, filename)
                try:
                    model = joblib.load(model_path)
                except Exception:
                    logger.exception("Failed to load model file %s", model_path)
                    continue

                if prefix == _PROPHET_PREFIX:
                    self._prophet_models[medicine_id] = model
                else:
                    self._sklearn_models[medicine_id] = model

    def get_prophet(self, medicine_id: int) -> Prophet | None:
        """Return the loaded Prophet model for a medicine, or None if not present."""

        return self._prophet_models.get(medicine_id)

    def get_sklearn(self, medicine_id: int) -> Pipeline | None:
        """Return the loaded scikit-learn model for a medicine, or None if not present."""

        return self._sklearn_models.get(medicine_id)

    async def reload(self, medicine_id: int, models_dir: str) -> None:
        """Reload a single medicine's models from disk, replacing any cached copies."""

        prophet_path = os.path.join(models_dir, f"{_PROPHET_PREFIX}{medicine_id}{_MODEL_FILE_SUFFIX}")
        sklearn_path = os.path.join(models_dir, f"{_SKLEARN_PREFIX}{medicine_id}{_MODEL_FILE_SUFFIX}")

        async with self._lock:
            self._reload_one(self._prophet_models, medicine_id, prophet_path)
            self._reload_one(self._sklearn_models, medicine_id, sklearn_path)

    def _reload_one(
        self,
        store: dict[int, Prophet] | dict[int, Pipeline],
        medicine_id: int,
        path: str,
    ) -> None:
        if not os.path.isfile(path):
            store.pop(medicine_id, None)
            return

        try:
            store[medicine_id] = joblib.load(path)
        except Exception:
            logger.exception("Failed to reload model file %s", path)
            store.pop(medicine_id, None)

    def is_prophet_loaded(self, medicine_id: int) -> bool:
        """Return True if a Prophet model for this medicine is currently in memory."""

        return medicine_id in self._prophet_models

    def is_sklearn_loaded(self, medicine_id: int) -> bool:
        """Return True if a scikit-learn model for this medicine is currently in memory."""

        return medicine_id in self._sklearn_models

    def is_loaded(self, medicine_id: int) -> bool:
        """Return True if any model (Prophet or scikit-learn) is loaded for this medicine."""

        return self.is_prophet_loaded(medicine_id) or self.is_sklearn_loaded(medicine_id)

    def loaded_medicine_ids(self) -> list[int]:
        """Return the ids of all medicines with at least one loaded model."""

        return sorted(set(self._prophet_models) | set(self._sklearn_models))


def _parse_model_filename(filename: str) -> tuple[int | None, str | None]:
    """Extract (medicine_id, prefix) from a `{prophet,sklearn}_{medicine_id}.pkl` filename."""

    if not filename.endswith(_MODEL_FILE_SUFFIX):
        return None, None

    for prefix in (_PROPHET_PREFIX, _SKLEARN_PREFIX):
        if filename.startswith(prefix):
            stem = filename[len(prefix) : -len(_MODEL_FILE_SUFFIX)]
            try:
                return int(stem), prefix
            except ValueError:
                return None, None

    return None, None


def get_model_registry(request: Request) -> ModelRegistry:
    """FastAPI dependency that resolves the app-wide ModelRegistry singleton."""

    return request.app.state.model_registry
