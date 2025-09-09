import os
import warnings
import json
import urllib.parse
import re
from flask import Flask, request, jsonify, make_response
import requests
from dotenv import load_dotenv
from flask_cors import CORS
from http.cookies import SimpleCookie
from operator import itemgetter
from datetime import datetime

# ---- suppress HTTPS warnings for dev ----
warnings.simplefilter('ignore', requests.packages.urllib3.exceptions.InsecureRequestWarning)

load_dotenv()

app = Flask(__name__)
# Allow localhost frontend to send credentials (cookies)
CORS(app, origins=["http://127.0.0.1:5500"], supports_credentials=True)

GXWEB_USER = os.getenv("GXWEB_USER")
GXWEB_PASS = os.getenv("GXWEB_PASS")
GXWEB_URL  = os.getenv("GXWEB_URL")

# In-memory storage for demo (use Redis or DB in production)
backend_session_cookie = None
session = requests.Session()
session.verify = False

# Login to backend and store session cookie
@app.route("/login", methods=["POST"])
def login():
    global backend_session_cookie, session
    try:
        payload = {
            "model": {"timeout": 259200},
            "auth": [["password", {"username": GXWEB_USER, "password": GXWEB_PASS}]]
        }
        url = f"{GXWEB_URL}/api/session"
        print("DEBUG: login payload:", payload)
        resp = session.post(
            url,
            json=payload
        )
        print("DEBUG: login response status:", resp.status_code)
        print("DEBUG: login response headers:", dict(resp.headers))
        print("DEBUG: login response body:", resp.text)
        set_cookie_headers = resp.headers.get("Set-Cookie")
        print("DEBUG: raw Set-Cookie header:", set_cookie_headers)
        resp.raise_for_status()
        data = resp.json()
        print("DEBUG: login response JSON:", data)
        session_uid = data.get("data", {}).get("uid")

        backend_session_cookie = {}
        if set_cookie_headers:
            # Match everything between session_id= and the first semicolon
            match = re.search(r'session_id=("[^;]+");', set_cookie_headers)
            if match:
                session_id_value = match.group(1)
                # Do NOT strip the outer quotes!
                backend_session_cookie["session_id"] = session_id_value
                print(f"DEBUG: parsed cookie for session_id: {session_id_value}")
            else:
                print("ERROR: session_id not found in Set-Cookie header")
        print("DEBUG: backend_session_cookie stored:", backend_session_cookie)

        response = make_response(jsonify({"success": True, "session_UID": session_uid}))
        response.set_cookie(
            "session_UID",
            session_uid,
            httponly=True,
            secure=False,
            samesite="Lax"
        )
        return response

    except Exception as e:
        print("ERROR in /login:", str(e))
        return jsonify({"success": False, "error": str(e)}), 500

# Get diary list
@app.route("/diary", methods=["GET"])
def get_diary():
    global backend_session_cookie, session

    if not backend_session_cookie:
        print("ERROR: No backend_session_cookie found")
        return jsonify({"error": "Not authenticated"}), 401

    print("DEBUG: get backend_session_cookie:", backend_session_cookie)

    try:
        # Ignore frontend params, set fields exactly as Postman/cURL
        fields_value = '["uid","entity_uid","treating_doctor_uid","service_center_uid","booking_type_uid","name","uuid","disabled"]'
        url = f"{GXWEB_URL}/api/diary"
        print("DEBUG: diary request URL:", url)
        print("DEBUG: diary request params:", {"fields": fields_value})

        headers = {
            "User-Agent": "PostmanRuntime/7.45.0",
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive"
        }
        print("DEBUG: Sending cookies:", backend_session_cookie)
        print("DEBUG: Sending headers:", headers)
        cookie_header = f'session_id={backend_session_cookie["session_id"]}'
        headers["Cookie"] = cookie_header

        resp = session.get(
            url,
            params={"fields": fields_value},
            headers=headers
            # Do NOT use cookies=backend_session_cookie
        )
        print("DEBUG: diary response status_code:", resp.status_code)
        print("DEBUG: diary response headers:", dict(resp.headers))
        print("DEBUG: diary response text:", resp.text)
        resp.raise_for_status()

        return jsonify(resp.json())

    except requests.HTTPError as http_err:
        print("ERROR: HTTPError in /diary:", http_err)
        return jsonify({
            "error": "API returned HTTP error",
            "status_code": resp.status_code,
            "content": resp.text
        }), resp.status_code
    except Exception as e:
        print("ERROR in /diary:", str(e))
        return jsonify({"error": "API request failed", "details": str(e)}), 500

# Get booking statuses for a diary
@app.route("/booking_statuses", methods=["GET"])
def get_booking_statuses():
    global backend_session_cookie, session

    if not backend_session_cookie:
        print("ERROR: No backend_session_cookie found")
        return jsonify({"error": "Not authenticated"}), 401

    diary_uid = request.args.get("diary_uid")
    entity_uid = request.args.get("entity_uid")
    if not diary_uid or not entity_uid:
        return jsonify({"error": "Missing diary_uid or entity_uid"}), 400

    url = f"{GXWEB_URL}/api/booking_status"

    fields = [
        "uid",
        "entity_uid",
        "diary_uid",
        "name",
        "next_booking_status_uid",
        "is_arrived",
        "is_final",
        "disabled"
    ]

    filter_payload = [
        "AND",
        ["=", ["I", "entity_uid"], ["L", int(entity_uid)]],
        ["=", ["I", "diary_uid"], ["L", int(diary_uid)]],
        ["NOT", ["I", "disabled"]]
    ]

    headers = {
        "User-Agent": "PostmanRuntime/7.45.0",
        "Accept": "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Cookie": f'session_id={backend_session_cookie["session_id"]}'
    }

    params = {
        "fields": json.dumps(fields),
        "filter": json.dumps(filter_payload)
    }

    print("DEBUG: booking_status request URL:", url)
    print("DEBUG: booking_status request params:", params)
    print("DEBUG: booking_status request headers:", headers)

    try:
        resp = session.get(url, headers=headers, params=params)
        resp.raise_for_status()
        return jsonify(resp.json())
    except Exception as e:
        print("ERROR: booking_status request failed:", e)
        return jsonify({"error": "API request failed", "details": str(e), "text": getattr(resp, "text", "")}), 500
    
# Helper function to format bookings for a day
def format_bookings_for_day(bookings_json):
    """Reformat raw booking data into a daily sheet with selected fields and sorted as requested."""
    data = bookings_json.get("data", [])

    day_sheet = []
    for b in data:
        pretty_time = ""
        if b.get("start_time"):
            try:
                dt = datetime.fromisoformat(b["start_time"])
                pretty_time = dt.strftime("%H:%M")
            except Exception:
                pretty_time = b["start_time"]  # fallback if parse fails

        day_sheet.append({
            "start_time": b.get("start_time"),          # ISO string
            "time_pretty": pretty_time,                 # pretty HH:MM
            "duration": b.get("duration"),
            "booking_status_uid": b.get("booking_status_uid"),
            "patient_surname": b.get("patient_surname"),
            "patient_name": b.get("patient_name"),
            "cancelled": b.get("cancelled"),
            "uid": b.get("uid"),
        })

    # Sort by start_time, booking_status_uid, cancelled, patient_surname, patient_name
    day_sheet.sort(
        key=lambda x: (
            datetime.fromisoformat(x["start_time"]) if x["start_time"] else datetime.min,
            x["cancelled"],  # False comes before True
            x["booking_status_uid"] or 0,
            x["patient_surname"] or "",
            x["patient_name"] or ""
        )
    )

    return day_sheet

# Get bookings for a specific diary and date
@app.route("/bookings", methods=["GET"])
def get_bookings():
    global backend_session_cookie, session

    if not backend_session_cookie:
        print("ERROR: No backend_session_cookie found")
        return jsonify({"error": "Not authenticated"}), 401

    diary_uid = request.args.get("diary_uid")
    date_str = request.args.get("date")
    if not diary_uid or not date_str:
        return jsonify({"error": "Missing diary_uid or date"}), 400

    url = f"{GXWEB_URL}/api/booking"

    # Fields exactly as Postman/cURL
    fields = [
        ["AS", ["I", "patient_uid", "name"], "patient_name"],
        ["AS", ["I", "patient_uid", "surname"], "patient_surname"],
        ["AS", ["I", "patient_uid", "debtor_uid", "name"], "debtor_name"],
        ["AS", ["I", "patient_uid", "debtor_uid", "surname"], "debtor_surname"],
        "uid",
        "entity_uid",
        "diary_uid",
        "booking_type_uid",
        "booking_status_uid",
        "patient_uid",
        "start_time",
        "duration",
        "treating_doctor_uid",
        "reason",
        "invoice_nr",
        "cancelled",
        "uuid"
    ]

    filter_payload = [
        "AND",
        ["=", ["I", "diary_uid"], ["L", int(diary_uid)]],
        ["=", ["::", ["I", "start_time"], ["I", "date"]], ["L", date_str]]
    ]

    # Headers same as Postman / get_diary
    headers = {
        "User-Agent": "PostmanRuntime/7.45.0",
        "Accept": "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Cookie": f'session_id={backend_session_cookie["session_id"]}'
    }

    params = {
        "fields": json.dumps(fields),
        "filter": json.dumps(filter_payload)
    }

    print("DEBUG: booking request URL:", url)
    print("DEBUG: booking request params:", params)
    print("DEBUG: booking request headers:", headers)

    try:
        resp = session.get(url, headers=headers, params=params)
        resp.raise_for_status()
        format_data = format_bookings_for_day(resp.json())
        return jsonify({"data": format_data, "status": "OK"})   # Wrap in data/status structure
    except Exception as e:
        print("ERROR: booking request failed:", e)
        return jsonify({"error": "API request failed", "details": str(e), "text": getattr(resp, "text", "")}), 500

# Add a new booking - it POSTS the booking model as received from frontend
@app.route("/add_booking", methods=["POST"])
def add_booking():
    global backend_session_cookie, session

    if not backend_session_cookie:
        return jsonify({"error": "Not authenticated"}), 401

    try:
        booking_data = request.json.get("model")
        if not booking_data:
            return jsonify({"error": "Missing booking data"}), 400

        url = f"{GXWEB_URL}/api/booking"

        headers = {
            "User-Agent": "PostmanRuntime/7.45.0",
            "Accept": "*/*",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Content-Type": "application/json",
            "Cookie": f'session_id={backend_session_cookie["session_id"]}'
        }

        print("DEBUG: Posting new booking:", booking_data)

        resp = session.post(url, headers=headers, json={"model": booking_data})
        resp.raise_for_status()

        return jsonify(resp.json())

    except Exception as e:
        print("ERROR in /add_booking:", str(e))
        return jsonify({"error": "API request failed", "details": str(e)}), 500

# After all the definitions, Run the app
if __name__ == "__main__":
    app.run(port=3000, debug=False)
