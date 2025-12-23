import os
import re
from typing import Any, Optional

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from main import (
    CortiClient,
    DEFAULT_API_URL,
    EMAIL_PROTOCOL,
    BOOKING_PROTOCOL,
    get_access_token,
    get_or_create_ally_agent,
    send_message_to_ally,
)

load_dotenv()

app = FastAPI(title="Ally API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str
    context_id: Optional[str] = None
    patient_data: Optional[dict[str, Any]] = None


class ConfirmBookingRequest(BaseModel):
    date: str
    time: str
    patient_id: Optional[str] = None


class SendEmailRequest(BaseModel):
    recipient: str
    subject: str
    body: str


def build_runtime_prompt(message: str, patient_context: str = "") -> str:
    if patient_context:
        instruction = (
            "You have access to the patient's context above. Use it to answer clinical questions."
        )
        return (
            f"{patient_context}\n{instruction}\n\n"
            f"{BOOKING_PROTOCOL}\n\n{EMAIL_PROTOCOL}\n\nUSER REQUEST: {message}"
        )
    return f"{BOOKING_PROTOCOL}\n\n{EMAIL_PROTOCOL}\n\nUSER REQUEST: {message}"


def normalize_key(key: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", key.lower())


def prettify_key(key: str) -> str:
    if not isinstance(key, str):
        return "Field"
    spaced = re.sub(r"[_-]+", " ", key)
    spaced = re.sub(r"([a-z0-9])([A-Z])", r"\1 \2", spaced)
    return spaced.strip().title()


def format_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, bool):
        return "Yes" if value else "No"
    if isinstance(value, (int, float)):
        return str(value)
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, dict):
        parts = []
        for item_key, item_value in value.items():
            formatted = format_value(item_value)
            if formatted:
                parts.append(f"{prettify_key(item_key)}: {formatted}")
        return "; ".join(parts)
    if isinstance(value, list):
        items = [format_value(item) for item in value]
        return ", ".join([item for item in items if item])
    return str(value)


def build_patient_context(patient_data: Optional[dict[str, Any]]) -> str:
    if not patient_data:
        return ""

    normalized = {
        normalize_key(str(key)): (key, value)
        for key, value in patient_data.items()
    }
    used_keys = set()
    lines = ["--- PATIENT CONTEXT ---"]
    preferred = [
        ("name", "Name"),
        ("age", "Age"),
        ("diagnosis", "Condition/Diagnosis"),
        ("condition", "Condition/Diagnosis"),
        ("conditions", "Condition/Diagnosis"),
        ("recentnotes", "Recent Notes"),
        ("notes", "Recent Notes"),
    ]

    for key, label in preferred:
        match = normalized.get(key)
        if not match:
            continue
        original_key, value = match
        formatted = format_value(value)
        if not formatted:
            continue
        lines.append(f"{label}: {formatted}")
        used_keys.add(original_key)

    for key, value in patient_data.items():
        if key in used_keys:
            continue
        formatted = format_value(value)
        if not formatted:
            continue
        lines.append(f"{prettify_key(key)}: {formatted}")

    lines.append("-----------------------")
    return "\n".join(lines)


def extract_booking_proposals(text: str) -> list[dict[str, str]]:
    proposals = []
    for match in re.finditer(r"\[BOOKING_PROPOSAL:\s*([^\s\]]+)\s+([^\]]+)\]", text):
        proposals.append({"date": match.group(1).strip(), "time": match.group(2).strip()})
    return proposals


def extract_email_drafts(text: str) -> list[str]:
    return [
        match.group(1).strip()
        for match in re.finditer(r"\[EMAIL_START\](.*?)\[EMAIL_END\]", text, re.DOTALL)
    ]


@app.post("/chat")
def chat(request: ChatRequest):
    load_dotenv()
    tenant = os.getenv("CORTI_TENANT", "").strip()
    api_url = os.getenv("CORTI_API_URL", DEFAULT_API_URL).strip() or DEFAULT_API_URL

    if not tenant:
        raise HTTPException(status_code=500, detail="Missing CORTI_TENANT.")

    try:
        access_token = get_access_token()
        client = CortiClient(api_url=api_url, access_token=access_token, tenant=tenant)
        agent_id = get_or_create_ally_agent(client)
        patient_context = build_patient_context(request.patient_data)
        runtime_prompt = build_runtime_prompt(request.message, patient_context)
        context_id, reply = send_message_to_ally(
            client,
            agent_id,
            runtime_prompt,
            context_id=request.context_id,
            patient_data=request.patient_data,
        )
    except (requests.RequestException, ValueError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return {
        "reply": reply,
        "context_id": context_id,
        "tags": {
            "booking_proposals": extract_booking_proposals(reply or ""),
            "email_drafts": extract_email_drafts(reply or ""),
        },
    }


@app.post("/confirm-booking")
def confirm_booking(request: ConfirmBookingRequest):
    print(
        "Booking confirmed:",
        {
            "date": request.date,
            "time": request.time,
            "patient_id": request.patient_id,
        },
    )
    return {"status": "success", "message": "Booking oprettet i kalenderen"}


@app.post("/send-email")
def send_email(request: SendEmailRequest):
    print(
        "Sending email...",
        {
            "recipient": request.recipient,
            "subject": request.subject,
            "body": request.body,
        },
    )
    return {"status": "success", "message": "Mail sendt"}
