from datetime import date

from pydantic import BaseModel, ConfigDict, Field


class IncomeCreate(BaseModel):
    date: date
    amount: float = Field(ge=0)
    source: str = Field(min_length=1, max_length=200)
    notes: str | None = Field(default=None, max_length=1000)


class IncomeRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    amount: float
    source: str
    notes: str | None
