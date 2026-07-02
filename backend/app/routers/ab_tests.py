"""A/B test endpoints — ad CPM and content photo experiments."""

from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.services.ab_compare import AbComparisonResult, PeriodMetrics, compare_periods

router = APIRouter()


class PeriodInput(BaseModel):
    date_from: date
    date_to: date
    ad_spend: float = 0
    impressions: int = 0
    clicks: int = 0
    orders: int = 0
    sales_sum: float = 0
    profit: float = 0
    photo_url: str = ""


class AdAbTestCreate(BaseModel):
    nm_id: int
    product_name: str = ""
    period_a: PeriodInput
    period_b: PeriodInput
    cpm_a: float = Field(..., description="CPM period A")
    cpm_b: float = Field(..., description="CPM period B")
    advert_id: Optional[int] = None


class ContentAbTestCreate(BaseModel):
    nm_id: int
    product_name: str = ""
    period_a: PeriodInput = Field(..., description="Week with photo #1")
    period_b: PeriodInput = Field(..., description="Week with photo #2")
    photo_index_a: int = 1
    photo_index_b: int = 2


class CompareRequest(BaseModel):
    period_a: PeriodInput
    period_b: PeriodInput


def _to_metrics(p: PeriodInput) -> PeriodMetrics:
    return PeriodMetrics(
        ad_spend=p.ad_spend,
        impressions=p.impressions,
        clicks=p.clicks,
        orders=p.orders,
        sales_sum=p.sales_sum,
        profit=p.profit,
    )


def _result_dict(r: AbComparisonResult) -> dict:
    return {
        "winner": r.winner,
        "delta_profit_pct": r.delta_profit_pct,
        "delta_cpo_pct": r.delta_cpo_pct,
        "delta_orders_pct": r.delta_orders_pct,
        "delta_ctr_pct": r.delta_ctr_pct,
        "profit_a": r.profit_a,
        "profit_b": r.profit_b,
        "cpo_a": r.cpo_a,
        "cpo_b": r.cpo_b,
        "summary": r.summary,
    }


@router.post("/compare")
async def compare_ab(req: Request, body: CompareRequest):
    """Compare two periods — returns winner, profit delta, CPO delta."""
    _cab = req.state.cabinet_id
    a = _to_metrics(body.period_a)
    b = _to_metrics(body.period_b)
    return {"cabinet_id": _cab, "comparison": _result_dict(compare_periods(a, b))}


@router.post("/ad-cpm")
async def create_ad_ab_test(req: Request, body: AdAbTestCreate):
    """A/B ad test: Period 1 at CPM X vs Period 2 at CPM Y."""
    _cab = req.state.cabinet_id
    a = _to_metrics(body.period_a)
    b = _to_metrics(body.period_b)
    comparison = compare_periods(a, b)
    return {
        "cabinet_id": _cab,
        "test_type": "ad_cpm",
        "nm_id": body.nm_id,
        "product_name": body.product_name,
        "cpm_a": body.cpm_a,
        "cpm_b": body.cpm_b,
        "advert_id": body.advert_id,
        "period_a": body.period_a.model_dump(),
        "period_b": body.period_b.model_dump(),
        "comparison": _result_dict(comparison),
    }


@router.post("/content-photo")
async def create_content_ab_test(req: Request, body: ContentAbTestCreate):
    """A/B content test: main photo #1 week vs photo #2 week."""
    _cab = req.state.cabinet_id
    a = _to_metrics(body.period_a)
    b = _to_metrics(body.period_b)
    comparison = compare_periods(a, b)
    return {
        "cabinet_id": _cab,
        "test_type": "content_photo",
        "nm_id": body.nm_id,
        "product_name": body.product_name,
        "photo_index_a": body.photo_index_a,
        "photo_index_b": body.photo_index_b,
        "period_a": body.period_a.model_dump(),
        "period_b": body.period_b.model_dump(),
        "comparison": _result_dict(comparison),
    }
