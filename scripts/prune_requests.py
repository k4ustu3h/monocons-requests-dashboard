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
FILTERS_DIR = REPO_ROOT / "src/assets/filters"

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


def prune_filter_files() -> int:
    """Remove stale componentName entries from every filter JSON in FILTERS_DIR.

    An entry is stale if it no longer exists in the current requests.json.
    This catches entries left over from previous pruning runs, not just the
    current one.

    Returns the total number of entries removed across all filter files.
    """
    if not FILTERS_DIR.exists():
        return 0

    # Build the authoritative set of valid componentNames from the current requests.json
    try:
        with open(REQUESTS_JSON, "r", encoding="utf-8") as f:
            requests_data = json.load(f)
        valid_components = {
            app.get("componentName", "")
            for app in requests_data.get("apps", [])
        }
        valid_components.discard("")
    except Exception as e:
        print(f"  Warning: could not load requests.json for filter cleanup: {e}")
        return 0

    total_removed = 0

    for filter_path in FILTERS_DIR.glob("*.json"):
        try:
            with open(filter_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            print(f"  Warning: could not read {filter_path.name}: {e}")
            continue

        # The list key matches the file stem (e.g. "match.json" -> "match")
        key = filter_path.stem
        if key not in data or not isinstance(data[key], list):
            continue

        original = data[key]
        cleaned = [entry for entry in original if (entry if isinstance(entry, str) else entry.get("id", "")) in valid_components]
        pruned = len(original) - len(cleaned)

        if pruned:
            data[key] = cleaned
            with open(filter_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            print(f"  Pruned {pruned} stale entries from {filter_path.name}")
            total_removed += pruned

    return total_removed


def prune_requests(components_to_remove: set[str]) -> tuple[int, int, set[str]]:
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

    removed_components = {app.get("componentName", "") for app in removed_apps}
    removed_components.discard("")
    return len(removed_apps), deleted_png_count, removed_components


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

def generate_stale_list() -> int:
    """Generate stale.json containing requests that are at the front of the
    deletion queue.

    A stale request is one whose calculated outdated date falls within a 30-day
    window starting from the earliest outdated date among all requests.
    """
    try:
        with open(REQUESTS_JSON, "r", encoding="utf-8") as f:
            requests_data = json.load(f)
    except Exception as e:
        print(f"Error loading requests.json for stale list generation: {e}")
        return 0

    apps = requests_data.get("apps", [])
    if not apps:
        print("No apps in requests.json, skipping stale list generation")
        return 0

    now = time.time()
    seconds_per_year = 365.25 * 86400
    THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60

    # --- Calculate outdated date for each request ---
    request_outdated_dates = []
    
    for app in apps:
        last_requested = app.get("lastRequested", 0)
        request_count = app.get("requestCount", 0)
        comp_name = app.get("componentName", "")

        if not last_requested or not comp_name:
            continue

        # Find when this request will become outdated
        n = 1
        while 2 ** n < request_count:
            n += 1
        
        outdated_at = last_requested + (n * seconds_per_year)
        request_outdated_dates.append((comp_name, outdated_at))

    if not request_outdated_dates:
        print("No requests with valid outdated dates found")
        return 0

    # --- Find the earliest outdated date ---
    earliest_outdated = min(date for _, date in request_outdated_dates)
    window_end = earliest_outdated + THIRTY_DAYS_IN_SECONDS

    start_date = time.strftime("%Y-%m-%d", time.localtime(earliest_outdated))
    end_date = time.strftime("%Y-%m-%d", time.localtime(window_end))
    print(f"Stale window: {start_date} to {end_date}")

    # --- Collect requests whose outdated date falls within the window ---
    stale_components = [
        comp_name 
        for comp_name, outdated_at in request_outdated_dates
        if earliest_outdated <= outdated_at <= window_end
    ]

    # --- Sort for consistency ---
    stale_components.sort()

    # --- Write to stale.json ---
    stale_file_path = FILTERS_DIR / "stale.json"
    output_data = {
        "label": "Stale",
        "description": "Requests scheduled for deletion.",
        "stale": stale_components
    }

    with open(stale_file_path, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2)

    print(f"Generated {stale_file_path} with {len(stale_components)} entries")
    return len(stale_components)

def update_sets_stats() -> int:
    """Generate sets_stats.json with summed request counts per package.
    Only includes packages that appear 2+ times in requests.json."""
    sets_path = REPO_ROOT / "src/assets/sets_stats.json"
    
    try:
        with open(REQUESTS_JSON, "r", encoding="utf-8") as f:
            requests_data = json.load(f)
    except Exception as e:
        print(f"Error loading requests.json for sets stats: {e}")
        return 0

    apps = requests_data.get("apps", [])
    sets = {}
    
    for app in apps:
        component = app.get("componentName", "")
        if not component:
            continue
        package = component.split("/")[0]
        sets[package] = sets.get(package, 0) + app.get("requestCount", 0)

    # Keep only packages with 2+ components
    sets = {pkg: count for pkg, count in sets.items() if count > 1 and any(
        a.get("componentName", "").startswith(pkg + "/") for a in apps if a.get("componentName", "").split("/")[0] == pkg
    )}
    
    package_counts = {}
    for app in apps:
        pkg = app.get("componentName", "").split("/")[0]
        if pkg:
            package_counts[pkg] = package_counts.get(pkg, 0) + 1
    
    sets = {pkg: count for pkg, count in sets.items() if package_counts.get(pkg, 0) >= 2}

    sets = dict(sorted(sets.items(), key=lambda x: x[1], reverse=True))
    
    with open(sets_path, "w", encoding="utf-8") as f:
        json.dump(sets, f, indent=2)
    
    print(f"Updated sets_stats.json with {len(sets)} packages (2+ occurrences)")
    return len(sets)

label_factors = {
    "stale": 0.1,
    "unlabeled": 1,
    "nameinuse": 2,
    "easy": 3,
    "match": 5,
    "supported": 6,
    "wip": 8,
}

creation_odds_cap = 0.8


def update_creation_odds() -> int:
    """Generate creation_odds.json with fulfillment probabilities.

    Only recalculates if P_top has changed since the previous run.
    Returns the number of popularity levels in the creation odds table.
    """
    creation_odds_path = REPO_ROOT / "src/assets/creation_odds.json"

    # --- Determine P_top (max popularity across all requests) ---
    sets_path = REPO_ROOT / "src/assets/sets_stats.json"
    try:
        with open(sets_path, "r", encoding="utf-8") as f:
            sets_stats = json.load(f)
    except Exception:
        sets_stats = {}

    try:
        with open(REQUESTS_JSON, "r", encoding="utf-8") as f:
            requests_data = json.load(f)
    except Exception as e:
        print(f"Error loading requests.json for creation_odds: {e}")
        return 0

    max_pop = 0
    for app in requests_data.get("apps", []):
        pkg = app.get("componentName", "").split("/")[0]
        pop = sets_stats.get(pkg, app.get("requestCount", 0))
        if pop > max_pop:
            max_pop = pop

    if max_pop == 0:
        print("No popularity data for creation odds")
        return 0

    # --- Check if P_top changed ---
    prev_top = 0
    if creation_odds_path.exists():
        try:
            with open(creation_odds_path, "r", encoding="utf-8") as f:
                prev_data = json.load(f)
            if prev_data and isinstance(prev_data, list):
                prev_top = prev_data[0].get("popularity", 0) if prev_data else 0
        except Exception:
            pass

    if max_pop == prev_top:
        print(f"Top popularity unchanged ({max_pop}), skipping creation odds update")
        return max_pop

    # --- Generate table ---
    factors = sorted(label_factors.keys(), key=lambda k: label_factors[k])
    table = []

    for pop in range(max_pop, 0, -1):
        row = {"popularity": pop}
        base = (pop / max_pop) * creation_odds_cap
        for label in factors:
            L = label_factors[label]
            row[str(L)] = round(min(creation_odds_cap, base * L), 4)
        table.append(row)

    with open(creation_odds_path, "w", encoding="utf-8") as f:
        json.dump(table, f, indent=2)

    print(f"Updated creation_odds.json with {len(table)} levels (top={max_pop})")
    return max_pop    

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
        fulfilled_removed, fulfilled_deleted, _ = prune_requests(components)

        print(f"Components in upstream appfilter: {len(components)}")
        print(f"Removed fulfilled requests: {fulfilled_removed}")
        print(f"Deleted extracted PNGs (fulfilled): {fulfilled_deleted}")
    else:
        print("No upstream appfilter.xml changes detected.")

    # --- Outdated request pruning (runs unconditionally) ---
    outdated_removed, outdated_deleted = prune_outdated_requests()
    print(f"Removed outdated requests: {outdated_removed}")
    print(f"Deleted extracted PNGs (outdated): {outdated_deleted}")

    # --- Filter file cleanup (always runs; catches stale entries from any past run) ---
    filter_entries_removed = prune_filter_files()
    if filter_entries_removed:
        print(f"Removed stale filter entries: {filter_entries_removed}")

    # --- Generate stale.json (runs unconditionally after all pruning) ---
    stale_count = generate_stale_list()
    print(f"Stale requests identified: {stale_count}")

    # --- Update sets_stats.json ---
    sets_count = update_sets_stats()
    print(f"Package sets updated: {sets_count}")

    # --- Update creation_odds.json ---
    creation_odds_count = update_creation_odds()
    print(f"Creation odds updated: {creation_odds_count} levels")

    # --- Workflow outputs ---
    has_changes = appfilter_changed or outdated_removed > 0
    set_workflow_output("appfilter_changed", str(appfilter_changed).lower())
    set_workflow_output("requests_changed", str(has_changes).lower())
    set_workflow_output("fulfilled_removed", str(fulfilled_removed))
    set_workflow_output("outdated_removed", str(outdated_removed))

    return 0


if __name__ == "__main__":
    sys.exit(main())