import csv
import io
from collections import defaultdict
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user
from app.models.expense import Expense
from app.models.income import Income
from app.models.property import Property
from app.models.user import User
from app.schemas.report import ReportSummary, TimeseriesPoint

router = APIRouter(prefix="/reports", tags=["reports"])


def _validate_property_filter(
    property_id: int | None, db: Session, current_user: User
) -> int | None:
    if property_id is None:
        return None
    prop = (
        db.query(Property)
        .filter(Property.id == property_id, Property.owner_id == current_user.id)
        .first()
    )
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")
    return property_id


def _owned_incomes(db: Session, current_user: User, property_id: int | None):
    query = db.query(Income).join(Property).filter(Property.owner_id == current_user.id)
    if property_id is not None:
        query = query.filter(Income.property_id == property_id)
    return query


def _owned_expenses(db: Session, current_user: User, property_id: int | None):
    query = (
        db.query(Expense).join(Property).filter(Property.owner_id == current_user.id)
    )
    if property_id is not None:
        query = query.filter(Expense.property_id == property_id)
    return query


@router.get("/summary", response_model=ReportSummary)
def summary(
    start_date: date | None = None,
    end_date: date | None = None,
    property_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    property_id = _validate_property_filter(property_id, db, current_user)

    incomes = _owned_incomes(db, current_user, property_id)
    expenses = _owned_expenses(db, current_user, property_id)
    if start_date is not None:
        incomes = incomes.filter(Income.date >= start_date)
        expenses = expenses.filter(Expense.date >= start_date)
    if end_date is not None:
        incomes = incomes.filter(Income.date <= end_date)
        expenses = expenses.filter(Expense.date <= end_date)

    total_income = sum(float(i.amount) for i in incomes.all())
    total_expenses = sum(float(e.amount) for e in expenses.all())
    return ReportSummary(
        total_income=total_income,
        total_expenses=total_expenses,
        net_balance=total_income - total_expenses,
    )


@router.get("/timeseries", response_model=list[TimeseriesPoint])
def timeseries(
    start_date: date | None = None,
    end_date: date | None = None,
    property_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    property_id = _validate_property_filter(property_id, db, current_user)

    incomes = _owned_incomes(db, current_user, property_id)
    expenses = _owned_expenses(db, current_user, property_id)
    if start_date is not None:
        incomes = incomes.filter(Income.date >= start_date)
        expenses = expenses.filter(Expense.date >= start_date)
    if end_date is not None:
        incomes = incomes.filter(Income.date <= end_date)
        expenses = expenses.filter(Expense.date <= end_date)

    totals: dict[str, dict[str, float]] = defaultdict(lambda: {"income": 0.0, "expenses": 0.0})
    for i in incomes.all():
        period = i.date.strftime("%Y-%m")
        totals[period]["income"] += float(i.amount)
    for e in expenses.all():
        period = e.date.strftime("%Y-%m")
        totals[period]["expenses"] += float(e.amount)

    return [
        TimeseriesPoint(period=period, income=values["income"], expenses=values["expenses"])
        for period, values in sorted(totals.items())
    ]


@router.get("/export")
def export_csv(
    start_date: date | None = None,
    end_date: date | None = None,
    property_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    property_id = _validate_property_filter(property_id, db, current_user)

    incomes = _owned_incomes(db, current_user, property_id)
    expenses = _owned_expenses(db, current_user, property_id)
    if start_date is not None:
        incomes = incomes.filter(Income.date >= start_date)
        expenses = expenses.filter(Expense.date >= start_date)
    if end_date is not None:
        incomes = incomes.filter(Income.date <= end_date)
        expenses = expenses.filter(Expense.date <= end_date)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["type", "date", "amount", "description"])
    rows = [("income", i.date, float(i.amount), i.source) for i in incomes.all()]
    rows += [("expense", e.date, float(e.amount), e.category) for e in expenses.all()]
    for row in sorted(rows, key=lambda r: r[1]):
        writer.writerow(row)

    return Response(
        content=buffer.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=transactions.csv"},
    )
