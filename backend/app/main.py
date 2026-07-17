from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.limiter import limiter
from app.routers.auth import router as auth_router
from app.routers.expenses import router as expenses_router
from app.routers.income import router as income_router
from app.routers.properties import router as properties_router
from app.routers.reports import router as reports_router

app = FastAPI(title="Rental Dashboard API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router)
app.include_router(properties_router)
app.include_router(income_router)
app.include_router(expenses_router)
app.include_router(reports_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
