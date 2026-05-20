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

    from email.utils import parsedate_to_datetime

    sender_latest = {}
    for eid in email_ids:
        status, msg_data = mail.fetch(eid, "(RFC822)")
        if status != "OK":
            continue
        raw_email = msg_data[0][1]
        msg = email.message_from_bytes(raw_email)

        # Check if email has ZIP attachment
        has_zip = False
        for part in msg.walk():
            if part.get_content_maintype() == 'application' and part.get_content_subtype() in ['zip', 'octet-stream']:
                has_zip = True
                break
            if (filename := part.get_filename()) and filename.endswith('.zip'):
                has_zip = True
                break
        
        if not has_zip:
            continue

        sender = msg.get("From", "unknown")
        date_str = msg.get("Date")
        try:
            date_obj = parsedate_to_datetime(date_str) if date_str else None
        except:
            date_obj = None
        
        if sender not in sender_latest or (date_obj and sender_latest[sender][0] and date_obj > sender_latest[sender][0]):
            sender_latest[sender] = (date_obj, eid, raw_email)

    print(f"Found {len(email_ids)} unread emails from {len(sender_latest)} sender(s).")

    EMAILS_DIR.mkdir(parents=True, exist_ok=True)
    saved = 0

    for sender, (_, eid, raw_email) in sender_latest.items():
        msg = email.message_from_bytes(raw_email)
        subject = msg.get("Subject", "no-subject")
        safe_subject = "".join(c for c in subject if c.isalnum() or c in " _-").strip()
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