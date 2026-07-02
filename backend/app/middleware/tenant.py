"""Multi-tenancy: every request must carry a cabinet the user owns."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class TenantMiddleware(BaseHTTPMiddleware):
    """Inject and validate cabinet_id from header or query.

    Header: X-Cabinet-Id
    All /api/* routes (except health) require it unless cabinet_id is in JWT claims
    (future: Supabase JWT validation).
    """

    SKIP_PATHS = {"/api/health", "/api/docs", "/api/openapi.json", "/docs", "/openapi.json"}

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if any(path.startswith(p) for p in self.SKIP_PATHS):
            return await call_next(request)

        if not path.startswith("/api/"):
            return await call_next(request)

        cabinet_id = (
            request.headers.get("X-Cabinet-Id")
            or request.query_params.get("cabinet_id")
        )
        auth = request.headers.get("Authorization", "")

        if not cabinet_id:
            return JSONResponse(
                {"error": "cabinet_id required (X-Cabinet-Id header or ?cabinet_id=)"},
                status_code=400,
            )
        if not auth.startswith("Bearer "):
            return JSONResponse({"error": "Authorization Bearer token required"}, status_code=401)

        request.state.cabinet_id = cabinet_id
        request.state.auth_token = auth.replace("Bearer ", "", 1)
        return await call_next(request)
