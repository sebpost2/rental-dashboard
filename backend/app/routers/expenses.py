from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_owned_property
from app.models.expense import Expense
from app.models.property import Property
from app.schemas.expense import ExpenseCreate, ExpenseRead

router = APIRouter(prefix="/properties/{property_id}/expenses", tags=["expenses"])


def _get_expense(expense_id: int, prop: Property, db: Session) -> Expense:
    expense = (
        db.query(Expense)
        .filter(Expense.id == expense_id, Expense.property_id == prop.id)
        .first()
    )
    if expense is None:
        raise HTTPException(status_code=404, detail="Expense not found")
    return expense


@router.post("", response_model=ExpenseRead, status_code=status.HTTP_201_CREATED)
def create_expense(
    payload: ExpenseCreate,
    prop: Property = Depends(get_owned_property),
    db: Session = Depends(get_db),
):
    expense = Expense(property_id=prop.id, **payload.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.get("", response_model=list[ExpenseRead])
def list_expenses(
    start_date: date | None = None,
    end_date: date | None = None,
    prop: Property = Depends(get_owned_property),
    db: Session = Depends(get_db),
):
    query = db.query(Expense).filter(Expense.property_id == prop.id)
    if start_date is not None:
        query = query.filter(Expense.date >= start_date)
    if end_date is not None:
        query = query.filter(Expense.date <= end_date)
    return query.order_by(Expense.date).all()


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    expense_id: int,
    prop: Property = Depends(get_owned_property),
    db: Session = Depends(get_db),
):
    expense = _get_expense(expense_id, prop, db)
    db.delete(expense)
    db.commit()
