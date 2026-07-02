"""A/B comparison logic — profit and CPO deltas."""

from dataclasses import dataclass
from typing import Literal


@dataclass
class PeriodMetrics:
    ad_spend: float = 0
    impressions: int = 0
    clicks: int = 0
    orders: int = 0
    sales_sum: float = 0
    profit: float = 0

    @property
    def ctr_pct(self) -> float:
        return (self.clicks / self.impressions * 100) if self.impressions else 0

    @property
    def cpo(self) -> float:
        return (self.ad_spend / self.orders) if self.orders else 0


@dataclass
class AbComparisonResult:
    winner: Literal["a", "b", "tie"]
    delta_profit_pct: float
    delta_cpo_pct: float
    delta_orders_pct: float
    delta_ctr_pct: float
    profit_a: float
    profit_b: float
    cpo_a: float
    cpo_b: float
    summary: str


def compare_periods(a: PeriodMetrics, b: PeriodMetrics) -> AbComparisonResult:
    """Compare period A (before) vs B (after).

    Winner: higher profit; tie-breaker: lower CPO.
    """
    profit_a, profit_b = a.profit, b.profit
    cpo_a, cpo_b = a.cpo, b.cpo

    if profit_b > profit_a:
        winner: Literal["a", "b", "tie"] = "b"
    elif profit_a > profit_b:
        winner = "a"
    elif cpo_b < cpo_a and cpo_b > 0:
        winner = "b"
    elif cpo_a < cpo_b and cpo_a > 0:
        winner = "a"
    else:
        winner = "tie"

    def pct_delta(new: float, old: float) -> float:
        if old == 0:
            return 100.0 if new > 0 else 0.0
        return round((new - old) / abs(old) * 100, 2)

    delta_profit = pct_delta(profit_b, profit_a)
    delta_cpo = pct_delta(cpo_b, cpo_a) if cpo_a else (0 if cpo_b == 0 else 100)
    delta_orders = pct_delta(b.orders, a.orders)
    delta_ctr = pct_delta(b.ctr_pct, a.ctr_pct)

    if winner == "b":
        summary = (
            f"Период B эффективнее: прибыль {delta_profit:+.1f}%, "
            f"CPO {delta_cpo:+.1f}% ({'ниже' if delta_cpo < 0 else 'выше'})."
        )
    elif winner == "a":
        summary = f"Период A эффективнее: прибыль B {delta_profit:+.1f}% vs A."
    else:
        summary = "Разница незначительна — нужно больше данных."

    return AbComparisonResult(
        winner=winner,
        delta_profit_pct=delta_profit,
        delta_cpo_pct=delta_cpo,
        delta_orders_pct=delta_orders,
        delta_ctr_pct=delta_ctr,
        profit_a=profit_a,
        profit_b=profit_b,
        cpo_a=cpo_a,
        cpo_b=cpo_b,
        summary=summary,
    )
