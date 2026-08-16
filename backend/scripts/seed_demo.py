"""Create/reset the one-click demo account and sample ledger data.

Run after a fresh migration (e.g. new database): python -m scripts.seed_demo
"""

from datetime import date

from app.core.db import SessionLocal
from app.core.security import hash_password
from app.models.expense import Expense
from app.models.income import Income
from app.models.property import Property
from app.models.user import User

DEMO_EMAIL = "demo@rentalledger.com"
DEMO_PASSWORD = "demopass123"


def main() -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == DEMO_EMAIL).first()
        if user is None:
            user = User(email=DEMO_EMAIL, hashed_password=hash_password(DEMO_PASSWORD))
            db.add(user)
            db.commit()
            db.refresh(user)
            print(f"Created demo user {DEMO_EMAIL}")
        else:
            print(f"Demo user {DEMO_EMAIL} already exists")

        if db.query(Property).filter(Property.owner_id == user.id).first() is not None:
            print("Demo already has properties, skipping ledger seed")
            return

        prop = Property(
            owner_id=user.id,
            name="Casa Miraflores 402",
            address="Av. Larco 402, Miraflores, Lima",
            property_type="apartment",
            currency="USD",
        )
        db.add(prop)
        db.commit()
        db.refresh(prop)

        db.add_all(
            [
                Income(property_id=prop.id, date=date(2026, 6, 1), amount=1200, source="Rent"),
                Income(property_id=prop.id, date=date(2026, 7, 1), amount=1200, source="Rent"),
                Income(property_id=prop.id, date=date(2026, 8, 1), amount=1200, source="Rent"),
                Expense(property_id=prop.id, date=date(2026, 6, 5), amount=80, category="Utilities"),
                Expense(property_id=prop.id, date=date(2026, 7, 5), amount=95, category="Utilities"),
                Expense(property_id=prop.id, date=date(2026, 7, 18), amount=220, category="Maintenance", notes="Plumbing repair"),
                Expense(property_id=prop.id, date=date(2026, 8, 5), amount=85, category="Utilities"),
            ]
        )
        db.commit()
        print(f"Seeded property {prop.name!r} with 3 months of income/expenses")
    finally:
        db.close()


if __name__ == "__main__":
    main()
