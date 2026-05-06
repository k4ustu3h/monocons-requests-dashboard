"""
Save trending baseline snapshots for comparing request counts during open period.
Saves period_start when requests open, period_end when they close.
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


def get_settings():
    try:
        with urllib.request.urlopen(SETTINGS_URL, timeout=10) as resp:
            return json.load(resp)
    except Exception as e:
        print(f"Failed to check settings: {e}")
        return {}


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
    settings = get_settings()
    enabled = settings.get("enabled", False)
    
    baseline = load_baseline()
    today = date.today().isoformat()

    # Check if period_end is older than 30 days — reset
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

    if enabled and baseline.get("period_start") is None:
        # Requests just opened — save period_start
        baseline["period_start"] = entry
        print(f"Saved period_start with {len(snapshot)} entries")
        save_baseline(baseline)
    elif not enabled and baseline.get("period_start") is not None and baseline.get("period_end") is None:
        # Requests just closed — save period_end
        start_snapshot = baseline["period_start"]["snapshot"]
        filtered_snapshot = {k: v for k, v in snapshot.items() if k in start_snapshot}
        entry["snapshot"] = filtered_snapshot
        baseline["period_end"] = entry
        print(f"Saved period_end with {len(filtered_snapshot)} entries")
        save_baseline(baseline)
    else:
        print("No snapshot needed at this time.")


if __name__ == "__main__":
    main()