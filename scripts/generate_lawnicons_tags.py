import argparse
import json
import os
import re
import xml.etree.ElementTree as ET

def load_appfilter_packages(appfilter_path):
    existing_packages = {}  # package -> {'drawable': str, 'components': set(str)}
    if not os.path.exists(appfilter_path):
        print(f"Warning: {appfilter_path} not found.")
        return existing_packages

    try:
        tree = ET.parse(appfilter_path)
        root = tree.getroot()
        
        for item in root.findall('item'):
            drawable = item.get('drawable', '')
            comp = item.get('component')
            if comp:
                match = re.search(r'ComponentInfo\{([^/]+)', comp)
                if match:
                    pkg = match.group(1)
                    if pkg not in existing_packages:
                        existing_packages[pkg] = {'drawable': drawable, 'components': set()}
                    existing_packages[pkg]['components'].add(comp)
    except Exception as e:
        print(f"Error parsing appfilter: {e}")

    return existing_packages

def main(input_file, output_dir, lawnicons_appfilter_path, monocons_appfilter_path):
    os.makedirs(output_dir, exist_ok=True)

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            apps = data['apps']
    except FileNotFoundError:
        print(f"Error: {input_file} not found.")
        return

    lawnicons_packages = load_appfilter_packages(lawnicons_appfilter_path)
    monocons_packages = load_appfilter_packages(monocons_appfilter_path)
    
    in_lawnicons_data = []
    links_data = []

    print(f"Scanning {len(apps)} requests...")

    for app in apps:
        app_id = app.get('componentName')
        if not app_id: continue
        
        pkg = app_id.split('/')[0]
        
        if pkg in lawnicons_packages:
            in_lawnicons_data.append({"id": app_id, "lawnicons_drawable": lawnicons_packages[pkg]['drawable']})
            
            l_comps = lawnicons_packages[pkg]['components']
            m_comps = monocons_packages.get(pkg, {}).get('components', set())
            
            if len(m_comps) > 0 and len(l_comps) > len(m_comps):
                links_data.append(app_id)

    output_path = os.path.join(output_dir, "in_lawnicons.json")
    output_data = {
        "label": "In Lawnicons",
        "description": "Requests that are already supported by the Lawnicons app.",
        "in_lawnicons": in_lawnicons_data
    }
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)

    output_path_links = os.path.join(output_dir, "links.json")
    output_data_links = {
        "label": "Links",
        "description": "Apps supported in Monocons but with additional components linked in Lawnicons.",
        "links": links_data
    }
    with open(output_path_links, 'w', encoding='utf-8') as f:
        json.dump(output_data_links, f, indent=2)

    print(f"Generated tags: {len(in_lawnicons_data)} in Lawnicons.")
    print(f"Generated tags: {len(links_data)} in Links.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate Lawnicons filters")
    parser.add_argument("input_file", help="Path to requests.json")
    parser.add_argument("output_dir", help="Directory to save filter JSONs")
    parser.add_argument("lawnicons_appfilter_path", help="Path to lawnicons_appfilter.xml")
    parser.add_argument("monocons_appfilter_path", help="Path to upstream appfilter.xml")
    args = parser.parse_args()
    
    main(args.input_file, args.output_dir, args.lawnicons_appfilter_path, args.monocons_appfilter_path)
