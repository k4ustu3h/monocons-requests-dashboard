""""
Refactored ZIP -> Request Processor
Outputs flat JSON structure with firstAppearance tracking.

Usage
python3 scripts/backers_pick_parser.py zips src/assets/appfilter.xml src/extracted_png src/assets src/assets/filters/pick.json
"""

import argparse
import json
import re
import io
import os
import zipfile
import lxml.etree as ET
from datetime import date
from pathlib import Path
from collections import Counter

COMPONENT_PATTERN = re.compile('ComponentInfo{(?P<ComponentInfo>.+)}')

CONFIG = {
    "request_limit": 1000,
    "months_limit": 24,
    "min_requests": 4,
}

# -------------------------------------------------------
# CLI
# -------------------------------------------------------

def parse_args():
    parser = argparse.ArgumentParser(description="Parse icon request ZIPs into requests.json")
    parser.add_argument("folder_path", type=str, help="Folder containing .zip files")
    parser.add_argument("appfilter_path", type=str, help="Current appfilter.xml path")
    parser.add_argument("extracted_png_folder_path", type=str, help="Output folder for PNGs")
    parser.add_argument("requests_path", type=str, help="Folder containing requests.json")
    parser.add_argument("pick_path", type=str, help="Path to pick.json")
    return parser.parse_args()

# -------------------------------------------------------
# FILE I/O
# -------------------------------------------------------

def load_zips(folder_path: Path) -> list[Path]:
    if not folder_path.is_dir():
        raise ValueError(f"Path is not a directory: {folder_path}")
    return list(folder_path.glob('*.zip'))

def extract_xml(zip_file: zipfile.ZipFile) -> ET.Element:
    xml_string = zip_file.read('!appfilter.xml')
    return ET.fromstring(xml_string)

def extract_png(zip_file: zipfile.ZipFile, drawable_name: str, out_dir: Path,
                target_name: str | None = None, overwrite: bool = False) -> str:
    base_name = target_name or drawable_name
    candidate_name = base_name
    try:
        for file_info in zip_file.infolist():
            if file_info.filename.endswith(f'{base_name}.png'):
                with zip_file.open(file_info.filename) as png_file:
                    png_content = png_file.read()
                
                png_path = out_dir / f"{candidate_name}.png"
                if not overwrite:
                    count = 1
                    while png_path.exists():
                        candidate_name = f"{base_name}_{count}"
                        png_path = out_dir / f"{candidate_name}.png"
                        count += 1

                out_dir.mkdir(parents=True, exist_ok=True)
                with open(png_path, 'wb') as f:
                    f.write(png_content)
                return candidate_name
    except Exception as e:
        print(f"Error extracting PNG '{drawable_name}': {e}")
    return candidate_name

# -------------------------------------------------------
# PARSING EXISTING DATA
# -------------------------------------------------------

def parse_existing_requests_json(json_path: Path) -> dict:
    if not json_path.exists():
        return {}
        
    with open(json_path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            print(f"Warning: Failed to parse {json_path}. Starting fresh.")
            return {}
    
    apps_map = {}
    for app in data.get("apps", []):
        comp = app.get("componentName")
        if comp:
            apps_map[comp] = app
            
    return apps_map

def parse_existing_pick_json(pick_path: Path) -> set[str]:
    if not pick_path.exists():
        return set()
    
    with open(pick_path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
            return set(data.get("pick", []))
        except json.JSONDecodeError:
            print(f"Warning: Failed to parse {pick_path}. Starting fresh.")
            return set()

# -------------------------------------------------------
# APP REQUEST PROCESSING
# -------------------------------------------------------

def create_app_entry(app_name: str, component_info: str, drawable_name: str, timestamp: float) -> dict:
    return {
        "drawable": drawable_name,
        "label": app_name,
        "componentName": component_info,
        "requestCount": 1,
        "firstAppearance": timestamp,
        "lastRequested": timestamp
    }

def process_item_tag(item: ET.Element) -> tuple[str, str, str] | None:
    comp = item.get('component')
    name = item.get('name')
    draw = item.get('drawable')

    if not all([comp, name, draw]): return None
    
    match = COMPONENT_PATTERN.search(comp)
    if not match: return None

    return match.group('ComponentInfo'), name, draw

def parse_item_tag(item: ET.Element, zip_file: zipfile.ZipFile, apps: dict, 
                   png_out_dir: Path, req_time: float) -> dict:
    
    item_data = process_item_tag(item)
    if not item_data: return apps

    component_info, app_name, drawable = item_data
    
    if component_info in apps:
        entry = apps[component_info]
        entry["requestCount"] += 1
        entry["lastRequested"] = max(entry.get("lastRequested", 0), req_time)

        existing_drawable = entry.get("drawable") or drawable
        entry["drawable"] = extract_png(
            zip_file, drawable, png_out_dir, target_name=existing_drawable, overwrite=True)

        if "firstAppearance" not in entry:
            entry["firstAppearance"] = entry["lastRequested"]
        
        entry["firstAppearance"] = min(entry["firstAppearance"], req_time)
        return apps

    try:
        drawable_name = extract_png(zip_file, drawable, png_out_dir)
        apps[component_info] = create_app_entry(app_name, component_info, drawable_name, req_time)
    except Exception as e:
        print(f"Failed to process new request {component_info}: {e}")

    return apps

def parse_zips(zip_files: list[Path], apps: dict, png_out_dir: Path) -> tuple[dict, set[str]]:
    failed_count = 0
    zip_components = set()
    
    for zip_path in zip_files:
        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_file:
                xml_root = extract_xml(zip_file)
                req_time = os.path.getmtime(zip_path)
                
                for item in xml_root.findall('item'):
                    item_data = process_item_tag(item)
                    if item_data:
                        zip_components.add(item_data[0])
                    apps = parse_item_tag(item, zip_file, apps, png_out_dir, req_time)
        except Exception as e:
            failed_count += 1
            print(f"Error processing {zip_path.name}: {e}")
    
    if failed_count > 0:
        word = "archive" if failed_count == 1 else "archives"
        print(f"Skipped {failed_count} {word} without valid structure")

    return apps, zip_components

# -------------------------------------------------------
# UTILITIES
# -------------------------------------------------------

def load_existing_components(appfilter_path: Path) -> set[str]:
    root = ET.parse(appfilter_path).getroot()
    components = set()
    for item in root.findall(".//item"):
        comp = item.get("component")
        if not comp: continue
        match = COMPONENT_PATTERN.search(comp)
        if match: components.add(match.group(1))
    return components

def filter_old_requests(apps: dict, months_limit: int, min_requests: int) -> dict:
    current_date = date.today()
    def diff_month(d1, d2): return (d1.year - d2.year) * 12 + d1.month - d2.month

    filtered = {}
    for k, v in apps.items():
        ts = v.get("lastRequested", 0)
        if ts <= 0: continue
        
        req_date = date.fromtimestamp(ts)
        if v.get("requestCount", 0) >= min_requests or diff_month(current_date, req_date) < months_limit:
            filtered[k] = v
            
    return filtered

def delete_unused_pngs(out_dir: Path, keep: set[str]):
    if not out_dir.exists(): return
    for f in os.listdir(out_dir):
        if f.endswith(".png"):
            name = os.path.splitext(f)[0]
            if name == "_ic_default": continue
            if name not in keep:
                try: os.remove(os.path.join(out_dir, f))
                except: pass

# -------------------------------------------------------
# OUTPUT
# -------------------------------------------------------

def write_json_output(output_path: Path, apps: dict):
    apps_list = list(apps.values())
    apps_list.sort(key=lambda x: x['requestCount'], reverse=True)
    
    data = {
        "count": len(apps_list),
        "lastUpdate": date.today().strftime("%Y-%m-%d"),
        "apps": apps_list
    }
    
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def update_pick_json(pick_path: Path, existing_pick: set[str], new_components: set[str]):
    updated_pick = existing_pick | new_components
    
    data = {
        "label": "Pick",
        "description": "Requests from Open Collective backers.",
        "pick": sorted(list(updated_pick))
    }
    
    pick_path.parent.mkdir(parents=True, exist_ok=True)
    with open(pick_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    
    print(f"Updated pick.json with {len(new_components)} new components")

def run_pipeline(folder_path: Path, appfilter_path: Path, png_out_path: Path, 
                 output_path: Path, pick_path: Path):
    zip_files = load_zips(folder_path)

    apps = parse_existing_requests_json(output_path)
    existing_pick = parse_existing_pick_json(pick_path)
    
    apps, zip_components = parse_zips(zip_files, apps, png_out_path)
    apps = filter_old_requests(apps, CONFIG["months_limit"], CONFIG["min_requests"])
    
    if appfilter_path.exists():
        existing = load_existing_components(appfilter_path)
        apps = {k: v for k, v in apps.items() if k not in existing}
    else:
        print("Warning: appfilter.xml not found, skipping deduplication.")

    write_json_output(output_path, apps)
    update_pick_json(pick_path, existing_pick, zip_components)

    keep_pngs = {a["drawable"] for a in apps.values()}
    delete_unused_pngs(png_out_path, keep_pngs)

    print(f"Processed {len(zip_files)} archives. Total requests: {len(apps)}")
    if zip_files:
        print("Don't forget to delete processed ZIP files from the zips folder.")

# -------------------------------------------------------
# MAIN
# -------------------------------------------------------
def main():
    args = parse_args()
    run_pipeline(
        folder_path=Path(args.folder_path),
        appfilter_path=Path(args.appfilter_path),
        png_out_path=Path(args.extracted_png_folder_path),
        output_path=Path(args.requests_path) / "requests.json",
        pick_path=Path(args.pick_path)
    )

if __name__ == "__main__":
    main()