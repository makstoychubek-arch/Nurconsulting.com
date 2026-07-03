"""Маркировка & ШК — интеграция Tekser / Честный Знак (BETA)."""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health():
    return {"module": "marking", "status": "beta", "path": "/api/marking", "provider": "tekser.kg"}


@router.post("/stickers")
async def generate_stickers():
    return {"module": "marking", "status": "beta", "message": "PDF sticker generation — in development"}
