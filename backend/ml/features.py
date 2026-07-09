"""Feature engineering helpers shared by the Prophet and scikit-learn demand models."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, timedelta

import pandas as pd

from backend.database.models import InventoryTransaction

FEATURE_COLUMNS: list[str] = ["lag_7", "lag_14", "rolling_mean_7", "day_of_week", "is_weekend"]

_LAG_SHORT_DAYS = 7
_LAG_LONG_DAYS = 14


def build_time_series_df(transactions: list[InventoryTransaction]) -> pd.DataFrame:
    """Aggregate outgoing transactions into a daily (ds, y) time series.

    Multiple transactions on the same day are summed. Missing days within the
    observed date range are filled with zero demand so downstream models see
    a contiguous daily series.
    """

    if not transactions:
        return pd.DataFrame(columns=["ds", "y"])

    daily_quantity: dict[date, int] = defaultdict(int)
    for transaction in transactions:
        tx_time = transaction.timestamp
        tx_date = tx_time.date() if tx_time.tzinfo else tx_time.replace(tzinfo=UTC).date()
        daily_quantity[tx_date] += transaction.quantity

    start_date = min(daily_quantity)
    end_date = max(daily_quantity)

    dates: list[date] = []
    quantities: list[int] = []
    current = start_date
    while current <= end_date:
        dates.append(current)
        quantities.append(daily_quantity.get(current, 0))
        current += timedelta(days=1)

    return pd.DataFrame({"ds": pd.to_datetime(dates), "y": quantities})


def build_daily_series(transactions: list[InventoryTransaction]) -> pd.Series:
    """Return a date-indexed daily demand series, contiguous with zero-filled gaps."""

    df = build_time_series_df(transactions)
    if df.empty:
        return pd.Series(dtype="int64")

    series = df.set_index(df["ds"].dt.date)["y"]
    series.index.name = "date"
    return series


def build_supervised_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """Turn a contiguous daily (ds, y) series into lag/rolling/calendar features for training.

    Rows without enough history to compute lag_14 (the longest lookback) are
    dropped, since they would otherwise train on missing data.
    """

    if df.empty:
        return pd.DataFrame(columns=["ds", "y", *FEATURE_COLUMNS])

    frame = df.sort_values("ds").reset_index(drop=True).copy()
    frame["lag_7"] = frame["y"].shift(_LAG_SHORT_DAYS)
    frame["lag_14"] = frame["y"].shift(_LAG_LONG_DAYS)
    frame["rolling_mean_7"] = frame["y"].shift(1).rolling(window=7).mean()
    frame["day_of_week"] = frame["ds"].dt.dayofweek
    frame["is_weekend"] = frame["day_of_week"].isin([5, 6]).astype(int)

    return frame.dropna(subset=["lag_7", "lag_14", "rolling_mean_7"]).reset_index(drop=True)


def build_inference_features(daily_series: pd.Series, target_date: date) -> dict[str, float] | None:
    """Build the feature row needed to predict demand on target_date.

    True lag values are used when target_date's lookback falls inside the
    observed history; otherwise the recent 7/14-day average is used as a
    pragmatic stand-in (the common case, since target_date is usually in the
    future relative to the training data). Returns None when there is no
    history at all to build features from.
    """

    if daily_series.empty:
        return None

    recent_7 = daily_series.tail(7)
    recent_14 = daily_series.tail(14)

    def _lag_value(lag_days: int, recent_window: pd.Series) -> float:
        lag_date = target_date - timedelta(days=lag_days)
        if lag_date in daily_series.index:
            return float(daily_series.loc[lag_date])
        return float(recent_window.mean()) if not recent_window.empty else 0.0

    day_of_week = target_date.weekday()

    return {
        "lag_7": _lag_value(_LAG_SHORT_DAYS, recent_7),
        "lag_14": _lag_value(_LAG_LONG_DAYS, recent_14),
        "rolling_mean_7": float(recent_7.mean()),
        "day_of_week": float(day_of_week),
        "is_weekend": float(day_of_week >= 5),
    }
