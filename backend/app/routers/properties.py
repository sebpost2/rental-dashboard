from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import get_current_user, get_owned_property
from app.models.property import Property
from app.models.user import User
from app.schemas.property import PropertyCreate, PropertyRead, PropertyUpdate

router = APIRouter(prefix="/properties", tags=["properties"])


@router.post("", response_model=PropertyRead, status_code=status.HTTP_201_CREATED)
def create_property(
    payload: PropertyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    prop = Property(owner_id=current_user.id, **payload.model_dump())
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return prop


@router.get("", response_model=list[PropertyRead])
def list_properties(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return db.query(Property).filter(Property.owner_id == current_user.id).all()


@router.get("/{property_id}", response_model=PropertyRead)
def get_property(prop: Property = Depends(get_owned_property)):
    return prop


@router.patch("/{property_id}", response_model=PropertyRead)
def update_property(
    payload: PropertyUpdate,
    prop: Property = Depends(get_owned_property),
    db: Session = Depends(get_db),
):
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(prop, field, value)
    db.commit()
    db.refresh(prop)
    return prop


@router.delete("/{property_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_property(
    prop: Property = Depends(get_owned_property),
    db: Session = Depends(get_db),
):
    db.delete(prop)
    db.commit()
