from datetime import date

from pydantic import BaseModel, ConfigDict


class IncomeCreate(BaseModel):
    date: date
    amount: float
    source: str
    notes: str | None = None


class IncomeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    amount: float
    source: str
    notes: str | None
