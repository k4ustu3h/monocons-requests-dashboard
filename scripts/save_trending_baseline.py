"""
Save trending baseline snapshots for comparing request counts between email fetches.
period_start: the snapshot of the database right before the latest fetch.
period_end: the live snapshot updated daily.
This continuous rolling approach ensures the file is never deleted and history is maintained.
"""

import json
from pathlib import Path
from datetime import date, datetime, timedelta, timezone

REPO_ROOT = Path(__file__).resolve().parents[1]
REQUESTS_JSON = REPO_ROOT / "src/assets/requests.json"
BASELINE_PATH = REPO_ROOT / "src/assets/stats/trending_baseline.json"
LAST_FETCH_PATH = REPO_ROOT / "src/assets/last_email_fetch.txt"
MAPUTO = timezone(timedelta(hours=2))

def load_baseline():
    if BASELINE_PATH.exists():
        with open(BASELINE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"period_start": None, "period_end": None}


def save_baseline(data):
    BASELINE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(BASELINE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def build_snapshot(apps, min_req=10):
    snapshot = {}
    for app in apps:
        comp = app.get("componentName", "")
        req = app.get("requestCount", 0)
        if comp and req >= min_req:
            snapshot[comp] = req
    return snapshot


def main():
    today = datetime.now(MAPUTO).date()
    baseline = load_baseline()

    # Load current requests
    with open(REQUESTS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    apps = data.get("apps", [])
    total = data.get("count", len(apps))
    snapshot = build_snapshot(apps)

    current_state = {
        "date": today.isoformat(),
        "total": total,
        "snapshot": snapshot
    }

    # Check if emails were fetched today
    last_fetch_date = None
    if LAST_FETCH_PATH.exists():
        last_fetch_date = date.fromisoformat(LAST_FETCH_PATH.read_text().strip())

    # If today is a fetch day, roll the OLD period_end into the NEW period_start.
    # This securely captures the exact "Before Fetch" vs "After Fetch" delta!
    if last_fetch_date == today:
        if baseline.get("period_end") and baseline["period_end"]["date"] != today.isoformat():
            baseline["period_start"] = baseline["period_end"]
            print("Fetch day! Rolled previous period_end into new period_start.")

    # Initial fallback for the very first time the script runs
    if not baseline.get("period_start"):
        baseline["period_start"] = current_state

    # Always update period_end to the current state
    start_snapshot = baseline["period_start"]["snapshot"]
    filtered_snapshot = {k: v for k, v in snapshot.items() if k in start_snapshot}
    current_state["snapshot"] = filtered_snapshot
    
    baseline["period_end"] = current_state
    print(f"Updated trending period_end with {len(filtered_snapshot)} entries.")

    save_baseline(baseline)


if __name__ == "__main__":
    main()