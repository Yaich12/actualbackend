# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`

import json
import logging
import os
from typing import Any, Dict, List

import firebase_admin
import requests
from openai import OpenAI
from firebase_admin import auth, firestore
from firebase_functions import https_fn
from firebase_functions.options import set_global_options
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure logging for clearer Cloud Functions console output.
logger = logging.getLogger(__name__)
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)

# For cost control, you can set the maximum number of containers that can be
# running at the same time. This helps mitigate the impact of unexpected
# traffic spikes by instead downgrading performance. This limit is a per-function
# limit. You can override the limit for each function using the max_instances
# parameter in the decorator, e.g. @https_fn.on_request(max_instances=5).
set_global_options(max_instances=10)

# Lazy init, but always initialize when first used
firebase_app = None
db = None


def ensure_firebase_app():
    """Ensure Firebase app is initialized at first use."""
    global firebase_app
    if firebase_app is not None:
        return firebase_app
    try:
        firebase_app = firebase_admin.get_app()
    except ValueError:
        firebase_app = firebase_admin.initialize_app()
    return firebase_app


def get_db():
    """Get Firestore client lazily."""
    global db
    if db is not None:
        return db
    app = ensure_firebase_app()
    # This project uses a non-default Firestore database id (see firebase.json).
    database_id = os.getenv("FIRESTORE_DATABASE_ID", "actuelbackend12")
    db = firestore.client(database_id=database_id, app=app)
    return db

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_TRANSCRIBE_URL = "https://api.openai.com/v1/audio/transcriptions"
DEFAULT_TRANSCRIBE_MODEL = os.getenv("OPENAI_TRANSCRIBE_MODEL", "gpt-4o-mini-transcribe")
REQUEST_TIMEOUT_SECONDS = 60

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
}


def _cors_headers() -> Dict[str, str]:
    return dict(CORS_HEADERS)


def _json_response(payload: Dict[str, Any], status: int) -> https_fn.Response:
    return https_fn.Response(
        json.dumps(payload),
        status=status,
        headers=_cors_headers(),
        content_type="application/json",
    )


def _error(message: str, status: int) -> https_fn.Response:
    return _json_response({"error": message}, status=status)


def _parse_bearer_token(req: https_fn.Request) -> str | None:
    auth_header = req.headers.get("Authorization", "") or ""
    if auth_header.startswith("Bearer "):
        return auth_header[len("Bearer ") :].strip()
    return None


def _pad2(n: int) -> str:
    return str(int(n)).zfill(2)


def _format_date_ddmmyyyy(d) -> str:
    return f"{_pad2(d.day)}-{_pad2(d.month)}-{d.year}"


def _format_time_hhmm(d) -> str:
    return f"{_pad2(d.hour)}:{_pad2(d.minute)}"


def _safe_int(value: Any, default: int) -> int:
    try:
        return int(value)
    except Exception:
        return default


def _now_ms() -> int:
    return int(__import__("time").time() * 1000)


def _agent_instructions(agent_id: str) -> str | None:
    agent_id = (agent_id or "").strip()
    if agent_id == "reasoner":
        return (
            "Du er fysioterapeutisk ræsonneringsassistent. "
            "Historikken kan indeholde input/svar fra andre agenter; brug det som kontekst, men hold dig til din rolle. "
            "Svar kort og konkret med: hypoteser, tests, red flags og næste skridt."
        )
    if agent_id == "guidelines":
        return (
            "Du er evidens- og guideline-assistent. "
            "Historikken kan indeholde svar fra andre agenter; brug det som kontekst, men hold dig til din rolle. "
            "Hvis info mangler: skriv hvilke data du mangler og foreslå hvad der skal afklares."
        )
    if agent_id == "planner":
        return (
            "Du er forløbsplanlægger. "
            "Historikken kan indeholde svar fra andre agenter; brug det som kontekst, men hold dig til din rolle. "
            "Hvis brugeren beder om 'dagens træning', lav en konkret plan for i dag: varighed, øvelser, sæt/reps, tempo, pause, progression og stop-kriterier."
        )
    return None


@https_fn.on_request()
def transcribe_audio(req: https_fn.Request) -> https_fn.Response:
    logger.info(
        "Incoming transcription request: method=%s content_type=%s",
        req.method,
        req.content_type,
    )

    if req.method == "OPTIONS":
        return https_fn.Response(
            "",
            status=204,
            headers=_cors_headers(),
        )

    if req.method != "POST":
        return _error("Only POST requests are supported.", status=405)

    if not OPENAI_API_KEY:
        return _error("OPENAI_API_KEY is not configured.", status=500)

    if not req.content_type or "multipart/form-data" not in req.content_type:
        return _error("Content-Type must be multipart/form-data.", status=400)

    file_storage = req.files.get("file") if req.files else None
    if not file_storage:
        return _error("Missing audio file in 'file' field.", status=400)

    logger.info(
        "Audio file received: name=%s mimetype=%s",
        file_storage.filename,
        file_storage.mimetype,
    )

    file_storage.stream.seek(0)
    files = {
        "file": (
            file_storage.filename or "audio",
            file_storage.stream,
            file_storage.mimetype or "application/octet-stream",
        )
    }

    data: Dict[str, Any] = {
        "model": req.form.get("model") or DEFAULT_TRANSCRIBE_MODEL,
    }

    optional_string_fields = (
        "language",
        "prompt",
        "response_format",
    )
    for field in optional_string_fields:
        value = req.form.get(field)
        if value:
            data[field] = value

    temperature = req.form.get("temperature")
    if temperature:
        try:
            data["temperature"] = float(temperature)
        except ValueError:
            return _error("temperature must be a number between 0 and 1.", status=400)

    try:
        openai_response = requests.post(
            OPENAI_TRANSCRIBE_URL,
            headers={"Authorization": f"Bearer {OPENAI_API_KEY}"},
            data=data,
            files=files,
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        logger.exception("Failed to call OpenAI transcription endpoint.")
        return _error(f"Failed to reach OpenAI: {exc}", status=502)

    if not openai_response.ok:
        logger.warning(
            "OpenAI transcription failed: status=%s body=%s",
            openai_response.status_code,
            openai_response.text,
        )
        try:
            error_payload = openai_response.json()
        except ValueError:
            error_payload = {"message": openai_response.text}
        error_payload = {
            "error": "OpenAI transcription failed.",
            "details": error_payload,
        }
        return _json_response(error_payload, status=openai_response.status_code)

    response_headers = _cors_headers()
    response_headers["Content-Type"] = "application/json"

    logger.info(
        "OpenAI transcription succeeded: status=%s",
        openai_response.status_code,
    )

    return https_fn.Response(
        openai_response.text,
        status=openai_response.status_code,
        headers=response_headers,
        content_type="application/json",
    )


@https_fn.on_request()
def openai_completion(req: https_fn.Request) -> https_fn.Response:
    logger.info(
        "Incoming OpenAI completion request: method=%s",
        req.method,
    )

    if req.method == "OPTIONS":
        return https_fn.Response(
            "",
            status=204,
            headers=_cors_headers(),
        )

    if req.method != "POST":
        return _error("Only POST requests are supported.", status=405)

    try:
        request_data = req.get_json(silent=True)
        if not request_data:
            return _error("Request body must be valid JSON.", status=400)

        userprompt = request_data.get("userprompt")
        if not userprompt:
            return _error("Missing 'userprompt' in request body.", status=400)

        logger.info("Received userprompt: %s", userprompt)

        # Initialize OpenAI client with API key from environment
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            logger.error("OPENAI_API_KEY is not set in environment variables.")
            return _error("Server configuration error: Missing API key.", status=500)

        client = OpenAI(api_key=api_key)

        # Create completion using chat completions API
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # Using a valid model name
            messages=[
                {"role": "user", "content": userprompt}
            ]
        )

        # Extract the message content
        message_output = response.choices[0].message.content

        # Print to console log
        logger.info("OpenAI completion output: %s", message_output)
        print(f"OpenAI completion output: {message_output}")

        return _json_response(
            {
                "output": message_output,
                "message": response.choices[0].message.model_dump()
            },
            status=200,
        )

    except Exception as exc:
        logger.exception("Failed to process OpenAI completion request.")
        return _error(f"Failed to process request: {exc}", status=500)


def _format_entry_for_prompt(entry: Dict[str, Any]) -> str:
    """Convert a journal entry dict to a short string for the prompt."""
    title = entry.get("title") or "Ingen titel"
    date_val = entry.get("date")
    created_at = entry.get("createdAt")

    date_str = ""
    if hasattr(date_val, "isoformat"):
        date_str = date_val.isoformat()
    elif isinstance(date_val, str):
        date_str = date_val

    if not date_str and hasattr(created_at, "isoformat"):
        date_str = created_at.isoformat()
    elif not date_str and isinstance(created_at, str):
        date_str = created_at

    content = entry.get("content") or entry.get("text") or ""
    return f"Dato: {date_str or 'ukendt'}\nTitel: {title}\nNotat: {content}"


@https_fn.on_request()
def summarize_journal(req: https_fn.Request) -> https_fn.Response:
    logger.info("Incoming summarize_journal request: method=%s", req.method)

    if req.method == "OPTIONS":
        return https_fn.Response("", status=204, headers=_cors_headers())

    if req.method != "POST":
        return _error("Only POST requests are supported.", status=405)

    if not OPENAI_API_KEY:
        return _error("OPENAI_API_KEY is not configured.", status=500)

    try:
        # Ensure Firebase Admin SDK is initialized before using auth/firestore.
        ensure_firebase_app()

        auth_header = req.headers.get("Authorization", "")
        id_token = (
            auth_header[len("Bearer "):].strip()
            if auth_header.startswith("Bearer ")
            else None
        )
        if not id_token:
            return _error("Missing auth token.", status=401)

        decoded = auth.verify_id_token(id_token)
        user_id = decoded.get("uid")
        if not user_id:
            return _error("Invalid auth token.", status=401)

        data = req.get_json(silent=True) or {}
        client_id = data.get("clientId")
        if not client_id:
            return _error("Missing clientId.", status=400)

        entries_ref = (
            get_db()
            .collection("users")
            .document(user_id)
            .collection("clients")
            .document(client_id)
            .collection("journalEntries")
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
            .limit(10)
        )
        docs = list(entries_ref.stream())

        if not docs:
            return _json_response(
                {"summary": "Der er endnu ingen journalindlæg for denne klient."},
                status=200,
            )

        # Oldest to newest for readable chronology
        parsed_entries: List[Dict[str, Any]] = [doc.to_dict() for doc in reversed(docs)]
        notes = [_format_entry_for_prompt(entry) for entry in parsed_entries]
        journal_text = "\n\n".join(notes)

        prompt = f"""
Du er en erfaren fysioterapeut.
Du får en række journalnoter for én patient. Lav en kort opsummering på DANSK til fysioterapeuten, som skal se patienten nu.
Strukturér svaret sådan:
1) Kort overblik
2) Nuværende problem og baggrund
3) Forløb indtil nu (vigtige ændringer/progression)
4) Hjemmeøvelser og adherence (hvis beskrevet)
5) Vigtige opmærksomhedspunkter (røde flag, psykosociale forhold, kontraindikationer)
Skriv i korte punkter, ingen patient-identificerbare detaljer ud over det, der står.

Journalnoter:
{journal_text}
        """.strip()

        client = OpenAI(api_key=OPENAI_API_KEY)
        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.3,
        )

        summary = (
            completion.choices[0].message.content
            if completion.choices and completion.choices[0].message
            else None
        )

        if not summary:
            summary = "Kunne ikke generere opsummering."

        return _json_response({"summary": summary}, status=200)

    except Exception as exc:
        logger.exception("summarize_journal error")
        return _error(f"Internal error: {exc}", status=500)


@https_fn.on_request()
def suggest_next_appointment(req: https_fn.Request) -> https_fn.Response:
    logger.info("Incoming suggest_next_appointment request: method=%s", req.method)

    if req.method == "OPTIONS":
        return https_fn.Response("", status=204, headers=_cors_headers())

    if req.method != "POST":
        return _error("Only POST requests are supported.", status=405)

    if not OPENAI_API_KEY:
        return _error("OPENAI_API_KEY is not configured.", status=500)

    try:
        # Ensure Firebase Admin SDK is initialized before using auth/firestore.
        ensure_firebase_app()

        id_token = _parse_bearer_token(req)
        if not id_token:
            return _error("Missing auth token.", status=401)

        decoded = auth.verify_id_token(id_token)
        user_id = decoded.get("uid")
        if not user_id:
            return _error("Invalid auth token.", status=401)

        data = req.get_json(silent=True) or {}
        client_id = data.get("clientId")
        last_appointment_iso = data.get("lastAppointmentIso")
        diagnosis = data.get("diagnosis") or "Ukendt diagnose"
        session_count = data.get("sessionCount")
        journal_summary = data.get("journalSummary")
        duration_minutes = _safe_int(data.get("durationMinutes"), 60)

        if not client_id or not last_appointment_iso:
            return _error("Missing clientId or lastAppointmentIso.", status=400)

        try:
            last_dt = __import__("datetime").datetime.fromisoformat(
                str(last_appointment_iso).replace("Z", "+00:00")
            )
        except Exception:
            return _error("Invalid lastAppointmentIso.", status=400)

        system_prompt = """
Du er en erfaren fysioterapeut, der hjælper med at planlægge næste kontroltid.

Du skal foreslå, hvor mange dage der bør gå til næste aftale ud fra:
- diagnose/tilstand,
- hvor i forløbet patienten er,
- og kort udvikling i symptomer (hvis det er beskrevet).

Retningslinjer (generelle, ikke juridisk bindende):
- Akutte og ustabile tilstande (fx nylig traume, udtalte smerter, nylig operation): ofte 1–3 dage.
- Subakutte tilstande: 3–7 dage.
- Stabile/kroniske tilstande med god egenmestring: 7–21 dage.
- Hvis der er røde flag / forværring, så anbefal tid meget hurtigt og nævn at lægekontakt kan være relevant.

Svar KUN i JSON med felterne:
{
  "recommendedIntervalDays": number,
  "clinicalRationale": string,
  "safetyNote": string
}
        """.strip()

        user_content = {
            "clientId": client_id,
            "diagnosis": diagnosis,
            "lastAppointmentIso": str(last_appointment_iso),
            "sessionCount": session_count,
            "journalSummary": journal_summary,
        }

        client = OpenAI(api_key=OPENAI_API_KEY)
        completion = client.chat.completions.create(
            model=os.getenv("OPENAI_SUGGEST_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": json.dumps(user_content, ensure_ascii=False)},
            ],
            temperature=0.3,
            response_format={"type": "json_object"},
        )

        raw = completion.choices[0].message.content if completion.choices else "{}"
        try:
            parsed = json.loads(raw or "{}")
        except Exception:
            parsed = {}

        interval_days = _safe_int(parsed.get("recommendedIntervalDays"), 7)
        if interval_days < 1:
            interval_days = 1
        if interval_days > 60:
            interval_days = 60

        rationale = str(parsed.get("clinicalRationale") or "").strip()
        safety_note = str(parsed.get("safetyNote") or "").strip()

        next_dt = last_dt + __import__("datetime").timedelta(days=interval_days)
        end_dt = next_dt + __import__("datetime").timedelta(minutes=duration_minutes)

        suggested = {
            "startDate": _format_date_ddmmyyyy(next_dt),
            "startTime": _format_time_hhmm(next_dt),
            "endDate": _format_date_ddmmyyyy(end_dt),
            "endTime": _format_time_hhmm(end_dt),
        }

        return _json_response(
            {
                "suggested": suggested,
                "rationale": rationale,
                "safetyNote": safety_note,
                "intervalDays": interval_days,
            },
            status=200,
        )
    except Exception as exc:
        logger.exception("suggest_next_appointment error")
        return _error("Intern fejl ved forslag af næste aftale.", status=500)


@https_fn.on_request()
def agent_chat(req: https_fn.Request) -> https_fn.Response:
    logger.info("Incoming agent_chat request: method=%s", req.method)

    if req.method == "OPTIONS":
        return https_fn.Response("", status=204, headers=_cors_headers())

    if req.method != "POST":
        return _error("Only POST requests are supported.", status=405)

    if not OPENAI_API_KEY:
        return _error("OPENAI_API_KEY is not configured.", status=500)

    try:
        ensure_firebase_app()

        id_token = _parse_bearer_token(req)
        if not id_token:
            return _error("Missing auth token.", status=401)

        decoded = auth.verify_id_token(id_token)
        uid = decoded.get("uid")
        if not uid:
            return _error("Invalid auth token.", status=401)

        payload = req.get_json(silent=True) or {}
        agent_id = str(payload.get("agentId") or "").strip()
        client_id = str(payload.get("clientId") or "").strip()
        message = str(payload.get("message") or "").strip()
        action_id = str(payload.get("actionId") or "").strip() or None
        draft_text = str(payload.get("draftText") or "").strip()

        instructions = _agent_instructions(agent_id)
        if not instructions:
            return _error("Unknown agentId.", status=400)
        if not client_id:
            return _error("Missing clientId.", status=400)
        if not action_id and not message:
            return _error("Missing message.", status=400)

        now_ms = _now_ms()
        now_iso = __import__("datetime").datetime.utcfromtimestamp(now_ms / 1000).isoformat() + "Z"

        db_client = get_db()

        messages_col = (
            db_client.collection("users")
            .document(uid)
            .collection("clients")
            .document(client_id)
            .collection("aiChats")
            .document("shared")
            .collection("messages")
        )

        # 1) Save user message if it's a chat (not pure action without text)
        if message:
            messages_col.document().set(
                {
                    "role": "user",
                    "text": message,
                    "agentId": agent_id,
                    "createdAtMs": now_ms,
                    "createdAtIso": now_iso,
                    "ownerUid": uid,
                }
            )

        # 2) Load shared history (last 30)
        history_snap = (
            messages_col.order_by("createdAtMs", direction=firestore.Query.DESCENDING)
            .limit(30)
            .stream()
        )
        history_docs = list(history_snap)
        history_items = [d.to_dict() for d in reversed(history_docs)]

        def fmt_history(m: Dict[str, Any]) -> str:
            role = m.get("role") or "unknown"
            a = m.get("agentId") or "unknown"
            who = "USER" if role == "user" else f"ASSISTANT({a})"
            txt = str(m.get("text") or "")
            if len(txt) > 1200:
                txt = txt[:1200] + "…"
            return f"{who}: {txt}"

        shared_history = "\n".join([fmt_history(m) for m in history_items])

        # 3) Client + recent journal (optional)
        client_doc = (
            db_client.collection("users").document(uid).collection("clients").document(client_id).get()
        )
        client_data = client_doc.to_dict() if client_doc and client_doc.exists else {}

        journal_snap = (
            db_client.collection("users")
            .document(uid)
            .collection("clients")
            .document(client_id)
            .collection("journalEntries")
            .order_by("createdAt", direction=firestore.Query.DESCENDING)
            .limit(3)
            .stream()
        )
        journal_docs = list(journal_snap)
        recent_notes = []
        for d in journal_docs:
            data = d.to_dict() or {}
            content = data.get("content") or data.get("text") or ""
            if content:
                recent_notes.append(str(content)[:900])

        recent_notes_text = "\n".join([f"- [{i+1}] {t}" for i, t in enumerate(recent_notes)])

        client_name = (
            client_data.get("navn")
            or client_data.get("name")
            or client_data.get("clientName")
            or "Ukendt"
        )

        context_parts = [
            f"ClientName: {client_name}",
            f"Today: {__import__('datetime').datetime.now().strftime('%d-%m-%Y')}",
        ]
        if client_data.get("goal"):
            context_parts.append(f"Goal: {client_data.get('goal')}")
        if recent_notes_text:
            context_parts.append(f"RecentJournal:\n{recent_notes_text}")
        if shared_history:
            context_parts.append(f"SharedHistory:\n{shared_history}")

        user_input = "\n\n".join(context_parts)

        client = OpenAI(api_key=OPENAI_API_KEY)

        # Helper: save assistant message
        def save_assistant(text: str, blocks: list[dict] | None = None):
            out_ms = _now_ms()
            out_iso = (
                __import__("datetime").datetime.utcfromtimestamp(out_ms / 1000).isoformat() + "Z"
            )
            payload_to_store = {
                "role": "assistant",
                "text": text,
                "agentId": agent_id,
                "createdAtMs": out_ms,
                "createdAtIso": out_iso,
                "ownerUid": uid,
            }
            if blocks:
                payload_to_store["blocks"] = blocks
            messages_col.document().set(payload_to_store)
            return payload_to_store

        # If actionId is present, run action-mode (return blocks)
        if action_id:
            action_prompt = f"""
Du er en fysioterapeutisk assistent. Du får et udkast til journal (draftText), patientkontekst og shared historik mellem agenter.
Du skal returnere JSON med:
{{
  "text": "kort svar til brugeren",
  "blocks": [
    {{"id": "block1", "title": "...", "text": "...", "defaultMode": "append"|"replace"}}
  ]
}}
Hvis du får actionId, så producer blocks der matcher actionId:
- journal_pack: 3 blocks (ræsonnering, plan/træning, guideline-check)
- soap: 1 block (SOAP-notat)
- missing: 1 block (Manglende data)
- redflags: 1 block (Safety/Røde flag)
- plan_check: 1 block (plan-review)
- dosage: 1 block (dosering/progression)
- patient_info: 1 block (kort patient-venlig tekst)
- today_training: 1 block (dagens træning)
- home_program: 1 block (hjemmeprogram + progression)
- next_appt: 1 block (næste aftale + begrundelse)

Feltet defaultMode skal være "append" som udgangspunkt; brug "replace" hvis block er et fuldt notat.
            """.strip()

            user_payload = {
                "actionId": action_id,
                "draftText": draft_text,
                "clientContext": user_input,
            }

            completion = client.chat.completions.create(
                model=os.getenv("OPENAI_AGENT_CHAT_MODEL", "gpt-4o-mini"),
                messages=[
                    {"role": "system", "content": instructions + "\n\n" + action_prompt},
                    {"role": "user", "content": json.dumps(user_payload, ensure_ascii=False)},
                ],
                temperature=0.2,
                response_format={"type": "json_object"},
            )

            raw = completion.choices[0].message.content if completion.choices else "{}"
            try:
                parsed = json.loads(raw or "{}")
            except Exception:
                parsed = {}

            text_out = str(parsed.get("text") or "").strip()
            blocks = parsed.get("blocks")
            valid_blocks = []
            if isinstance(blocks, list):
                for i, b in enumerate(blocks):
                    if not isinstance(b, dict):
                        continue
                    title = str(b.get("title") or "").strip() or f"Block {i+1}"
                    bt = str(b.get("text") or "").strip()
                    if not bt:
                        continue
                    mode = b.get("defaultMode") or "append"
                    if mode not in ("append", "replace"):
                        mode = "append"
                    valid_blocks.append(
                        {
                            "id": b.get("id") or f"block{i+1}",
                            "title": title,
                            "text": bt,
                            "defaultMode": mode,
                        }
                    )

            saved = save_assistant(text_out, valid_blocks if valid_blocks else None)
            return _json_response({"output_text": text_out, "blocks": saved.get("blocks")}, status=200)

        # Else: chat mode
        completion = client.chat.completions.create(
            model=os.getenv("OPENAI_AGENT_CHAT_MODEL", "gpt-4o-mini"),
            messages=[
                {"role": "system", "content": instructions},
                {"role": "user", "content": user_input},
            ],
            temperature=0.3,
        )
        output = completion.choices[0].message.content if completion.choices else ""
        output = output or ""

        save_assistant(output)
        return _json_response({"output_text": output}, status=200)
    except Exception:
        logger.exception("agent_chat failed")
        return _error("agent_chat failed", status=500)