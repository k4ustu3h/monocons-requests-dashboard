"""
Save trending baseline snapshots for comparing request counts during open period.
Saves period_start on first run, updates period_end on subsequent runs.
Deletes baseline file if period_end is older than 30 days.
"""

import json
import sys
import urllib.request
from pathlib import Path
from datetime import date, datetime

REPO_ROOT = Path(__file__).resolve().parents[1]
REQUESTS_JSON = REPO_ROOT / "src/assets/requests.json"
BASELINE_PATH = REPO_ROOT / "src/assets/trending_baseline.json"
SETTINGS_URL = "https://raw.githubusercontent.com/LawnchairLauncher/lawnchair-website/master/lawnicons-request/settings.json"


def check_requests_open():
    try:
        with urllib.request.urlopen(SETTINGS_URL, timeout=10) as resp:
            data = json.load(resp)
            return data.get("enabled", False)
    except Exception as e:
        print(f"Failed to check settings: {e}")
        return False


def load_baseline():
    if BASELINE_PATH.exists():
        with open(BASELINE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"period_start": None, "period_end": None}


def save_baseline(data):
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
    if not check_requests_open():
        print("Requests are closed. Skipping baseline save.")
        return

    baseline = load_baseline()
    today = date.today().isoformat()

    # Check if period_end is older than 30 days
    if baseline.get("period_end") and baseline["period_end"].get("date"):
        end_date = datetime.strptime(baseline["period_end"]["date"], "%Y-%m-%d").date()
        if (date.today() - end_date).days > 30:
            print("Baseline older than 30 days. Deleting.")
            BASELINE_PATH.unlink(missing_ok=True)
            baseline = {"period_start": None, "period_end": None}

    with open(REQUESTS_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    apps = data["apps"]
    total = data.get("count", len(apps))
    snapshot = build_snapshot(apps)

    entry = {
        "date": today,
        "total": total,
        "snapshot": snapshot
    }

    if baseline.get("period_start") is None:
        baseline["period_start"] = entry
        print(f"Saved period_start with {len(snapshot)} entries")
    else:
        # Only track components that were in period_start
        start_snapshot = baseline["period_start"]["snapshot"]
        filtered_snapshot = {k: v for k, v in snapshot.items() if k in start_snapshot}
        entry["snapshot"] = filtered_snapshot
        baseline["period_end"] = entry
        print(f"Updated period_end with {len(filtered_snapshot)} entries")

    save_baseline(baseline)


if __name__ == "__main__":
    main()