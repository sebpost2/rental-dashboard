from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_owned_property
from app.models.income import Income
from app.models.property import Property
from app.schemas.income import IncomeCreate, IncomeRead

router = APIRouter(prefix="/properties/{property_id}/incomes", tags=["income"])


def _get_income(income_id: int, prop: Property, db: Session) -> Income:
    income = (
        db.query(Income)
        .filter(Income.id == income_id, Income.property_id == prop.id)
        .first()
    )
    if income is None:
        raise HTTPException(status_code=404, detail="Income not found")
    return income


@router.post("", response_model=IncomeRead, status_code=status.HTTP_201_CREATED)
def create_income(
    payload: IncomeCreate,
    prop: Property = Depends(get_owned_property),
    db: Session = Depends(get_db),
):
    income = Income(property_id=prop.id, **payload.model_dump())
    db.add(income)
    db.commit()
    db.refresh(income)
    return income


@router.get("", response_model=list[IncomeRead])
def list_income(
    start_date: date | None = None,
    end_date: date | None = None,
    prop: Property = Depends(get_owned_property),
    db: Session = Depends(get_db),
):
    query = db.query(Income).filter(Income.property_id == prop.id)
    if start_date is not None:
        query = query.filter(Income.date >= start_date)
    if end_date is not None:
        query = query.filter(Income.date <= end_date)
    return query.order_by(Income.date).all()


@router.delete("/{income_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_income(
    income_id: int,
    prop: Property = Depends(get_owned_property),
    db: Session = Depends(get_db),
):
    income = _get_income(income_id, prop, db)
    db.delete(income)
    db.commit()
