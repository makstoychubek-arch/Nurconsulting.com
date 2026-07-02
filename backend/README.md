# NR Space API (FastAPI)

## Запуск

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Multi-tenancy

Все запросы к `/api/*` (кроме `/api/health`) требуют:

- `Authorization: Bearer <supabase_jwt>`
- `X-Cabinet-Id: <uuid кабинета>`

## A/B тесты

### Сравнение периодов

```http
POST /api/ab-tests/compare
X-Cabinet-Id: {cabinet_uuid}
Authorization: Bearer {token}

{
  "period_a": { "date_from": "2026-06-01", "date_to": "2026-06-03", "ad_spend": 1000, "orders": 50, "profit": 20000 },
  "period_b": { "date_from": "2026-06-04", "date_to": "2026-06-07", "ad_spend": 900, "orders": 60, "profit": 25000 }
}
```

### A/B рекламы (CPM)

`POST /api/ab-tests/ad-cpm` — период A с CPM X vs период B с CPM Y.

### A/B контента (фото)

`POST /api/ab-tests/content-photo` — неделя с фото №1 vs неделя с фото №2.

Ответ содержит `comparison.winner`, `delta_profit_pct`, `delta_cpo_pct`, `summary`.
