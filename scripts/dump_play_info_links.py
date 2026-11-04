# python3 scripts/dump_play_info_links.py
#
# Dumps Google Play Store info (installs, title, icon) for components in links_*.json files
# and saves them into the respective links JSON files for dashboard display.

import argparse
import glob
import io
import json
import os
import random
import re
import signal
import time
import unicodedata
import requests
from google_play_scraper import app as play_app
from PIL import Image

# CONFIG
FILTERS_DIR = "src/assets/filters"
DEAD_PATH = "src/assets/dead_links.json"
ICON_DIR = "src/extracted_images/"

# Throttling & Limits
SLEEP_MIN = 0.5
SLEEP_MAX = 1.0
SAVE_INTERVAL = 10         # Autosave every N requests
MAX_CONSECUTIVE_ERRORS = 5 # Stop if IP blocked

# Packages that don't exist in Play Store
NON_PLAY_STORE_PREFIXES = ("org.chromium.webapk", "com.sec.android.app.sbrowser.webapk")

# STATE
FILES_DATA = {}
MODIFIED_FILES = set()
DEAD_SET = set()
IS_INTERRUPTED = False


def signal_handler(sig, frame):
    global IS_INTERRUPTED
    print("\n\n🛑 Interrupt received! Finishing current item then saving...")
    IS_INTERRUPTED = True


signal.signal(signal.SIGINT, signal_handler)


def sanitize_name(label):
    if not label:
        return "icon"
    label = label.replace("'", '').replace("\u2019", '').replace('`', '')
    ascii_name = unicodedata.normalize('NFD', label).encode('ascii', 'ignore').decode("utf-8")
    if ascii_name != label:
        return None
    name = re.sub(r'[^a-z0-9]+', '_', ascii_name.lower())
    name = name.strip('_')
    if name and name[0].isdigit():
        name = "_" + name
    return name or "icon"


def download_icon(url, filename):
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            os.makedirs(ICON_DIR, exist_ok=True)

            for ext in ['.webp', '.png']:
                old_path = os.path.join(ICON_DIR, f"{filename}{ext}")
                if os.path.exists(old_path):
                    os.remove(old_path)

            path = os.path.join(ICON_DIR, f"{filename}.webp")
            img = Image.open(io.BytesIO(response.content))
            img.save(path, "webp", quality=90)
            return filename
    except Exception as e:
        raise Exception(f"Icon DL Error: {e}")
    return None


def is_small_image(drawable_name):
    if not drawable_name or drawable_name == 'unknown':
        return True
    path = os.path.join(ICON_DIR, f"{drawable_name}.webp")
    if not os.path.exists(path):
        return True
    try:
        img = Image.open(path)
        return img.width < 256 or img.height < 256
    except Exception:
        return True


def load_dead_links():
    global DEAD_SET
    if os.path.exists(DEAD_PATH):
        try:
            with open(DEAD_PATH, 'r', encoding='utf-8') as f:
                DEAD_SET = set(json.load(f))
        except Exception:
            pass


def set_workflow_output(name: str, value: str) -> None:
    github_output = os.environ.get("GITHUB_OUTPUT")
    if not github_output:
        return
    with open(github_output, "a", encoding="utf-8") as f:
        f.write(f"{name}={value}\n")


def load_all_links_files(target_file=None):
    if target_file:
        if not os.path.isabs(target_file) and not target_file.startswith(FILTERS_DIR):
            target_path = os.path.join(FILTERS_DIR, target_file)
        else:
            target_path = target_file
        files = [target_path] if os.path.exists(target_path) else []
    else:
        files = glob.glob(os.path.join(FILTERS_DIR, "links_*.json"))

    def file_sort_key(path):
        base = os.path.basename(path)
        if "requested" in base:
            return (0, 0)
        m = re.search(r'links_(\d+)\.json', base)
        if m:
            return (1, int(m.group(1)))
        return (2, base)

    files.sort(key=file_sort_key)

    data_map = {}
    for f in files:
        try:
            with open(f, 'r', encoding='utf-8') as fp:
                data_map[f] = json.load(fp)
        except Exception as e:
            print(f"⚠️ Failed to load {f}: {e}")
    return data_map


def save_state():
    if not MODIFIED_FILES:
        return
    print("💾 Autosaving...", end=" ", flush=True)
    try:
        for f in list(MODIFIED_FILES):
            with open(f, 'w', encoding='utf-8') as fp:
                json.dump(FILES_DATA[f], fp, indent=2)
                fp.write('\n')
        MODIFIED_FILES.clear()

        # Update dead_links.json
        if os.path.exists(DEAD_PATH):
            with open(DEAD_PATH, 'r', encoding='utf-8') as f:
                existing_dead = set(json.load(f))
            if DEAD_SET - existing_dead:
                merged = sorted(DEAD_SET | existing_dead)
                with open(DEAD_PATH, 'w', encoding='utf-8') as f:
                    json.dump(merged, f, indent=2)
                    f.write('\n')
        else:
            with open(DEAD_PATH, 'w', encoding='utf-8') as f:
                json.dump(sorted(DEAD_SET), f, indent=2)
                f.write('\n')

        print("OK.")
    except Exception as e:
        print(f"FAILED: {e}")


def main():
    global FILES_DATA, MODIFIED_FILES, IS_INTERRUPTED

    parser = argparse.ArgumentParser(description="Dump Play Store info for components in links_*.json files.")
    parser.add_argument("-l", "--limit", type=int, default=500, help="Max apps to update per run (default: 500, 0 for unlimited)")
    parser.add_argument("-f", "--file", type=str, default=None, help="Specific links file to process (e.g. links_requested.json or links_1.json)")
    parser.add_argument("--no-icons", action="store_true", help="Skip downloading icons from Play Store")
    parser.add_argument("--force", action="store_true", help="Force re-fetching Play Store info even if already present")
    args = parser.parse_args()

    FILES_DATA = load_all_links_files(args.file)
    if not FILES_DATA:
        print("No links_*.json files found.")
        return

    load_dead_links()

    # Flatten all items while keeping a reference to their parent file
    all_entries = []
    for file_path, data in FILES_DATA.items():
        links = data.get("links", [])
        for item in links:
            all_entries.append((file_path, item))

    total = len(all_entries)
    print(f"📋 Loaded {total} items across {len(FILES_DATA)} links file(s). {len(DEAD_SET)} known dead links.")

    # Filter items that need updating
    to_process = []
    for file_path, item in all_entries:
        pkg = (item.get('id') or '').split('/')[0]
        if not pkg or pkg.startswith(NON_PLAY_STORE_PREFIXES) or pkg in DEAD_SET:
            continue

        needs_installs = args.force or 'installs' not in item or not item.get('installs') or item.get('installs') == '—'
        needs_icon = not args.no_icons and (
            args.force or 'drawable' not in item or item.get('drawable') == 'unknown' or is_small_image(item.get('drawable'))
        )

        if needs_installs or needs_icon:
            to_process.append((file_path, item, needs_installs, needs_icon))

    if not to_process:
        print("✅ Nothing to sync. All items have installs and icons.")
        return

    # Prioritize items:
    # 1. Higher number of linked components first
    # 2. links_requested first
    def priority_key(entry):
        file_path, item, needs_installs, needs_icon = entry
        is_requested = "requested" in os.path.basename(file_path)
        comp_count = len(item.get('components', [item.get('id', '')]))
        return (
            not is_requested,  # requested files first
            -comp_count,       # highest component count first
        )

    to_process.sort(key=priority_key)

    batch_limit = args.limit
    if batch_limit > 0:
        print(f"🎯 Target: Update max {batch_limit} apps this session.")

    updated_session = 0
    attempted = 0
    consecutive_errors = 0

    for file_path, item, needs_installs, needs_icon in to_process:
        if IS_INTERRUPTED:
            break

        if batch_limit > 0 and attempted >= batch_limit:
            print(f"\n✅ Batch limit reached ({batch_limit}). Stopping gracefully.")
            break

        if consecutive_errors >= MAX_CONSECUTIVE_ERRORS:
            print(f"\n\n🚨 CIRCUIT BREAKER TRIPPED! Too many errors ({consecutive_errors}).")
            break

        pkg = item['id'].split('/')[0]
        if pkg.startswith(NON_PLAY_STORE_PREFIXES):
            DEAD_SET.add(pkg)
            continue
        if pkg in DEAD_SET:
            continue

        attempted += 1
        file_base = os.path.basename(file_path)
        print(f"[{attempted}] ({file_base}) {pkg}...", end=" ", flush=True)

        try:
            details = play_app(pkg, lang='en', country='us')

            # Update Installs
            installs = details.get('installs', '0')
            item['installs'] = installs

            # Update Title / Name if missing or default
            current_name = item.get('name')
            if not current_name or current_name == '(Unknown App)' or current_name == pkg:
                play_title = details.get('title')
                if play_title:
                    item['name'] = play_title

            # Update Icon if needed
            if needs_icon and not args.no_icons:
                icon_url = details.get('icon')
                if icon_url is None:
                    DEAD_SET.add(pkg)
                    print("Dead/NoIcon", end=" ")
                else:
                    existing_d = item.get('drawable')
                    if existing_d and existing_d != 'unknown':
                        clean_name = existing_d
                    else:
                        clean_name = sanitize_name(item.get('name') or details.get('title'))
                        if clean_name is None:
                            clean_name = pkg.replace('.', '_')
                    new_drawable = download_icon(icon_url, clean_name)
                    if new_drawable:
                        item['drawable'] = new_drawable
                        print(f"[Icon: {new_drawable}]", end=" ")

            MODIFIED_FILES.add(file_path)
            print(f"OK ({installs})")
            updated_session += 1
            consecutive_errors = 0

            # Autosave periodically
            if updated_session > 0 and updated_session % SAVE_INTERVAL == 0:
                save_state()

        except Exception as e:
            error_str = str(e).lower()
            if "404" in error_str or "not found" in error_str or "cannot identify image" in error_str:
                print("Dead/404")
                DEAD_SET.add(pkg)
                consecutive_errors = 0
            else:
                print(f"Failed ({e})")
                consecutive_errors += 1
                print(f"   ⚠️ Strike {consecutive_errors}/{MAX_CONSECUTIVE_ERRORS}")

        time.sleep(random.uniform(SLEEP_MIN, SLEEP_MAX))

    save_state()

    set_workflow_output("links_changed", "true" if updated_session > 0 else "false")

    print("-" * 40)
    print(f"✨ Finished. Tried {attempted} apps from Play Store, updated {updated_session}.")

    if updated_session > 0:
        print("\n📝 Suggested Commit Message:")
        print(f"Update links_*.json metadata for {updated_session} apps via Play Store")
    print("-" * 40)


if __name__ == "__main__":
    main()

