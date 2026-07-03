"""SEO-Позиции — мониторинг позиций в поиске WB (BETA)."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health():
    return {"module": "seo", "status": "beta", "path": "/api/seo"}


@router.get("/keywords")
async def list_keywords():
    return {"module": "seo", "status": "beta", "keywords": []}
