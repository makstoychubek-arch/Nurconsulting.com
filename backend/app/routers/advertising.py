"""Контроль РК — управление рекламными кампаниями WB (BETA)."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health():
    return {"module": "advertising", "status": "beta", "path": "/api/advertising"}


@router.get("/campaigns")
async def list_campaigns():
    """Список кампаний — данные через wb-proxy advert_list на фронте."""
    return {"module": "advertising", "status": "beta", "campaigns": []}
