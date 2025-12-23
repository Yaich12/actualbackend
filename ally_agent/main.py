import os
import re
import uuid

import requests
from dotenv import load_dotenv

from booking_expert import (
    book_appointment,
    check_availability,
    generate_patient_email,
)

DEFAULT_API_URL = "https://api.eu.corti.app/v2"
ALLY_AGENT_NAME = "Ally (Action Agent V2)"
ALLY_SYSTEM_PROMPT = """Du er Ally, en effektiv og faglig assistent for fysioterapeuter og kiropraktorer.
Din tone er professionel, faktuel og kortfattet. Ingen fyldord som "øh" eller "hmm".
Du skal altid svare på dansk.
Dine opgaver:
1. Sparring: Svar fagligt baseret på retningslinjer.
2. Handling: Hvis brugeren og patienten aftaler en tid (f.eks. "næste fredag kl 11"), skal du markere det tydeligt, så systemet kan booke det.
3. Mail: Hvis bedt om det, generer udkast til patientmail.

PROTOCOL FOR HANDLINGER (VIGTIGT):
- Hvis du og brugeren bliver enige om at booke en tid, SKAL du skrive dette tag i dit svar: [BOOKING_PROPOSAL: {Dato} {Tid}]
- Hvis du bliver bedt om at lave en mail til patienten, SKAL du omslutte mail-udkastet med disse tags: [EMAIL_START] ... indhold ... [EMAIL_END]"""

BOOKING_PROTOCOL = """SYSTEM OVERRIDE:
Du er en effektiv booking-assistent.
Når brugeren beder om en tid, SKAL du svare med dette format:
[BOOKING_PROPOSAL: YYYY-MM-DD HH:MM]

Eksempel: [BOOKING_PROPOSAL: 2025-01-10 11:00]
"""

EMAIL_PROTOCOL = """SYSTEM OVERRIDE:
Hvis du bliver bedt om at skrive en mail til patienten, SKAL du omslutte selve mail-teksten med disse tags:
[EMAIL_START]
... mail indhold ...
[EMAIL_END]
"""


def build_auth_headers(access_token: str, tenant: str) -> dict:
    if not access_token:
        raise ValueError("Access token is required for authentication.")
    if not tenant:
        raise ValueError("CORTI_TENANT is required for authentication.")
    return {
        "Authorization": f"Bearer {access_token}",
        "Tenant-Name": tenant,
        "Accept": "application/json",
    }


def get_access_token():
    client_id = os.getenv("CORTI_CLIENT_ID", "").strip()
    client_secret = os.getenv("CORTI_CLIENT_SECRET", "").strip()
    auth_url = os.getenv("CORTI_AUTH_URL", "").strip()

    if not client_id or not client_secret or not auth_url:
        raise ValueError(
            "Missing CORTI_CLIENT_ID, CORTI_CLIENT_SECRET, or CORTI_AUTH_URL."
        )

    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "client_credentials",
    }

    response = requests.post(
        auth_url,
        data=payload,
        headers={"Accept": "application/json"},
        timeout=20,
    )
    print(f"Status Code: {response.status_code}")
    print(f"Response Body: {response.text}")
    response.raise_for_status()
    payload = response.json() if response.content else {}
    access_token = payload.get("access_token")
    if not access_token:
        raise ValueError("Access token missing in auth response.")
    return access_token


class CortiClient:
    def __init__(self, api_url: str, access_token: str, tenant: str):
        self.api_url = api_url.rstrip("/")
        self.access_token = access_token
        self.client_id = os.getenv("CORTI_CLIENT_ID")
        self.client_secret = os.getenv("CORTI_CLIENT_SECRET")
        self.auth_url = os.getenv("CORTI_AUTH_URL")
        self.tenant = os.getenv("CORTI_TENANT") or tenant or "base"
        tenant_name = self.tenant
        self.headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Tenant-Name": tenant_name,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        self.agents = AgentsResource(self)

    def request(
        self,
        method: str,
        path: str,
        *,
        json=None,
        data=None,
        params=None,
        timeout: int = 20,
    ):
        url = f"{self.api_url}/{path.lstrip('/')}"
        headers = dict(self.headers)
        print(f"DEBUG OUTGOING HEADERS: {headers}")
        if data is not None and json is None:
            json = data
        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            json=json,
            params=params,
            timeout=timeout,
        )
        print(f"API Call: {method} {url}")
        print(f"API Status: {response.status_code}")
        print(f"API Response: {response.text}")
        response.raise_for_status()
        return response.json() if response.content else {}


class AgentsResource:
    def __init__(self, client: CortiClient):
        self.client = client

    def list(self, timeout: int = 20):
        return self.client.request("GET", "/agents", timeout=timeout)

    def create(self, payload: dict, timeout: int = 20):
        return self.client.request("POST", "/agents", json=payload, timeout=timeout)


def _normalize_agent_list(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("items", "data", "agents", "results"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
    return []


def _extract_agent_id(agent):
    if not isinstance(agent, dict):
        return None
    for key in ("id", "agentId", "agent_id"):
        value = agent.get(key)
        if value:
            return value
    nested = agent.get("agent")
    if isinstance(nested, dict):
        for key in ("id", "agentId", "agent_id"):
            value = nested.get(key)
            if value:
                return value
    return None


def get_or_create_ally_agent(client: CortiClient):
    existing = client.agents.list()
    agents = _normalize_agent_list(existing)
    for agent in agents:
        if not isinstance(agent, dict):
            continue
        if agent.get("name") == ALLY_AGENT_NAME:
            agent_id = _extract_agent_id(agent)
            if agent_id:
                return agent_id

    payload = {
        "name": ALLY_AGENT_NAME,
        "description": "Assistant for Physiotherapists",
    }
    created = client.agents.create(payload)
    agent_id = _extract_agent_id(created)
    if not agent_id:
        raise RuntimeError("Agent creation did not return an agent id.")
    return agent_id


def send_message_to_ally(client, agent_id, text, context_id=None, patient_data=None):
    parts = [{"kind": "text", "text": text}]
    if patient_data is not None:
        parts.append({"kind": "data", "data": patient_data})

    payload = {
        "message": {
            "role": "user",
            "kind": "message",
            "messageId": str(uuid.uuid4()),
            "parts": parts,
        }
    }
    if context_id:
        payload["contextId"] = context_id

    response = client.request(
        "POST", f"/agents/{agent_id}/v1/message:send", data=payload
    )

    task = response.get("task", {}) if isinstance(response, dict) else {}
    status = task.get("status", {}) if isinstance(task, dict) else {}
    message = status.get("message", {}) if isinstance(status, dict) else {}
    parts = message.get("parts", []) if isinstance(message, dict) else []
    reply_text = ""
    if parts:
        reply_text = parts[0].get("text", "") if isinstance(parts[0], dict) else ""

    new_context_id = (
        response.get("contextId")
        if isinstance(response, dict)
        else None
    )
    if not new_context_id and isinstance(status, dict):
        new_context_id = status.get("contextId") or task.get("contextId")

    return new_context_id, reply_text


def handle_agent_actions(reply_text):
    if not reply_text:
        return

    booking_matches = re.finditer(
        r"\[BOOKING_PROPOSAL:\s*([^\s\]]+)\s+([^\]]+)\]", reply_text
    )
    for match in booking_matches:
        date = match.group(1).strip()
        time = match.group(2).strip()
        check_availability(date)
        print(f"🔵 [MOCK UI] VISER KNAP: 'Book tid {date} {time}?'")

    email_matches = re.finditer(r"\[EMAIL_START\](.*?)\[EMAIL_END\]", reply_text, re.DOTALL)
    for match in email_matches:
        email_content = match.group(1).strip()
        print(f"✉️ [MOCK UI] VISER MAIL UDKAST:\n{email_content}")


def main():
    load_dotenv()
    tenant = os.getenv("CORTI_TENANT", "").strip()
    api_url = os.getenv("CORTI_API_URL", DEFAULT_API_URL).strip() or DEFAULT_API_URL

    if not tenant:
        raise SystemExit(
            "Missing CORTI_TENANT. Update ally_agent/.env and try again."
        )

    try:
        access_token = get_access_token()
    except (requests.RequestException, ValueError) as exc:
        raise SystemExit(f"Auth request failed: {exc}") from exc

    client = CortiClient(api_url=api_url, access_token=access_token, tenant=tenant)
    try:
        agent_id = get_or_create_ally_agent(client)
    except requests.RequestException as exc:
        raise SystemExit(f"Request failed: {exc}") from exc

    # print(f"Ally Agent ID: {agent_id}")

    mock_patient = {
        "navn": "Mette",
        "skade": "Tennisalbue",
        "sidste_behandling": "Chokbølge d. 12. oktober",
        "øvelser": ["Elastiktræk", "Udstrækning"],
    }
    ctx_id, reply = send_message_to_ally(
        client,
        agent_id,
        "Hvornår fik hun sidst chokbølge?",
        patient_data=mock_patient,
    )
    print("Ally reply:", reply)

    print("\n--- TEST 2: BOOKING TRIGGER (INJECTED PROTOCOL) ---")

    user_request = "Book en opfølgende konsultation til Mette næste fredag kl 11:00."

    # Combine protocol and request to force the behavior
    full_prompt = f"{BOOKING_PROTOCOL}\n\nUSER REQUEST: {user_request}"

    # Send the combined prompt
    ctx_id, reply = send_message_to_ally(
        client, agent_id, full_prompt, context_id=ctx_id
    )

    print(f"Ally Reply: {reply}")
    handle_agent_actions(reply)

    print("\n--- TEST 3: EMAIL TRIGGER ---")

    email_request = "Skriv en kort mail til Mette med hendes øvelser (Elastiktræk og Udstrækning)."
    full_email_prompt = f"{EMAIL_PROTOCOL}\n\nUSER REQUEST: {email_request}"

    # Send request (reuse context_id to keep memory of Mette)
    ctx_id, email_reply = send_message_to_ally(
        client, agent_id, full_email_prompt, context_id=ctx_id
    )

    print(f"Ally Reply: {email_reply}")
    handle_agent_actions(email_reply)


if __name__ == "__main__":
    main()
