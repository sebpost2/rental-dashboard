from datetime import date
from enum import Enum

from pydantic import BaseModel, ConfigDict


class ExpenseCategory(str, Enum):
    cleaning = "cleaning"
    maintenance = "maintenance"
    commission = "commission"
    other = "other"


class ExpenseCreate(BaseModel):
    date: date
    amount: float
    category: ExpenseCategory
    notes: str | None = None


class ExpenseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    amount: float
    category: ExpenseCategory
    notes: str | None
