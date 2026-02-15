import json
import os

# CONFIG
FILE_PATH = "src/assets/requests.json"

def main():
    if not os.path.exists(FILE_PATH):
        print(f"Error: {FILE_PATH} not found.")
        return

    print(f"Reading {FILE_PATH}...")

    with open(FILE_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)

    apps = data.get('apps', [])
    initial_count = len(apps)

    clean_apps = [
        app for app in apps
        if app.get('drawable') and app.get('drawable') != 'unknown'
    ]

    removed_count = initial_count - len(clean_apps)

    if removed_count == 0:
        print("No unknown entries found. Nothing to do.")
        return

    data['apps'] = clean_apps

    with open(FILE_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)

    print("-" * 30)
    print("Cleanup complete")
    print(f"Original count: {initial_count}")
    print(f"New count:      {len(clean_apps)}")
    print(f"Removed:        {removed_count}")
    print("-" * 30)

if __name__ == "__main__":
    main()