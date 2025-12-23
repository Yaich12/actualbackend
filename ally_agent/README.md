# Ally Corti Agent (Python)

Virtual environment setup:
python3 -m venv .venv
source .venv/bin/activate

Install dependencies:
pip install -r requirements.txt

Configure environment:
- Update .env with your CORTI_API_KEY, CORTI_TENANT, and CORTI_API_URL.

Run a quick connection test:
python main.py

Notes:
- main.py uses requests for API calls.
- a2a-python is included in requirements.txt if you want to switch to the SDK later.
