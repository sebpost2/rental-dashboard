from pydantic import BaseModel


class ReportSummary(BaseModel):
    total_income: float
    total_expenses: float
    net_balance: float


class TimeseriesPoint(BaseModel):
    period: str
    income: float
    expenses: float
