"""Smoke test — starts FastAPI server in a thread and tests key endpoints."""
import uvicorn
import threading
import time
import urllib.request
import json

def run():
    uvicorn.run("main:app", host="127.0.0.1", port=8004, log_level="error")

t = threading.Thread(target=run, daemon=True)
t.start()
time.sleep(4)

PASS = 0
FAIL = 0

def post(path, payload):
    body = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"http://127.0.0.1:8004{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    return json.loads(urllib.request.urlopen(req, timeout=5).read())

def check(label, fn):
    global PASS, FAIL
    try:
        result = fn()
        print(f"  PASS  {label}: {str(result)[:100]}")
        PASS += 1
    except Exception as e:
        print(f"  FAIL  {label}: {e}")
        FAIL += 1

check("item-summary", lambda: post("/api/item-summary", {
    "item_details": {"title": "Red Wallet", "description": "Small red leather wallet with scratch.", "category": "Others", "location": "Cafeteria"}
}))

check("admin-copilot", lambda: post("/api/admin-copilot", {
    "query": "show fraud claims",
    "available_data": {"stats": {"items": 42, "users": 15, "claims": 8}}
}))

check("claim-credibility", lambda: post("/api/claim-credibility", {
    "claim_description": "Black Samsung S21 with cracked screen and blue case",
    "item_type": "Electronics",
    "item_details": "Samsung phone"
}))

check("evidence-questions", lambda: post("/api/evidence-questions", {
    "item_type": "Electronics",
    "item_details": "iPhone 14 black"
}))

check("search-rewrite", lambda: post("/api/search-rewrite", {
    "query": "black iphone lost near cafeteria last week"
}))

check("notify-prioritize", lambda: post("/api/notification-priority", {
    "notifications": [{"event_type": "pickup_ready", "item_category": "Electronics"}],
    "user_context": {}
}))

check("chat-safety", lambda: post("/api/chat-safety", {
    "message": "My phone number is 555-123-4567 please call me"
}))

print(f"\n{PASS} passed, {FAIL} failed")
