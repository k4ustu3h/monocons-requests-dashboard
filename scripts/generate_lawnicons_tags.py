import argparse
import json
import os
import re
import xml.etree.ElementTree as ET

def parse_appfilter(path):
    components = {}  # cname -> {'drawable': str, 'name': str}
    drawables = set()
    pkg_map = {}  # pkg -> {'drawables': set(), 'components': set(), 'first_name': str, 'first_drawable': str}

    if not os.path.exists(path):
        print(f"Warning: {path} not found.")
        return components, drawables, pkg_map

    try:
        tree = ET.parse(path)
        root = tree.getroot()
        for item in root.findall('item'):
            comp = item.get('component', '')
            drawable = item.get('drawable', '')
            name = item.get('name', '')
            match = re.search(r'ComponentInfo\{([^}]+)\}', comp)
            cname = match.group(1) if match else comp
            if not cname:
                continue

            components[cname] = {'drawable': drawable, 'name': name}
            if drawable:
                drawables.add(drawable)

            pkg = cname.split('/')[0]
            if pkg not in pkg_map:
                pkg_map[pkg] = {
                    'drawables': set(),
                    'components': set(),
                    'first_name': name,
                    'first_drawable': drawable
                }
            if drawable:
                pkg_map[pkg]['drawables'].add(drawable)
            pkg_map[pkg]['components'].add(cname)
    except Exception as e:
        print(f"Error parsing appfilter {path}: {e}")

    return components, drawables, pkg_map

def main(input_file, output_dir, lawnicons_appfilter_path, monocons_appfilter_path):
    os.makedirs(output_dir, exist_ok=True)

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            apps = data.get('apps', [])
    except FileNotFoundError:
        print(f"Error: {input_file} not found.")
        return

    m_comps, m_drawables, m_pkg_map = parse_appfilter(monocons_appfilter_path)
    l_comps, l_drawables, l_pkg_map = parse_appfilter(lawnicons_appfilter_path)

    # Determine SVG directory for verifying Monocons drawables
    svg_dir = os.path.join(os.path.dirname(monocons_appfilter_path), "qa_issues", "svgs")
    if not os.path.exists(svg_dir):
        svg_dir = os.path.join("src", "assets", "qa_issues", "svgs")

    print(f"Scanning {len(apps)} requests and {len(l_comps)} Lawnicons components...")

    # 1. in_lawnicons: Requests from requests.json whose package exists in Lawnicons
    in_lawnicons_data = []
    for app in apps:
        app_id = app.get('componentName')
        if not app_id:
            continue
        pkg = app_id.split('/')[0]
        if pkg in l_pkg_map:
            in_lawnicons_data.append({
                "id": app_id,
                "lawnicons_drawable": l_pkg_map[pkg]['first_drawable']
            })

    # 2. links: All new Lawnicons components not in Monocons where Monocons has the drawable,
    # plus any open requests in requests.json where Lawnicons has extra components for the package.
    # Group items by (package, matched_drawable) so aliases are merged into a single item.
    link_groups = {}  # key: (pkg, matched_drawable) -> dict

    for cname, l_info in l_comps.items():
        if cname in m_comps:
            continue  # Already supported in Monocons

        pkg = cname.split('/')[0]
        l_draw = l_info['drawable']
        l_name = l_info['name']

        matched_drawable = None
        if pkg in m_pkg_map:
            pkg_draws = sorted(m_pkg_map[pkg]['drawables'])
            if l_draw in pkg_draws:
                matched_drawable = l_draw
            elif len(pkg_draws) == 1:
                matched_drawable = pkg_draws[0]
            elif l_draw in m_drawables:
                matched_drawable = l_draw
            elif len(pkg_draws) > 0:
                matched_drawable = pkg_draws[0]
        elif l_draw in m_drawables:
            matched_drawable = l_draw

        if matched_drawable:
            svg_file = os.path.join(svg_dir, f"{matched_drawable}.svg")
            if not os.path.exists(svg_dir) or os.path.exists(svg_file):
                key = (pkg, matched_drawable)
                app_name = l_name or m_pkg_map.get(pkg, {}).get('first_name') or cname.split('/')[-1]
                if key not in link_groups:
                    link_groups[key] = {
                        "id": cname,
                        "existing_drawable": matched_drawable,
                        "name": app_name,
                        "components": [cname]
                    }
                else:
                    link_groups[key]["components"].append(cname)
                    if not link_groups[key]["name"] and app_name:
                        link_groups[key]["name"] = app_name

    req_app_ids = {app.get('componentName') for app in apps if app.get('componentName')}

    for app in apps:
        app_id = app.get('componentName')
        if not app_id:
            continue
        pkg = app_id.split('/')[0]
        if pkg in l_pkg_map and pkg in m_pkg_map:
            l_comps_set = l_pkg_map[pkg]['components']
            m_comps_set = m_pkg_map[pkg]['components']
            if len(m_comps_set) > 0 and len(l_comps_set) > len(m_comps_set):
                pkg_draws = sorted(m_pkg_map[pkg]['drawables'])
                matched_drawable = pkg_draws[0] if pkg_draws else None
                if matched_drawable:
                    svg_file = os.path.join(svg_dir, f"{matched_drawable}.svg")
                    if not os.path.exists(svg_dir) or os.path.exists(svg_file):
                        key = (pkg, matched_drawable)
                        if key in link_groups:
                            link_groups[key]["id"] = app_id
                            if app.get('label'):
                                link_groups[key]["name"] = app.get('label')
                            if app_id not in link_groups[key]["components"]:
                                link_groups[key]["components"].append(app_id)
                        else:
                            link_groups[key] = {
                                "id": app_id,
                                "existing_drawable": matched_drawable,
                                "name": app.get('label') or app_id.split('/')[-1],
                                "components": [app_id]
                            }

    for key, group in link_groups.items():
        comps = group["components"]
        if group["id"] not in req_app_ids:
            main_acts = [c for c in comps if '.MainActivity' in c]
            if main_acts:
                group["id"] = sorted(main_acts)[0]
            else:
                group["id"] = sorted(comps)[0]

    links_data = []
    for group in link_groups.values():
        links_data.append({
            "id": group["id"],
            "existing_drawable": group["existing_drawable"],
            "name": group["name"]
        })

    links_data.sort(key=lambda x: (x.get('name', '').lower(), x.get('id', '')))

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
