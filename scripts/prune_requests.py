import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
LOCAL_APPFILTER = REPO_ROOT / "src/assets/appfilter.xml"
REQUESTS_JSON = REPO_ROOT / "src/assets/requests.json"
EXTRACTED_PNG_DIR = REPO_ROOT / "src/extracted_png"

UPSTREAM_APPFILTER = "https://raw.githubusercontent.com/LawnchairLauncher/lawnicons/develop/app/assets/appfilter.xml"

COMPONENT_PATTERN = re.compile(r"ComponentInfo\{([^}]+)}")


def set_workflow_output(name: str, value: str) -> None:
    github_output = os.environ.get("GITHUB_OUTPUT")
    if not github_output:
        return
    with open(github_output, "a", encoding="utf-8") as f:
        f.write(f"{name}={value}\n")


def fetch_upstream_appfilter() -> bytes:
    errors = []
    try:
        with urllib.request.urlopen(UPSTREAM_APPFILTER, timeout=30) as response:
            body = response.read()
            print(f"Fetched upstream appfilter from: {UPSTREAM_APPFILTER}")
            return body
    except urllib.error.HTTPError as err:
        errors.append(f"{UPSTREAM_APPFILTER} -> HTTP {err.code}")
    except urllib.error.URLError as err:
        errors.append(f"{UPSTREAM_APPFILTER} -> {err.reason}")

    details = "\n".join(errors)
    raise RuntimeError(f"Failed to download upstream appfilter.xml:\n{details}")


def extract_component(component_attr: str) -> str:
    match = COMPONENT_PATTERN.search(component_attr)
    if not match:
        return ""
    return match.group(1).strip()


def load_upstream_components(xml_bytes: bytes) -> set[str]:
    root = ET.fromstring(xml_bytes)
    components = set()

    for element in root:
        component_attr = element.get("component")
        if not component_attr:
            continue

        component = extract_component(component_attr)
        if component:
            components.add(component)

    return components


def delete_drawable_png(drawable_name: str) -> bool:
    if not drawable_name:
        return False
    drawable_path = EXTRACTED_PNG_DIR / f"{drawable_name}.png"
    if not drawable_path.exists():
        return False
    drawable_path.unlink()
    return True


def prune_requests(components_to_remove: set[str]) -> tuple[int, int]:
    with open(REQUESTS_JSON, "r", encoding="utf-8") as f:
        requests_data = json.load(f)

    apps = requests_data.get("apps", [])
    kept_apps = []
    removed_apps = []

    for app in apps:
        component_name = app.get("componentName", "")
        if component_name in components_to_remove:
            removed_apps.append(app)
        else:
            kept_apps.append(app)

    if removed_apps:
        requests_data["apps"] = kept_apps
        requests_data["count"] = len(kept_apps)
        with open(REQUESTS_JSON, "w", encoding="utf-8") as f:
            json.dump(requests_data, f, indent=2)

    deleted_png_count = 0
    seen_drawables = set()
    for app in removed_apps:
        drawable = app.get("drawable", "")
        if not drawable or drawable in seen_drawables:
            continue
        seen_drawables.add(drawable)
        if delete_drawable_png(drawable):
            deleted_png_count += 1

    return len(removed_apps), deleted_png_count


def is_outdated(app: dict, now: float) -> bool:
    """Check if an app request is outdated.

    A request is outdated when it was last made >= 1 year ago AND has been
    requested at most 2^(full years since last update) times.
    """
    last_requested = app.get("lastRequested", 0)
    request_count = app.get("requestCount", 0)
    if not last_requested:
        return False

    seconds_per_year = 365.25 * 86400
    age_years = (now - last_requested) / seconds_per_year
    full_years = int(age_years)

    if full_years < 1:
        return False

    return request_count <= 2**full_years


def prune_outdated_requests() -> tuple[int, int]:
    """Remove outdated requests from requests.json and delete their PNGs."""
    with open(REQUESTS_JSON, "r", encoding="utf-8") as f:
        requests_data = json.load(f)

    apps = requests_data.get("apps", [])
    now = time.time()
    kept_apps = []
    removed_apps = []

    for app in apps:
        if is_outdated(app, now):
            removed_apps.append(app)
        else:
            kept_apps.append(app)

    if removed_apps:
        requests_data["apps"] = kept_apps
        requests_data["count"] = len(kept_apps)
        with open(REQUESTS_JSON, "w", encoding="utf-8") as f:
            json.dump(requests_data, f, indent=2)

    deleted_png_count = 0
    seen_drawables = set()
    for app in removed_apps:
        drawable = app.get("drawable", "")
        if not drawable or drawable in seen_drawables:
            continue
        seen_drawables.add(drawable)
        if delete_drawable_png(drawable):
            deleted_png_count += 1

    for app in removed_apps:
        label = app.get("label", "?")
        count = app.get("requestCount", 0)
        last = app.get("lastRequested", 0)
        age = (now - last) / (365.25 * 86400) if last else float("inf")
        print(f"  Outdated: {label} (requests={count}, age={age:.1f}y)")

    return len(removed_apps), deleted_png_count


def main() -> int:
    # --- Fulfilled request pruning (depends on upstream appfilter changes) ---
    appfilter_changed = False
    fulfilled_removed = 0

    try:
        upstream_xml = fetch_upstream_appfilter()
    except RuntimeError as err:
        print(f"Error: {err}")
        set_workflow_output("appfilter_changed", "error")
        return 1

    if LOCAL_APPFILTER.exists():
        local_xml = LOCAL_APPFILTER.read_bytes()
        if local_xml != upstream_xml:
            appfilter_changed = True
    else:
        appfilter_changed = True

    if appfilter_changed:
        LOCAL_APPFILTER.write_bytes(upstream_xml)
        print(f"Updated local appfilter at: {LOCAL_APPFILTER}")

        components = load_upstream_components(upstream_xml)
        fulfilled_removed, fulfilled_deleted = prune_requests(components)

        print(f"Components in upstream appfilter: {len(components)}")
        print(f"Removed fulfilled requests: {fulfilled_removed}")
        print(f"Deleted extracted PNGs (fulfilled): {fulfilled_deleted}")
    else:
        print("No upstream appfilter.xml changes detected.")

    # --- Outdated request pruning (runs unconditionally) ---
    outdated_removed, outdated_deleted = prune_outdated_requests()
    print(f"Removed outdated requests: {outdated_removed}")
    print(f"Deleted extracted PNGs (outdated): {outdated_deleted}")

    # --- Workflow outputs ---
    has_changes = appfilter_changed or outdated_removed > 0
    set_workflow_output("appfilter_changed", str(appfilter_changed).lower())
    set_workflow_output("requests_changed", str(has_changes).lower())
    set_workflow_output("fulfilled_removed", str(fulfilled_removed))
    set_workflow_output("outdated_removed", str(outdated_removed))

    return 0


if __name__ == "__main__":
    sys.exit(main())