def register(client, email="user@example.com", password="secret123"):
    return client.post("/auth/register", json={"email": email, "password": password})


def login(client, email="user@example.com", password="secret123"):
    return client.post("/auth/login", data={"username": email, "password": password})


def test_register_creates_user(client):
    response = register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "user@example.com"
    assert "id" in body
    assert "password" not in body
    assert "hashed_password" not in body


def test_register_duplicate_email_rejected(client):
    register(client)
    response = register(client)

    assert response.status_code == 400


def test_login_with_correct_credentials_returns_token(client):
    register(client)
    response = login(client)

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert len(body["access_token"]) > 0


def test_login_with_wrong_password_rejected(client):
    register(client)
    response = login(client, password="wrong-password")

    assert response.status_code == 401


def test_login_with_unknown_email_rejected(client):
    response = login(client, email="ghost@example.com")

    assert response.status_code == 401


def test_me_without_token_rejected(client):
    response = client.get("/auth/me")

    assert response.status_code == 401


def test_me_with_valid_token_returns_current_user(client):
    register(client)
    token = login(client).json()["access_token"]

    response = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    assert response.json()["email"] == "user@example.com"


def test_me_with_invalid_token_rejected(client):
    response = client.get("/auth/me", headers={"Authorization": "Bearer garbage"})

    assert response.status_code == 401


def test_register_with_short_password_rejected(client):
    response = register(client, password="short")

    assert response.status_code == 422


def test_login_is_rate_limited(client):
    responses = [login(client, email="nobody@example.com") for _ in range(11)]

    assert responses[-1].status_code == 429


def test_register_is_rate_limited(client):
    responses = [
        register(client, email=f"limit{i}@example.com") for i in range(11)
    ]

    assert responses[-1].status_code == 429


def test_login_sets_httponly_cookie(client):
    register(client)
    response = login(client)

    cookie = response.cookies.get("access_token")
    assert cookie is not None
    set_cookie_header = response.headers.get("set-cookie", "")
    assert "HttpOnly" in set_cookie_header


def test_me_works_via_cookie_without_header(client):
    register(client)
    login(client)

    response = client.get("/auth/me")

    assert response.status_code == 200
    assert response.json()["email"] == "user@example.com"


def test_logout_clears_cookie(client):
    register(client)
    login(client)

    logout_response = client.post("/auth/logout")
    me_response = client.get("/auth/me")

    assert logout_response.status_code == 200
    assert me_response.status_code == 401
