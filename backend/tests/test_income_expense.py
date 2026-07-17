def register_and_login(client, email):
    client.post("/auth/register", json={"email": email, "password": "secret123"})
    response = client.post(
        "/auth/login", data={"username": email, "password": "secret123"}
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_property(client, headers, name="Beach House"):
    return client.post(
        "/properties",
        json={
            "name": name,
            "address": "123 Ocean Ave",
            "property_type": "apartment",
            "currency": "USD",
        },
        headers=headers,
    ).json()


# --- Income ---


def test_create_income_requires_auth(client):
    headers = register_and_login(client, "owner1@example.com")
    prop = create_property(client, headers)
    client.cookies.clear()

    response = client.post(
        f"/properties/{prop['id']}/incomes",
        json={"date": "2026-01-15", "amount": 150.0, "source": "Airbnb booking"},
    )

    assert response.status_code == 401


def test_create_income_returns_created_income(client):
    headers = register_and_login(client, "owner1@example.com")
    prop = create_property(client, headers)

    response = client.post(
        f"/properties/{prop['id']}/incomes",
        json={"date": "2026-01-15", "amount": 150.0, "source": "Airbnb booking"},
        headers=headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["amount"] == 150.0
    assert body["source"] == "Airbnb booking"


def test_create_income_on_other_users_property_returns_404(client):
    headers1 = register_and_login(client, "owner1@example.com")
    headers2 = register_and_login(client, "owner2@example.com")
    prop = create_property(client, headers1)

    response = client.post(
        f"/properties/{prop['id']}/incomes",
        json={"date": "2026-01-15", "amount": 150.0, "source": "x"},
        headers=headers2,
    )

    assert response.status_code == 404


def test_list_income_filters_by_date_range(client):
    headers = register_and_login(client, "owner1@example.com")
    prop = create_property(client, headers)
    client.post(
        f"/properties/{prop['id']}/incomes",
        json={"date": "2026-01-05", "amount": 100.0, "source": "January"},
        headers=headers,
    )
    client.post(
        f"/properties/{prop['id']}/incomes",
        json={"date": "2026-03-05", "amount": 200.0, "source": "March"},
        headers=headers,
    )

    response = client.get(
        f"/properties/{prop['id']}/incomes?start_date=2026-02-01&end_date=2026-03-31",
        headers=headers,
    )

    assert response.status_code == 200
    sources = [i["source"] for i in response.json()]
    assert sources == ["March"]


def test_delete_income(client):
    headers = register_and_login(client, "owner1@example.com")
    prop = create_property(client, headers)
    income = client.post(
        f"/properties/{prop['id']}/incomes",
        json={"date": "2026-01-15", "amount": 150.0, "source": "x"},
        headers=headers,
    ).json()

    response = client.delete(
        f"/properties/{prop['id']}/incomes/{income['id']}", headers=headers
    )

    assert response.status_code == 204


# --- Expense ---


def test_create_expense_returns_created_expense(client):
    headers = register_and_login(client, "owner1@example.com")
    prop = create_property(client, headers)

    response = client.post(
        f"/properties/{prop['id']}/expenses",
        json={"date": "2026-01-15", "amount": 50.0, "category": "cleaning"},
        headers=headers,
    )

    assert response.status_code == 201
    body = response.json()
    assert body["amount"] == 50.0
    assert body["category"] == "cleaning"


def test_create_expense_rejects_invalid_category(client):
    headers = register_and_login(client, "owner1@example.com")
    prop = create_property(client, headers)

    response = client.post(
        f"/properties/{prop['id']}/expenses",
        json={"date": "2026-01-15", "amount": 50.0, "category": "not-a-category"},
        headers=headers,
    )

    assert response.status_code == 422


def test_list_expenses_filters_by_date_range(client):
    headers = register_and_login(client, "owner1@example.com")
    prop = create_property(client, headers)
    client.post(
        f"/properties/{prop['id']}/expenses",
        json={"date": "2026-01-05", "amount": 30.0, "category": "cleaning"},
        headers=headers,
    )
    client.post(
        f"/properties/{prop['id']}/expenses",
        json={"date": "2026-03-05", "amount": 80.0, "category": "maintenance"},
        headers=headers,
    )

    response = client.get(
        f"/properties/{prop['id']}/expenses?start_date=2026-02-01&end_date=2026-03-31",
        headers=headers,
    )

    assert response.status_code == 200
    categories = [e["category"] for e in response.json()]
    assert categories == ["maintenance"]


def test_expense_on_other_users_property_returns_404(client):
    headers1 = register_and_login(client, "owner1@example.com")
    headers2 = register_and_login(client, "owner2@example.com")
    prop = create_property(client, headers1)

    response = client.get(f"/properties/{prop['id']}/expenses", headers=headers2)

    assert response.status_code == 404


def test_delete_expense(client):
    headers = register_and_login(client, "owner1@example.com")
    prop = create_property(client, headers)
    expense = client.post(
        f"/properties/{prop['id']}/expenses",
        json={"date": "2026-01-15", "amount": 50.0, "category": "cleaning"},
        headers=headers,
    ).json()

    response = client.delete(
        f"/properties/{prop['id']}/expenses/{expense['id']}", headers=headers
    )

    assert response.status_code == 204
