from fastapi import FastAPI

from app.routers.auth import router as auth_router

app = FastAPI(title="Rental Dashboard API")
app.include_router(auth_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
