"""NR Space API — FastAPI backend with strict multi-tenant cabinet isolation."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.middleware.tenant import TenantMiddleware
from app.routers import ab_tests, health

app = FastAPI(title="NR Space API", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TenantMiddleware)

app.include_router(health.router, prefix="/api")
app.include_router(ab_tests.router, prefix="/api/ab-tests", tags=["A/B Tests"])
