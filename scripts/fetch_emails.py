"""
Fetch unread emails from Gmail via IMAP and save as .eml files.
Runs every 2 months based on last fetch date.
"""

import os
import sys
import imaplib
import email
from datetime import date, timedelta
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
EMAILS_DIR = REPO_ROOT / "emails"
LAST_FETCH_PATH = REPO_ROOT / "src/assets/last_email_fetch.txt"


def should_fetch_today():
    today = date.today()
    if LAST_FETCH_PATH.exists():
        last = date.fromisoformat(LAST_FETCH_PATH.read_text().strip())
        return today >= last + timedelta(days=60)
    return True


def main():
    if not should_fetch_today():
        print("Not the fetch day. Skipping email fetch.")
        return

    user = os.environ.get("GMAIL_USER")
    password = os.environ.get("GMAIL_APP_PASSWORD")

    if not user or not password:
        print("Error: GMAIL_USER or GMAIL_APP_PASSWORD not set.")
        sys.exit(1)

    print("Connecting to Gmail...")
    mail = imaplib.IMAP4_SSL("imap.gmail.com")
    mail.login(user, password)
    mail.select("inbox")

    status, messages = mail.search(None, "UNSEEN")
    if status != "OK" or not messages[0]:
        print("No unread emails.")
        mail.logout()
        return

    email_ids = messages[0].split()
    print(f"Found {len(email_ids)} unread emails.")

    # Step 1: Fetch only headers to find latest email per sender
    sender_candidates = {}
    for eid in email_ids:
        status, msg_data = mail.fetch(eid, "(BODY.PEEK[HEADER])")
        if status != "OK":
            continue
        header_bytes = msg_data[0][1]
        msg = email.message_from_bytes(header_bytes)

        sender = msg.get("From", "unknown")

        # Quick check: skip emails unlikely to have ZIP attachments
        content_type = msg.get("Content-Type", "")
        if "multipart/mixed" not in content_type and "application/zip" not in content_type:
            continue

        if sender not in sender_candidates:
            sender_candidates[sender] = eid

    print(f"Candidates after header scan: {len(sender_candidates)} sender(s).")

    # Step 2: Fetch full body only for candidates, check ZIP for real
    sender_latest = {}
    for sender, eid in sender_candidates.items():
        status, msg_data = mail.fetch(eid, "(RFC822)")
        if status != "OK":
            continue
        raw_email = msg_data[0][1]
        msg = email.message_from_bytes(raw_email)

        has_zip = False
        for part in msg.walk():
            if part.get_content_maintype() == 'application' and part.get_content_subtype() in ['zip', 'octet-stream']:
                has_zip = True
                break
            if (filename := part.get_filename()) and filename.endswith('.zip'):
                has_zip = True
                break

        if has_zip:
            sender_latest[sender] = (eid, raw_email)

    print(f"Found {len(sender_latest)} sender(s) with ZIP attachments.")

    EMAILS_DIR.mkdir(parents=True, exist_ok=True)
    saved = 0

    for sender, (eid, raw_email) in sender_latest.items():
        filename = f"{eid.decode()}.eml"
        filepath = EMAILS_DIR / filename

        with open(filepath, "wb") as f:
            f.write(raw_email)

        mail.store(eid, "+FLAGS", "\\Seen")
        saved += 1

    mail.logout()
    print(f"Done. Saved {saved} emails to {EMAILS_DIR}.")
    LAST_FETCH_PATH.parent.mkdir(parents=True, exist_ok=True)
    LAST_FETCH_PATH.write_text(date.today().isoformat())


if __name__ == "__main__":
    main()