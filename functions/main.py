# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`

import hashlib
import json
import logging
import os
import re
from datetime import datetime, timezone, timedelta, date
from typing import Any, Dict, List
from zoneinfo import ZoneInfo

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

PUBLIC_BOOKING_CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

BOOKING_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("BOOKING_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
BOOKING_ALLOW_ANY = os.getenv("BOOKING_CORS_ALLOW_ANY", "").lower() in ("1", "true", "yes")
LOVABLE_ORIGIN_RE = re.compile(r"^https://[a-z0-9-]+\.lovable\.app$")


def _cors_headers() -> Dict[str, str]:
    return dict(CORS_HEADERS)


def _public_booking_cors_headers() -> Dict[str, str]:
    return dict(PUBLIC_BOOKING_CORS_HEADERS)


def _public_booking_log(req: https_fn.Request, status: int) -> None:
    origin = req.headers.get("Origin")
    logger.info(
        "public booking response: method=%s origin=%s status=%s",
        req.method,
        origin,
        status,
    )


def _public_booking_json_response(
    req: https_fn.Request, payload: Dict[str, Any], status: int
) -> https_fn.Response:
    _public_booking_log(req, status)
    return https_fn.Response(
        json.dumps(payload),
        status=status,
        headers=_public_booking_cors_headers(),
        content_type="application/json",
    )


def _public_booking_error(
    req: https_fn.Request,
    message: str,
    status: int,
    missing: List[str] | None = None,
) -> https_fn.Response:
    if missing:
        logger.warning("public booking validation error: missing=%s", missing)
    else:
        logger.warning("public booking error: %s", message)
    payload: Dict[str, Any] = {"error": message}
    if missing is not None:
        payload["missing"] = missing
    return _public_booking_json_response(req, payload, status)


def _public_booking_empty_response(req: https_fn.Request, status: int) -> https_fn.Response:
    _public_booking_log(req, status)
    return https_fn.Response("", status=status, headers=_public_booking_cors_headers())


def _parse_request_json(req: https_fn.Request) -> Dict[str, Any] | None:
    data = req.get_json(silent=True)
    if data is None:
        raw = req.data
        if raw:
            try:
                if isinstance(raw, (bytes, bytearray)):
                    raw = raw.decode("utf-8")
                data = json.loads(raw)
            except Exception:
                return None
        else:
            data = {}
    if not isinstance(data, dict):
        return None
    return data


def _parse_iso_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    if raw.endswith("Z"):
        raw = raw.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(raw)
    except Exception:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed


def _to_utc_iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _parse_date_iso(date_iso: str) -> date | None:
    if not date_iso:
        return None
    parts = str(date_iso).strip().split("-")
    if len(parts) != 3:
        return None
    try:
        year, month, day = (int(p) for p in parts)
    except Exception:
        return None
    if not (1 <= month <= 12 and 1 <= day <= 31):
        return None
    try:
        return date(year, month, day)
    except Exception:
        return None


def _parse_time_minutes(value: str | None) -> int | None:
    if not value:
        return None
    parts = str(value).strip().split(":")
    if len(parts) != 2:
        return None
    try:
        hours = int(parts[0])
        minutes = int(parts[1])
    except Exception:
        return None
    if not (0 <= hours <= 23 and 0 <= minutes <= 59):
        return None
    return hours * 60 + minutes


def _parse_duration_minutes(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        minutes = int(value)
        return minutes if minutes > 0 else None
    if not isinstance(value, str):
        return None
    text = value.strip().lower()
    if not text:
        return None
    total = 0
    hours_match = re.search(r"(\d+)\s*(t|time|timer|hour|hours|hr|h)\b", text)
    if hours_match:
        total += int(hours_match.group(1)) * 60
    minutes_match = re.search(r"(\d+)\s*(min|minute|minutter|m)\b", text)
    if minutes_match:
        total += int(minutes_match.group(1))
    if total > 0:
        return total
    numeric = re.search(r"(\d+)", text)
    if numeric:
        minutes = int(numeric.group(1))
        return minutes if minutes > 0 else None
    return None


def _parse_duration_minutes_or_default(
    value: Any, default_minutes: int = 60, context: str | None = None
) -> int:
    parsed = _parse_duration_minutes(value)
    if parsed is None:
        if context:
            logger.warning(
                "Duration parse failed; defaulting to %s minutes (context=%s)",
                default_minutes,
                context,
            )
        else:
            logger.warning(
                "Duration parse failed; defaulting to %s minutes",
                default_minutes,
            )
        return default_minutes
    return parsed


def _default_working_hours() -> Dict[str, List[Dict[str, str]]]:
    return {
        "mon": [{"start": "09:00", "end": "16:00"}],
        "tue": [{"start": "09:00", "end": "16:00"}],
        "wed": [{"start": "09:00", "end": "16:00"}],
        "thu": [{"start": "09:00", "end": "16:00"}],
        "fri": [{"start": "09:00", "end": "16:00"}],
        "sat": [],
        "sun": [],
    }


def _resolve_working_hours(
    clinic_data: Dict[str, Any],
    owner_data: Dict[str, Any],
    staff_data: Dict[str, Any],
) -> Dict[str, List[Dict[str, str]]]:
    working_hours = staff_data.get("workingHours")
    if isinstance(working_hours, dict):
        return working_hours
    working_hours = clinic_data.get("workingHours")
    if isinstance(working_hours, dict):
        return working_hours
    working_hours = owner_data.get("workingHours")
    if isinstance(working_hours, dict):
        return working_hours
    return _default_working_hours()


def _get_day_key(target_date: date) -> str:
    keys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
    return keys[target_date.weekday()]


def _get_day_windows(
    working_hours: Dict[str, Any], day_key: str
) -> List[Dict[str, str]]:
    windows = working_hours.get(day_key, [])
    return windows if isinstance(windows, list) else []


def _appointment_matches_staff(
    appointment: Dict[str, Any],
    staff_uid: str,
    staff_name: str,
    owner_uid: str,
) -> bool:
    if appointment.get("staffUid") == staff_uid:
        return True
    if appointment.get("calendarOwnerId") == staff_uid:
        return True
    if staff_name:
        appt_owner = appointment.get("calendarOwner") or appointment.get("ownerName") or ""
        if appt_owner and appt_owner.strip().lower() == staff_name.strip().lower():
            return True
    if staff_uid == owner_uid and not appointment.get("staffUid") and not appointment.get("calendarOwnerId"):
        return True
    return False


def _resolve_booking_origin(origin: str | None) -> str:
    if BOOKING_ALLOW_ANY:
        return "*"
    if not origin:
        return ""
    if LOVABLE_ORIGIN_RE.match(origin):
        return origin
    if origin in BOOKING_ALLOWED_ORIGINS:
        return origin
    if origin.startswith(("http://localhost", "http://127.0.0.1", "http://0.0.0.0", "http://[::1]")):
        return "*"
    return ""


def _booking_cors_headers(origin: str | None) -> Dict[str, str]:
    headers = {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
    }
    resolved = _resolve_booking_origin(origin)
    if resolved:
        headers["Access-Control-Allow-Origin"] = resolved
        headers["Vary"] = "Origin"
    return headers


def _booking_json_response(
    payload: Dict[str, Any], status: int, origin: str | None
) -> https_fn.Response:
    return https_fn.Response(
        json.dumps(payload),
        status=status,
        headers=_booking_cors_headers(origin),
        content_type="application/json",
    )


def _booking_error(message: str, status: int, origin: str | None) -> https_fn.Response:
    return _booking_json_response({"ok": False, "error": message}, status=status, origin=origin)


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


def _normalize_email(value: Any) -> str:
    if not value:
        return ""
    return str(value).strip().lower()


def _is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    return False


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


@https_fn.on_request()
def createClientFromBooking(req: https_fn.Request) -> https_fn.Response:
    logger.info("Incoming createClientFromBooking request: method=%s", req.method)

    origin = req.headers.get("Origin")

    if req.method == "OPTIONS":
        return https_fn.Response("", status=204, headers=_booking_cors_headers(origin))

    if req.method != "POST":
        return _booking_error("Only POST requests are supported.", status=405, origin=origin)

    data = req.get_json(silent=True) or {}
    clinic_slug = str(data.get("clinicSlug") or "").strip().lower()
    service_id = data.get("serviceId") or None
    start_iso = str(data.get("startIso") or "").strip()
    end_iso = str(data.get("endIso") or "").strip()
    first_name = str(data.get("firstName") or "").strip()
    last_name = str(data.get("lastName") or "").strip()
    email = str(data.get("email") or "").strip()
    email_lower = _normalize_email(email)
    phone = str(data.get("phone") or "").strip()
    notes = str(data.get("notes") or "").strip()
    privacy_accepted = data.get("privacyAccepted") is True
    marketing_opt_in = data.get("marketingOptIn") is True

    if not clinic_slug:
        return _booking_error("Missing clinicSlug.", status=400, origin=origin)

    if not start_iso or not end_iso:
        return _booking_error("Missing startIso or endIso.", status=400, origin=origin)

    if not first_name or not email_lower:
        return _booking_error("Missing firstName or email.", status=400, origin=origin)

    if not privacy_accepted:
        return _booking_error("Privacy acceptance required.", status=400, origin=origin)

    telefon_land = ""
    telefon_value = phone
    if phone.startswith("+"):
        parts = phone.split(maxsplit=1)
        telefon_land = parts[0]
        telefon_value = parts[1] if len(parts) > 1 else ""
    elif phone:
        telefon_land = "+45"
        telefon_value = phone
    telefon_komplet = phone or ""

    clinic_ref = get_db().collection("publicClinics").document(clinic_slug)
    clinic_snap = clinic_ref.get()
    if not clinic_snap.exists:
        return _booking_error("Clinic not found.", status=404, origin=origin)

    clinic_data = clinic_snap.to_dict() or {}
    if clinic_data.get("isActive") is not True:
        return _booking_error("Clinic not found.", status=404, origin=origin)

    owner_uid = clinic_data.get("ownerUid")
    if not owner_uid:
        return _booking_error("Clinic owner missing.", status=404, origin=origin)

    clients_ref = (
        get_db().collection("users").document(owner_uid).collection("clients")
    )

    existing_docs = list(
        clients_ref.where("emailLower", "==", email_lower).limit(1).stream()
    )

    full_name = f"{first_name} {last_name}".strip()
    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    if existing_docs:
        doc_snap = existing_docs[0]
        updates: Dict[str, Any] = {
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "fornavn": first_name,
            "email": email,
            "emailLower": email_lower,
        }

        if last_name:
            updates["efternavn"] = last_name
        if full_name:
            updates["navn"] = full_name
        if phone:
            updates["telefonKomplet"] = telefon_komplet
            updates["telefon"] = telefon_value or phone
            if telefon_land:
                updates["telefonLand"] = telefon_land

        doc_snap.reference.set(updates, merge=True)
        client_id = doc_snap.id
    else:
        payload = {
            "fornavn": first_name,
            "efternavn": last_name,
            "navn": full_name or first_name,
            "email": email,
            "emailLower": email_lower,
            "telefonLand": telefon_land or "+45",
            "telefon": telefon_value or phone,
            "telefonKomplet": telefon_komplet,
            "status": "Aktiv",
            "ownerUid": owner_uid,
            "source": "publicBooking",
            "clinicSlug": clinic_slug,
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
            "createdAtIso": now_iso,
        }
        client_ref = clients_ref.document()
        client_ref.set(payload)
        client_id = client_ref.id

    booking_payload = {
        "clinicSlug": clinic_slug,
        "clinicName": clinic_data.get("clinicName") or clinic_slug,
        "serviceId": service_id,
        "startIso": start_iso,
        "endIso": end_iso,
        "notes": notes,
        "clientId": client_id,
        "patient": {
            "firstName": first_name,
            "lastName": last_name,
            "email": email,
            "phone": phone,
        },
        "privacyAccepted": privacy_accepted,
        "marketingOptIn": marketing_opt_in,
        "createdAt": firestore.SERVER_TIMESTAMP,
    }

    booking_ref = (
        get_db()
        .collection("users")
        .document(owner_uid)
        .collection("bookingRequests")
        .document()
    )
    booking_ref.set(booking_payload)

    return _booking_json_response(
        {"ok": True, "clientId": client_id, "bookingId": booking_ref.id},
        status=200,
        origin=origin,
    )


@https_fn.on_request()
def publicBookAppointment(req: https_fn.Request) -> https_fn.Response:
    if req.method == "OPTIONS":
        return _public_booking_empty_response(req, status=204)

    if req.method != "POST":
        return _public_booking_error(req, "Only POST requests are supported.", status=405)

    data = _parse_request_json(req)
    if data is None:
        return _public_booking_error(req, "Invalid JSON.", status=400)

    clinic_slug = str(data.get("clinicSlug") or "").strip().lower()
    staff_uid = str(data.get("staffUid") or "").strip()
    first_name = str(data.get("firstName") or "").strip()
    last_name = str(data.get("lastName") or "").strip()
    email = str(data.get("email") or "").strip()
    email_lower = _normalize_email(email)
    service_id = str(data.get("serviceId") or "").strip()
    start_iso = str(data.get("startIso") or "").strip()
    end_iso = str(data.get("endIso") or "").strip()
    phone = str(data.get("phone") or "").strip()
    notes = str(data.get("notes") or "").strip()
    privacy_accepted = data.get("privacyAccepted") is True
    marketing_opt_in = data.get("marketingOptIn") is True

    missing = []
    if _is_blank(clinic_slug):
        missing.append("clinicSlug")
    if _is_blank(staff_uid):
        missing.append("staffUid")
    if _is_blank(first_name):
        missing.append("firstName")
    if _is_blank(last_name):
        missing.append("lastName")
    if _is_blank(email_lower):
        missing.append("email")
    if _is_blank(service_id):
        missing.append("serviceId")
    if _is_blank(start_iso):
        missing.append("startIso")
    if _is_blank(end_iso):
        missing.append("endIso")
    if _is_blank(phone):
        missing.append("phone")
    if not privacy_accepted:
        missing.append("privacyAccepted")

    if missing:
        logger.warning(
            "publicBookAppointment missing fields: %s clinicSlug=%s",
            missing,
            clinic_slug or "-",
        )
        return _public_booking_error(
            req,
            "Missing required fields",
            status=400,
            missing=missing,
        )

    clinic_ref = get_db().collection("publicClinics").document(clinic_slug)
    clinic_snap = clinic_ref.get()
    if not clinic_snap.exists:
        return _public_booking_error(req, "Clinic not found.", status=404)

    clinic_data = clinic_snap.to_dict() or {}
    if clinic_data.get("isActive") is not True:
        return _public_booking_error(req, "Clinic inactive.", status=403)

    owner_uid = clinic_data.get("ownerUid")
    if not owner_uid:
        return _public_booking_error(req, "Clinic owner missing.", status=404)

    full_name = f"{first_name} {last_name}".strip()

    start_dt = _parse_iso_datetime(start_iso)
    end_dt = _parse_iso_datetime(end_iso)
    if not start_dt or not end_dt:
        return _public_booking_error(req, "Invalid startIso/endIso.", status=400)
    if end_dt <= start_dt:
        return _public_booking_error(req, "Invalid time range.", status=400)

    timezone_name = clinic_data.get("timezone") or "Europe/Copenhagen"
    try:
        tzinfo = ZoneInfo(timezone_name)
    except Exception:
        tzinfo = timezone.utc
        timezone_name = "UTC"

    staff_doc = (
        get_db()
        .collection("users")
        .document(owner_uid)
        .collection("team")
        .document(staff_uid)
        .get()
    )
    staff_data = staff_doc.to_dict() if staff_doc.exists else {}
    staff_name = staff_data.get("name") or ""
    if not staff_name:
        staff_name = f"{staff_data.get('firstName') or ''} {staff_data.get('lastName') or ''}".strip()

    calendar_owner_id = staff_uid or owner_uid

    day_start = start_dt.astimezone(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    day_end = day_start + timedelta(days=1)

    appointments_ref = (
        get_db()
        .collection("users")
        .document(owner_uid)
        .collection("appointments")
    )
    overlapping_docs = appointments_ref.where("start", ">=", _to_utc_iso(day_start)).where(
        "start", "<", _to_utc_iso(day_end)
    ).stream()

    for doc in overlapping_docs:
        appt = doc.to_dict() or {}
        if not _appointment_matches_staff(appt, staff_uid, staff_name, owner_uid):
            continue
        appt_start = _parse_iso_datetime(appt.get("start") or appt.get("startIso"))
        appt_end = _parse_iso_datetime(appt.get("end") or appt.get("endIso"))
        if not appt_start or not appt_end:
            continue
        if start_dt < appt_end and end_dt > appt_start:
            return _public_booking_error(req, "Slot unavailable.", status=409)

    phone_digits = re.sub(r"\D", "", phone or "")
    if len(phone_digits) == 8:
        phone_norm = f"45{phone_digits}"
    elif phone_digits.startswith("0045"):
        phone_norm = phone_digits[2:]
    else:
        phone_norm = phone_digits

    telefon_land = ""
    telefon_value = phone
    if phone.startswith("+"):
        parts = phone.split(maxsplit=1)
        telefon_land = parts[0]
        telefon_value = parts[1] if len(parts) > 1 else ""
    elif phone_norm.startswith("45") and len(phone_norm) >= 10:
        telefon_land = "+45"
        telefon_value = phone_norm[2:]
    elif len(phone_digits) == 8:
        telefon_land = "+45"
        telefon_value = phone_digits

    telefon_komplet = phone or f"{telefon_land} {telefon_value}".strip()

    owner_profile = (
        get_db().collection("users").document(calendar_owner_id).get()
    )
    owner_data = owner_profile.to_dict() if owner_profile.exists else {}
    owner_email = owner_data.get("email") or owner_data.get("ownerEmail") or ""
    owner_name = (
        owner_data.get("displayName")
        or owner_data.get("fullName")
        or owner_data.get("name")
        or ""
    )
    owner_identifier_source = owner_name or owner_email or calendar_owner_id or "unknown-user"
    owner_identifier = re.sub(r"[^a-z0-9]+", "-", owner_identifier_source.lower()).strip("-")
    if not owner_identifier:
        owner_identifier = "unknown-user"

    client_upsert_action = "created"
    client_id = None
    clients_ref = (
        get_db().collection("users").document(calendar_owner_id).collection("clients")
    )
    existing_client = None
    if phone_norm:
        existing_client = list(
            clients_ref.where("phoneNorm", "==", phone_norm).limit(1).stream()
        )

    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    if existing_client:
        client_doc = existing_client[0]
        client_id = client_doc.id
        client_data = client_doc.to_dict() or {}
        updates: Dict[str, Any] = {
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        if _is_blank(client_data.get("email")) and email:
            updates["email"] = email
        if _is_blank(client_data.get("emailLower")) and email_lower:
            updates["emailLower"] = email_lower
        if _is_blank(client_data.get("navn")) and full_name:
            updates["navn"] = full_name
        if _is_blank(client_data.get("fornavn")) and first_name:
            updates["fornavn"] = first_name
        if _is_blank(client_data.get("efternavn")) and last_name:
            updates["efternavn"] = last_name
        if _is_blank(client_data.get("telefon")) and telefon_value:
            updates["telefon"] = telefon_value
        if _is_blank(client_data.get("telefonKomplet")) and telefon_komplet:
            updates["telefonKomplet"] = telefon_komplet
        if _is_blank(client_data.get("telefonLand")) and telefon_land:
            updates["telefonLand"] = telefon_land
        if phone_norm and client_data.get("phoneNorm") != phone_norm:
            updates["phoneNorm"] = phone_norm
        if _is_blank(client_data.get("ownerEmail")) and owner_email:
            updates["ownerEmail"] = owner_email
        if _is_blank(client_data.get("ownerIdentifier")) and owner_identifier:
            updates["ownerIdentifier"] = owner_identifier
        if len(updates) > 1:
            client_doc.reference.set(updates, merge=True)
        client_upsert_action = "found"
    else:
        client_payload = {
            "navn": full_name or first_name,
            "fornavn": first_name,
            "efternavn": last_name,
            "email": email,
            "emailLower": email_lower,
            "telefon": telefon_value or phone,
            "telefonLand": telefon_land or "+45",
            "telefonKomplet": telefon_komplet,
            "phoneNorm": phone_norm,
            "ownerUid": calendar_owner_id,
            "ownerEmail": owner_email,
            "ownerIdentifier": owner_identifier,
            "status": "Aktiv",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "createdAtIso": now_iso,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        }
        client_ref = clients_ref.document()
        client_ref.set(client_payload)
        client_id = client_ref.id

    logger.info(
        "publicBookAppointment clientUpsert=%s clinicSlug=%s calendarOwnerId=%s staffUid=%s serviceId=%s",
        client_upsert_action,
        clinic_slug,
        calendar_owner_id,
        staff_uid,
        service_id,
    )

    start_date_local = start_dt.astimezone(tzinfo)
    end_date_local = end_dt.astimezone(tzinfo)
    start_date = start_date_local.strftime("%d-%m-%Y")
    start_time = start_date_local.strftime("%H:%M")
    end_date = end_date_local.strftime("%d-%m-%Y")
    end_time = end_date_local.strftime("%H:%M")

    appointment_ref = appointments_ref.document()
    appointment_payload = {
        "clinicSlug": clinic_slug,
        "clinicName": clinic_data.get("clinicName") or clinic_slug,
        "ownerUid": owner_uid,
        "staffUid": staff_uid,
        "calendarOwnerId": staff_uid,
        "calendarOwner": staff_name or clinic_data.get("clinicName") or "Clinician",
        "title": full_name or service_id or "Booking",
        "client": full_name,
        "clientId": client_id,
        "clientEmail": email,
        "clientPhone": phone,
        "serviceId": service_id,
        "service": service_id,
        "serviceType": "service",
        "startIso": start_iso,
        "endIso": end_iso,
        "start": start_iso,
        "end": end_iso,
        "startDate": start_date,
        "startTime": start_time,
        "endDate": end_date,
        "endTime": end_time,
        "firstName": first_name,
        "lastName": last_name,
        "email": email,
        "phone": phone,
        "notes": notes,
        "privacyAccepted": privacy_accepted,
        "marketingOptIn": marketing_opt_in,
        "status": "requested",
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    appointment_ref.set(appointment_payload)

    return _public_booking_json_response(
        req,
        {"ok": True, "appointmentId": appointment_ref.id, "clientId": client_id},
        status=200,
    )


@https_fn.on_request()
def publicGetAvailability(req: https_fn.Request) -> https_fn.Response:
    if req.method == "OPTIONS":
        return _public_booking_empty_response(req, status=204)

    if req.method not in ("GET", "POST"):
        return _public_booking_error(req, "Only GET/POST requests are supported.", status=405)

    data = _parse_request_json(req) if req.method == "POST" else {}
    if data is None:
        return _public_booking_error(req, "Invalid JSON.", status=400)

    query_params = dict(req.args or {})
    clinic_slug = str(
        (query_params.get("clinicSlug") if query_params else None) or data.get("clinicSlug") or ""
    ).strip().lower()
    staff_uid = str(
        (query_params.get("staffUid") if query_params else None) or data.get("staffUid") or ""
    ).strip()
    date_iso = str(
        (query_params.get("dateIso") if query_params else None) or data.get("dateIso") or ""
    ).strip()
    service_id = str(
        (query_params.get("serviceId") if query_params else None) or data.get("serviceId") or ""
    ).strip()

    logger.info(
        "publicGetAvailability params: %s",
        {
            "clinicSlug": clinic_slug,
            "staffUid": staff_uid,
            "dateIso": date_iso,
            "serviceId": service_id,
            "method": req.method,
        },
    )

    missing = []
    if _is_blank(clinic_slug):
        missing.append("clinicSlug")
    if _is_blank(staff_uid):
        missing.append("staffUid")
    if _is_blank(date_iso):
        missing.append("dateIso")
    if _is_blank(service_id):
        missing.append("serviceId")
    if missing:
        return _public_booking_error(
            req,
            "Missing required fields",
            status=400,
            missing=missing,
        )

    clinic_ref = get_db().collection("publicClinics").document(clinic_slug)
    clinic_snap = clinic_ref.get()
    if not clinic_snap.exists:
        return _public_booking_error(req, "Clinic not found.", status=404)

    clinic_data = clinic_snap.to_dict() or {}
    if clinic_data.get("isActive") is not True:
        return _public_booking_error(req, "Clinic inactive.", status=403)

    owner_uid = clinic_data.get("ownerUid")
    if not owner_uid:
        return _public_booking_error(req, "Clinic owner missing.", status=404)

    timezone_name = clinic_data.get("timezone") or "Europe/Copenhagen"
    try:
        tzinfo = ZoneInfo(timezone_name)
    except Exception:
        tzinfo = timezone.utc
        timezone_name = "UTC"

    normalized_date_iso = date_iso.replace("Z", "+00:00")
    parsed_date = _parse_date_iso(date_iso)
    if not parsed_date:
        parsed_dt = _parse_iso_datetime(normalized_date_iso)
        if parsed_dt:
            parsed_date = parsed_dt.astimezone(tzinfo).date()
    if not parsed_date:
        return _public_booking_error(
            req,
            "Invalid dateIso. Use YYYY-MM-DD or ISO timestamp.",
            status=400,
        )

    slot_minutes = clinic_data.get("slotMinutes")
    try:
        slot_minutes = int(slot_minutes)
    except Exception:
        slot_minutes = 15
    if slot_minutes <= 0:
        slot_minutes = 15

    service_ref = (
        get_db()
        .collection("users")
        .document(owner_uid)
        .collection("services")
        .document(service_id)
    )
    service_snap = service_ref.get()
    if not service_snap.exists:
        return _public_booking_error(
            req,
            "Unknown serviceId.",
            status=400,
        )
    service_data = service_snap.to_dict() or {}
    service_minutes = _parse_duration_minutes_or_default(
        service_data.get("duration") or service_data.get("varighed"),
        default_minutes=60,
        context=f"serviceId:{service_id}",
    )

    staff_doc = (
        get_db()
        .collection("users")
        .document(owner_uid)
        .collection("team")
        .document(staff_uid)
        .get()
    )
    staff_data = staff_doc.to_dict() if staff_doc.exists else {}

    owner_doc = get_db().collection("users").document(owner_uid).get()
    owner_data = owner_doc.to_dict() if owner_doc.exists else {}

    working_hours = _resolve_working_hours(clinic_data, owner_data, staff_data)
    day_key = _get_day_key(parsed_date)
    windows = _get_day_windows(working_hours, day_key)

    day_start_local = datetime(
        parsed_date.year,
        parsed_date.month,
        parsed_date.day,
        0,
        0,
        tzinfo=tzinfo,
    )
    day_end_local = day_start_local + timedelta(days=1)
    day_start_iso = _to_utc_iso(day_start_local)
    day_end_iso = _to_utc_iso(day_end_local)

    staff_name = staff_data.get("name") or ""
    if not staff_name:
        first = staff_data.get("firstName") or ""
        last = staff_data.get("lastName") or ""
        staff_name = f"{first} {last}".strip()

    appointments_ref = (
        get_db()
        .collection("users")
        .document(owner_uid)
        .collection("appointments")
    )
    appointment_docs = appointments_ref.where("start", ">=", day_start_iso).where(
        "start", "<", day_end_iso
    ).stream()

    busy_ranges = []
    for doc in appointment_docs:
        appt = doc.to_dict() or {}
        if not _appointment_matches_staff(appt, staff_uid, staff_name, owner_uid):
            continue
        appt_start = _parse_iso_datetime(appt.get("start") or appt.get("startIso"))
        appt_end = _parse_iso_datetime(appt.get("end") or appt.get("endIso"))
        if not appt_start or not appt_end:
            continue
        busy_ranges.append((appt_start, appt_end))

    slots = []
    for window in windows:
        start_minutes = _parse_time_minutes(window.get("start"))
        end_minutes = _parse_time_minutes(window.get("end"))
        if start_minutes is None or end_minutes is None:
            continue
        if end_minutes <= start_minutes:
            continue
        slot_start_minutes = start_minutes
        while slot_start_minutes + service_minutes <= end_minutes:
            slot_start_local = day_start_local + timedelta(minutes=slot_start_minutes)
            slot_end_local = slot_start_local + timedelta(minutes=service_minutes)
            slot_start = slot_start_local.astimezone(timezone.utc)
            slot_end = slot_end_local.astimezone(timezone.utc)
            overlaps = False
            for busy_start, busy_end in busy_ranges:
                if slot_start < busy_end and slot_end > busy_start:
                    overlaps = True
                    break
            if not overlaps:
                slots.append(
                    {
                        "startIso": _to_utc_iso(slot_start_local),
                        "endIso": _to_utc_iso(slot_end_local),
                    }
                )
            slot_start_minutes += slot_minutes

    return _public_booking_json_response(
        req,
        {
            "slots": slots,
            "timezone": timezone_name,
            "slotMinutes": slot_minutes,
            "serviceMinutes": service_minutes,
        },
        status=200,
    )


@https_fn.on_request()
def getClinicStaffPublic(req: https_fn.Request) -> https_fn.Response:
    if req.method == "OPTIONS":
        return _public_booking_empty_response(req, status=204)

    if req.method not in ("GET", "POST"):
        return _public_booking_error(req, "Only GET/POST requests are supported.", status=405)

    data = _parse_request_json(req) if req.method == "POST" else {}
    if data is None:
        return _public_booking_error(req, "Invalid JSON.", status=400)

    clinic_slug = (
        str((req.args.get("clinicSlug") if req.args else None) or data.get("clinicSlug") or "")
        .strip()
        .lower()
    )
    if _is_blank(clinic_slug):
        return _public_booking_error(
            req,
            "Missing required fields",
            status=400,
            missing=["clinicSlug"],
        )

    clinic_ref = get_db().collection("publicClinics").document(clinic_slug)
    clinic_snap = clinic_ref.get()
    if not clinic_snap.exists:
        return _public_booking_error(req, "Clinic not found.", status=404)

    clinic_data = clinic_snap.to_dict() or {}
    if clinic_data.get("isActive") is not True:
        return _public_booking_error(req, "Clinic inactive.", status=403)

    owner_uid = clinic_data.get("ownerUid")
    if not owner_uid:
        return _public_booking_error(req, "Clinic owner missing.", status=404)

    team_docs = (
        get_db()
        .collection("users")
        .document(owner_uid)
        .collection("team")
        .stream()
    )
    staff = []
    for doc in team_docs:
        member = doc.to_dict() or {}
        staff.append(
            {
                "id": doc.id,
                "name": member.get("name") or "",
                "firstName": member.get("firstName") or "",
                "lastName": member.get("lastName") or "",
                "role": member.get("role") or "",
                "avatarText": member.get("avatarText") or "",
                "calendarColor": member.get("calendarColor") or "",
            }
        )

    if not staff:
        owner_doc = get_db().collection("users").document(owner_uid).get()
        owner_data = owner_doc.to_dict() if owner_doc.exists else {}
        fallback_name = (
            owner_data.get("displayName")
            or owner_data.get("navn")
            or owner_data.get("name")
            or clinic_data.get("clinicName")
            or "Clinician"
        )
        staff = [
            {
                "id": owner_uid,
                "name": fallback_name,
                "firstName": owner_data.get("fornavn") or "",
                "lastName": owner_data.get("efternavn") or "",
                "role": "owner",
                "avatarText": owner_data.get("avatarText") or "",
                "calendarColor": owner_data.get("calendarColor") or "",
            }
        ]

    return _public_booking_json_response(
        req,
        {
            "ok": True,
            "clinicSlug": clinic_slug,
            "clinicName": clinic_data.get("clinicName") or clinic_slug,
            "staff": staff,
        },
        status=200,
    )


@https_fn.on_request()
def getClinicServicesPublic(req: https_fn.Request) -> https_fn.Response:
    if req.method == "OPTIONS":
        return _public_booking_empty_response(req, status=204)

    if req.method not in ("GET", "POST"):
        return _public_booking_error(req, "Only GET/POST requests are supported.", status=405)

    data = _parse_request_json(req) if req.method == "POST" else {}
    if data is None:
        return _public_booking_error(req, "Invalid JSON.", status=400)

    query_params = dict(req.args or {})
    clinic_slug = str(
        (query_params.get("clinicSlug") if query_params else None)
        or (query_params.get("slug") if query_params else None)
        or data.get("clinicSlug")
        or data.get("slug")
        or ""
    ).strip().lower()

    if _is_blank(clinic_slug):
        return _public_booking_error(
            req,
            "Missing required field: clinicSlug",
            status=400,
        )

    clinic_ref = get_db().collection("publicClinics").document(clinic_slug)
    clinic_snap = clinic_ref.get()
    if not clinic_snap.exists:
        return _public_booking_error(req, "Clinic not found", status=404)

    clinic_data = clinic_snap.to_dict() or {}
    if clinic_data.get("isActive") is False:
        return _public_booking_error(req, "Clinic is not active", status=403)

    owner_uid = clinic_data.get("ownerUid")
    if not owner_uid:
        return _public_booking_error(req, "publicClinics is missing ownerUid", status=500)

    service_docs = (
        get_db()
        .collection("users")
        .document(owner_uid)
        .collection("services")
        .stream()
    )
    services = []
    for doc in service_docs:
        data = doc.to_dict() or {}
        name = (data.get("name") or data.get("navn") or "").strip()
        if not name:
            continue
        description = data.get("description") or data.get("beskrivelse") or ""
        duration_raw = data.get("duration") or data.get("varighed")
        duration_minutes = _parse_duration_minutes(duration_raw)
        price = data.get("price") if isinstance(data.get("price"), (int, float)) else data.get("pris")
        if isinstance(price, bool):
            price = None
        price_incl_vat = (
            data.get("priceInclVat")
            if isinstance(data.get("priceInclVat"), (int, float))
            else data.get("prisInklMoms")
        )
        if isinstance(price_incl_vat, bool):
            price_incl_vat = None
        include_vat = data.get("includeVat")
        if include_vat is None and price is not None and price_incl_vat is not None:
            include_vat = price_incl_vat != price
        if include_vat is None:
            include_vat = False
        services.append(
            {
                "id": doc.id,
                "name": name,
                "description": description,
                "durationMinutes": duration_minutes,
                "price": price,
                "currency": data.get("currency") or "DKK",
                "color": data.get("color") or None,
                "includeVat": bool(include_vat),
                "priceInclVat": price_incl_vat if price_incl_vat is not None else price,
            }
        )

    logger.info("getClinicServicesPublic clinicSlug=%s services=%s", clinic_slug, len(services))

    return _public_booking_json_response(req, {"services": services}, status=200)


@https_fn.on_request()
def publicGetServices(req: https_fn.Request) -> https_fn.Response:
    if req.method == "OPTIONS":
        return _public_booking_empty_response(req, status=204)

    if req.method not in ("GET", "POST"):
        return _public_booking_error(req, "Only GET/POST requests are supported.", status=405)

    data = _parse_request_json(req) if req.method == "POST" else {}
    if data is None:
        return _public_booking_error(req, "Invalid JSON.", status=400)

    query_params = dict(req.args or {})
    clinic_slug = str(
        (query_params.get("clinicSlug") if query_params else None)
        or data.get("clinicSlug")
        or ""
    ).strip().lower()

    if _is_blank(clinic_slug):
        return _public_booking_error(
            req,
            "Missing required field: clinicSlug",
            status=400,
        )

    clinic_ref = get_db().collection("publicClinics").document(clinic_slug)
    clinic_snap = clinic_ref.get()
    if not clinic_snap.exists:
        return _public_booking_error(req, "Clinic not found", status=404)

    clinic_data = clinic_snap.to_dict() or {}
    if clinic_data.get("isActive") is False:
        return _public_booking_error(req, "Clinic is not active", status=403)

    owner_uid = clinic_data.get("ownerUid")
    if not owner_uid:
        return _public_booking_error(req, "publicClinics is missing ownerUid", status=500)

    service_docs = (
        get_db()
        .collection("users")
        .document(owner_uid)
        .collection("services")
        .stream()
    )

    services = []
    for doc in service_docs:
        data = doc.to_dict() or {}
        name = (data.get("name") or data.get("navn") or "").strip()
        if not name:
            continue
        description = data.get("description") or data.get("beskrivelse") or ""
        duration_raw = data.get("duration") or data.get("varighed")
        duration_minutes = _parse_duration_minutes_or_default(
            duration_raw,
            default_minutes=60,
            context=f"serviceId:{doc.id}",
        )
        price = data.get("price") if isinstance(data.get("price"), (int, float)) else data.get("pris")
        if isinstance(price, bool):
            price = None
        price_incl_vat = (
            data.get("priceInclVat")
            if isinstance(data.get("priceInclVat"), (int, float))
            else data.get("prisInklMoms")
        )
        if isinstance(price_incl_vat, bool):
            price_incl_vat = None
        include_vat = data.get("includeVat")
        if include_vat is None and price is not None and price_incl_vat is not None:
            include_vat = price_incl_vat != price
        if include_vat is None:
            include_vat = False

        services.append(
            {
                "id": doc.id,
                "name": name,
                "description": description,
                "durationMinutes": duration_minutes,
                "price": price,
                "currency": data.get("currency") or "DKK",
                "includeVat": include_vat,
                "priceInclVat": price_incl_vat if price_incl_vat is not None else price,
                "color": data.get("color") or None,
            }
        )

    logger.info("publicGetServices clinicSlug=%s services=%s", clinic_slug, len(services))

    return _public_booking_json_response(req, {"services": services}, status=200)
