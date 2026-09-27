"""Tests for the agent runtime webhook ingest + Meta verification endpoints."""

from fastapi.testclient import TestClient

from src.main import app

client = TestClient(app)


class FakeOrchestrator:
    """Stand-in for AgentOrchestrator; records the user_id it was built with."""

    instances: list[str] = []

    def __init__(self, user_id: str):
        self.user_id = user_id
        FakeOrchestrator.instances.append(user_id)

    async def send_message(self, message: str) -> str:
        return f"echo: {message}"


def test_ingest_telegram_shape(monkeypatch):
    monkeypatch.setattr("src.main.AgentOrchestrator", FakeOrchestrator)
    resp = client.post(
        "/webhook/ingest",
        json={
            "channel": "telegram",
            "payload": {"message": {"text": "hello", "from": {"id": 42}, "chat": {"id": -1}}},
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["received"] is True
    assert body["channel"] == "telegram"
    assert body["reply"] == "echo: hello"
    assert body["session_id"].startswith("webhook:telegram:42")
    assert FakeOrchestrator.instances[-1] == "42"


def test_ingest_api_forwarded_shape(monkeypatch):
    monkeypatch.setattr("src.main.AgentOrchestrator", FakeOrchestrator)
    resp = client.post(
        "/webhook/ingest",
        json={"channel": "whatsapp", "payload": {"text": "hi", "userId": "u1", "channelId": "phone"}},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["reply"] == "echo: hi"
    assert body["session_id"] == "webhook:whatsapp:u1"


def test_ingest_empty_text_returns_400(monkeypatch):
    monkeypatch.setattr("src.main.AgentOrchestrator", FakeOrchestrator)
    resp = client.post(
        "/webhook/ingest",
        json={"channel": "generic", "payload": {"unrelated": "data"}},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "No message text found in payload"


def test_verify_handshake_success(monkeypatch):
    monkeypatch.setenv("WHATSAPP_VERIFY_TOKEN", "test-token")
    resp = client.get(
        "/webhook/verify",
        params={"hub_mode": "subscribe", "hub_verify_token": "test-token", "hub_challenge": "challenge-123"},
    )
    assert resp.status_code == 200
    assert resp.text == "challenge-123"


def test_verify_handshake_wrong_token(monkeypatch):
    monkeypatch.setenv("WHATSAPP_VERIFY_TOKEN", "test-token")
    resp = client.get(
        "/webhook/verify",
        params={"hub_mode": "subscribe", "hub_verify_token": "wrong", "hub_challenge": "challenge-123"},
    )
    assert resp.status_code == 403


def test_verify_handshake_unset_env(monkeypatch):
    monkeypatch.delenv("WHATSAPP_VERIFY_TOKEN", raising=False)
    resp = client.get(
        "/webhook/verify",
        params={"hub_mode": "subscribe", "hub_verify_token": "anything", "hub_challenge": "challenge-123"},
    )
    assert resp.status_code == 403