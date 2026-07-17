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
    )


def test_create_property_requires_auth(client):
    response = client.post("/properties", json={"name": "X", "address": "Y"})

    assert response.status_code == 401


def test_create_property_returns_created_property(client):
    headers = register_and_login(client, "owner1@example.com")

    response = create_property(client, headers)

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Beach House"
    assert body["currency"] == "USD"
    assert "id" in body


def test_list_properties_returns_only_own(client):
    headers1 = register_and_login(client, "owner1@example.com")
    headers2 = register_and_login(client, "owner2@example.com")
    create_property(client, headers1, name="Owner1 Property")
    create_property(client, headers2, name="Owner2 Property")

    response = client.get("/properties", headers=headers1)

    assert response.status_code == 200
    names = [p["name"] for p in response.json()]
    assert names == ["Owner1 Property"]


def test_get_property_by_id(client):
    headers = register_and_login(client, "owner1@example.com")
    created = create_property(client, headers).json()

    response = client.get(f"/properties/{created['id']}", headers=headers)

    assert response.status_code == 200
    assert response.json()["id"] == created["id"]


def test_get_other_users_property_returns_404(client):
    headers1 = register_and_login(client, "owner1@example.com")
    headers2 = register_and_login(client, "owner2@example.com")
    created = create_property(client, headers1).json()

    response = client.get(f"/properties/{created['id']}", headers=headers2)

    assert response.status_code == 404


def test_update_property(client):
    headers = register_and_login(client, "owner1@example.com")
    created = create_property(client, headers).json()

    response = client.patch(
        f"/properties/{created['id']}",
        json={"name": "Renamed House"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["name"] == "Renamed House"


def test_delete_property(client):
    headers = register_and_login(client, "owner1@example.com")
    created = create_property(client, headers).json()

    response = client.delete(f"/properties/{created['id']}", headers=headers)
    assert response.status_code == 204

    follow_up = client.get(f"/properties/{created['id']}", headers=headers)
    assert follow_up.status_code == 404


def test_delete_other_users_property_returns_404(client):
    headers1 = register_and_login(client, "owner1@example.com")
    headers2 = register_and_login(client, "owner2@example.com")
    created = create_property(client, headers1).json()

    response = client.delete(f"/properties/{created['id']}", headers=headers2)

    assert response.status_code == 404
