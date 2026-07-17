from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers.auth import router as auth_router
from app.routers.expenses import router as expenses_router
from app.routers.income import router as income_router
from app.routers.properties import router as properties_router
from app.routers.reports import router as reports_router

app = FastAPI(title="Rental Dashboard API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
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
