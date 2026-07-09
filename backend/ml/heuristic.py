"""Deterministic fallback forecaster used when no trained ML model is available."""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date
from math import ceil
from statistics import mean

from backend.database.models import InventoryTransaction


def heuristic_predict(
    transactions: list[InventoryTransaction],
    target_date: date,
    safety_stock: int,
) -> tuple[int, float]:
    """Estimate demand with a recency-weighted moving average plus trend.

    Aggregates outgoing transactions by day, estimates daily demand from the
    most recent week, and nudges the estimate upward when demand is trending
    up relative to the prior week. Falls back to the medicine's safety stock
    level when there is no transaction history at all.
    """

    if not transactions:
        return max(safety_stock, 1), 0.45

    daily_demand: dict[date, int] = defaultdict(int)
    for record in transactions:
        tx_time = record.timestamp
        tx_date = tx_time.date() if tx_time.tzinfo else tx_time.replace(tzinfo=UTC).date()
        daily_demand[tx_date] += record.quantity

    ordered = [daily_demand[day] for day in sorted(daily_demand)]
    recent = ordered[-7:]
    previous = ordered[-14:-7]
    daily_average = mean(recent)

    trend = max(mean(recent) - mean(previous), 0) if previous else 0

    days_ahead = max((target_date - date.today()).days, 1)
    horizon = min(days_ahead, 14)
    predicted_demand = max(1, ceil((daily_average + trend * 0.35) * horizon))
    confidence_score = min(0.92, 0.55 + len(ordered) * 0.03)

    return predicted_demand, round(confidence_score, 2)
