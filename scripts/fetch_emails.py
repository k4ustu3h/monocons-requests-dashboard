import imaplib
import os
import sys

# --- CONFIG ---
EMAIL_USER = "monoconsrequest@gmail.com"
EMAIL_PASS = os.environ.get("MONOCONS_GMAIL_PASS") 
SAVE_DIR = "emails"
# --------------

def main():
    if not EMAIL_PASS:
        print("🚨 Error: MONOCONS_GMAIL_PASS environment variable is not set!")
        print("Run it like this: MONOCONS_GMAIL_PASS='your_password' python scripts/fetch_emails.py")
        sys.exit(1)

    os.makedirs(SAVE_DIR, exist_ok=True)
    
    print(f"Connecting to Gmail as {EMAIL_USER}...")
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com")
        mail.login(EMAIL_USER, EMAIL_PASS)
    except Exception as e:
        print(f"Login failed: {e}")
        sys.exit(1)

    mail.select("inbox")
    
    status, messages = mail.search(None, "UNSEEN") 
    email_ids = messages[0].split()

    if not email_ids:
        print("No new emails found in Inbox.")
        return

    print(f"Found {len(email_ids)} new emails. Downloading to {SAVE_DIR}/...")

    for e_id in email_ids:
        _, data = mail.fetch(e_id, "(RFC822)")
        raw_email = data[0][1]
        
        # Save as .eml
        filename = f"request_{e_id.decode('utf-8')}.eml"
        filepath = os.path.join(SAVE_DIR, filename)
        
        with open(filepath, "wb") as f:
            f.write(raw_email)
            
        print(f"  -> Saved {filename}")

    mail.close()
    mail.logout()
    print("Download complete!")

if __name__ == "__main__":
    main()