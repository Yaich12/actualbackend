# Welcome to Cloud Functions for Firebase for Python!
# To get started, simply uncomment the below code or create your own.
# Deploy with `firebase deploy`

import json
import logging
import os
from typing import Any, Dict

import requests
from openai import OpenAI
from firebase_admin import initialize_app
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

initialize_app()

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