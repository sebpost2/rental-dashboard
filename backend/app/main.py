from fastapi import FastAPI

app = FastAPI(title="Rental Dashboard API")


@app.get("/health")
def health_check():
    return {"status": "ok"}
