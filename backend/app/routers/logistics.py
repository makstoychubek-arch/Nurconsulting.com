"""Логистика & Поставки — остатки и отгрузки WB (BETA)."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health():
    return {"module": "logistics", "status": "beta", "path": "/api/logistics"}


@router.get("/supplies")
async def list_supplies():
    return {"module": "logistics", "status": "beta", "supplies": []}
