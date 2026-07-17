from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import decode_access_token
from app.models.property import Property
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def get_current_user(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = token or request.cookies.get("access_token")
    if token is None:
        raise credentials_exception

    email = decode_access_token(token)
    if email is None:
        raise credentials_exception

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception

    return user


def get_owned_property(
    property_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Property:
    prop = (
        db.query(Property)
        .filter(Property.id == property_id, Property.owner_id == current_user.id)
        .first()
    )
    if prop is None:
        raise HTTPException(status_code=404, detail="Property not found")
    return prop
