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


def add_income(client, headers, property_id, date, amount, source="booking"):
    client.post(
        f"/properties/{property_id}/incomes",
        json={"date": date, "amount": amount, "source": source},
        headers=headers,
    )


def add_expense(client, headers, property_id, date, amount, category="cleaning"):
    client.post(
        f"/properties/{property_id}/expenses",
        json={"date": date, "amount": amount, "category": category},
        headers=headers,
    )


def test_summary_returns_totals_and_net_balance(client):
    headers = register_and_login(client, "owner1@example.com")
    prop = create_property(client, headers)
    add_income(client, headers, prop["id"], "2026-01-10", 200.0)
    add_income(client, headers, prop["id"], "2026-01-20", 100.0)
    add_expense(client, headers, prop["id"], "2026-01-15", 50.0)

    response = client.get("/reports/summary", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["total_income"] == 300.0
    assert body["total_expenses"] == 50.0
    assert body["net_balance"] == 250.0


def test_summary_filters_by_date_range(client):
    headers = register_and_login(client, "owner1@example.com")
    prop = create_property(client, headers)
    add_income(client, headers, prop["id"], "2026-01-10", 200.0)
    add_income(client, headers, prop["id"], "2026-03-10", 500.0)

    response = client.get(
        "/reports/summary?start_date=2026-02-01&end_date=2026-03-31", headers=headers
    )

    assert response.status_code == 200
    assert response.json()["total_income"] == 500.0


def test_summary_filters_by_property(client):
    headers = register_and_login(client, "owner1@example.com")
    prop1 = create_property(client, headers, name="Prop1")
    prop2 = create_property(client, headers, name="Prop2")
    add_income(client, headers, prop1["id"], "2026-01-10", 200.0)
    add_income(client, headers, prop2["id"], "2026-01-10", 999.0)

    response = client.get(
        f"/reports/summary?property_id={prop1['id']}", headers=headers
    )

    assert response.status_code == 200
    assert response.json()["total_income"] == 200.0


def test_summary_excludes_other_users_data(client):
    headers1 = register_and_login(client, "owner1@example.com")
    headers2 = register_and_login(client, "owner2@example.com")
    prop1 = create_property(client, headers1)
    add_income(client, headers1, prop1["id"], "2026-01-10", 200.0)

    response = client.get("/reports/summary", headers=headers2)

    assert response.status_code == 200
    assert response.json()["total_income"] == 0.0


def test_summary_with_no_data_returns_zeros(client):
    headers = register_and_login(client, "owner1@example.com")

    response = client.get("/reports/summary", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body == {"total_income": 0.0, "total_expenses": 0.0, "net_balance": 0.0}


def test_summary_rejects_other_users_property_filter(client):
    headers1 = register_and_login(client, "owner1@example.com")
    headers2 = register_and_login(client, "owner2@example.com")
    prop1 = create_property(client, headers1)

    response = client.get(
        f"/reports/summary?property_id={prop1['id']}", headers=headers2
    )

    assert response.status_code == 404


def test_timeseries_groups_by_month(client):
    headers = register_and_login(client, "owner1@example.com")
    prop = create_property(client, headers)
    add_income(client, headers, prop["id"], "2026-01-10", 100.0)
    add_income(client, headers, prop["id"], "2026-01-20", 50.0)
    add_expense(client, headers, prop["id"], "2026-02-05", 20.0)

    response = client.get("/reports/timeseries", headers=headers)

    assert response.status_code == 200
    body = response.json()
    jan = next(p for p in body if p["period"] == "2026-01")
    feb = next(p for p in body if p["period"] == "2026-02")
    assert jan["income"] == 150.0
    assert jan["expenses"] == 0.0
    assert feb["income"] == 0.0
    assert feb["expenses"] == 20.0


def test_export_csv_returns_combined_transactions(client):
    headers = register_and_login(client, "owner1@example.com")
    prop = create_property(client, headers)
    add_income(client, headers, prop["id"], "2026-01-10", 150.0, source="Airbnb")
    add_expense(client, headers, prop["id"], "2026-01-12", 30.0, category="cleaning")

    response = client.get("/reports/export", headers=headers)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    body = response.text
    assert "income" in body
    assert "expense" in body
    assert "150.0" in body
    assert "30.0" in body
