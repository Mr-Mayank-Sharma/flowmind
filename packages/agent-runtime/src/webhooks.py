"""Webhook payload normalization for the agent runtime.

The API (apps/api/src/routers/webhooks.ts) already extracts `{text, userId,
channelId, raw}` before forwarding to POST /webhook/ingest. These helpers
mirror that extraction so the runtime also tolerates direct channel payloads
(Meta Graph, Telegram, Slack, Discord) when the API is bypassed.
"""

from __future__ import annotations

import json
from typing import Any


def _dig(payload: dict[str, Any], *path: str) -> Any:
    """Walk a nested dict path, returning None when any key is missing."""
    cur: Any = payload
    for key in path:
        if not isinstance(cur, dict):
            return None
        cur = cur.get(key)
    return cur


def extract_text(channel: str, payload: dict[str, Any]) -> str:
    """Return the message text from a webhook payload, or "" when absent.

    A top-level `text` string wins for every channel — that is the shape the
    API forwards. Raw channel shapes are handled as a fallback.
    """
    if isinstance(payload.get("text"), str) and payload["text"].strip():
        return payload["text"].strip()

    if channel == "telegram":
        text = _dig(payload, "message", "text")
    elif channel == "slack":
        text = _dig(payload, "event", "text") or payload.get("text")
    elif channel == "discord":
        text = payload.get("content")
    elif channel == "whatsapp":
        text = _dig(payload, "entry", 0, "changes", 0, "value", "messages", 0, "text", "body")
    else:
        text = payload.get("text")

    return text.strip() if isinstance(text, str) else ""


def extract_user_id(channel: str, payload: dict[str, Any]) -> str:
    """Return the sender id for session continuity, or "" when absent."""
    if isinstance(payload.get("userId"), str) and payload["userId"]:
        return payload["userId"]

    if channel == "telegram":
        uid = _dig(payload, "message", "from", "id")
    elif channel == "slack":
        uid = _dig(payload, "event", "user") or payload.get("user_id")
    elif channel == "discord":
        uid = _dig(payload, "author", "id") or _dig(payload, "member", "user", "id")
    elif channel == "whatsapp":
        uid = _dig(payload, "entry", 0, "changes", 0, "value", "messages", 0, "from")
    else:
        uid = payload.get("user_id")

    return str(uid) if uid is not None else ""


def extract_channel_id(channel: str, payload: dict[str, Any]) -> str:
    """Return the conversation/channel id, or "" when absent."""
    if isinstance(payload.get("channelId"), str) and payload["channelId"]:
        return payload["channelId"]

    if channel == "telegram":
        cid = _dig(payload, "message", "chat", "id")
    elif channel == "slack":
        cid = _dig(payload, "event", "channel") or payload.get("channel_id")
    elif channel == "discord":
        cid = payload.get("channel_id")
    elif channel == "whatsapp":
        cid = _dig(payload, "entry", 0, "changes", 0, "value", "metadata", "phone_number_id")
    else:
        cid = payload.get("channel_id")

    return str(cid) if cid is not None else ""


def payload_to_text(channel: str, payload: dict[str, Any]) -> str:
    """Fallback: stringify an unrecognized payload without crashing."""
    try:
        return json.dumps(payload, ensure_ascii=False)[:1000]
    except (TypeError, ValueError):
        return str(payload)[:1000]


def verify_meta_handshake(
    mode: str | None, verify_token: str | None, challenge: str | None, expected_token: str
) -> str | None:
    """Validate a Meta WhatsApp webhook verification handshake.

    Returns the challenge to echo back, or None when the handshake is invalid.
    """
    if mode != "subscribe" or not expected_token:
        return None
    if verify_token != expected_token:
        return None
    return challenge if challenge else None