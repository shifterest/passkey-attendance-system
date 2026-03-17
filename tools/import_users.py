"""
CLI tool to import users from a CSV file via the admin API.

Usage:
    python import_users.py <csv_file> [--format generic|banner] [--dry-run] [--api-url URL] [--token TOKEN]

Formats:
    generic  Columns: full_name, email, school_id (optional), role (default: student)
    banner   Banner SIS export columns: FIRST_NAME, LAST_NAME, EMAIL_ADDRESS, ID

Examples:
    python import_users.py students.csv
    python import_users.py roster.csv --format banner --dry-run
    python import_users.py students.csv --api-url http://localhost:8000 --token <session_token>
"""

import argparse
import json
import sys
import urllib.request


def main() -> None:
    parser = argparse.ArgumentParser(description="Import users from CSV via admin API")
    parser.add_argument("csv_file", help="Path to the CSV file")
    parser.add_argument(
        "--format", choices=["generic", "banner"], default="generic", help="CSV format adapter"
    )
    parser.add_argument("--dry-run", action="store_true", help="Validate without writing to DB")
    parser.add_argument(
        "--api-url", default="http://localhost:8000", help="Backend base URL"
    )
    parser.add_argument("--token", default="", help="Session token for Authorization header")
    args = parser.parse_args()

    with open(args.csv_file, "rb") as f:
        csv_content = f.read()

    boundary = "----ImportBoundary"
    body_parts = [
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"format\"\r\n\r\n{args.format}",
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"dry_run\"\r\n\r\n{'true' if args.dry_run else 'false'}",
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"import.csv\"\r\nContent-Type: text/csv\r\n\r\n",
    ]
    body = (
        "\r\n".join(body_parts).encode("utf-8")
        + csv_content
        + f"\r\n--{boundary}--\r\n".encode("utf-8")
    )

    headers = {"Content-Type": f"multipart/form-data; boundary={boundary}"}
    if args.token:
        headers["Authorization"] = f"Bearer {args.token}"

    url = f"{args.api_url.rstrip('/')}/admin/import-users"
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        print(f"Error {e.code}: {e.read().decode()}", file=sys.stderr)
        sys.exit(1)

    print(json.dumps(result, indent=2))
    if result.get("errors"):
        sys.exit(1)


if __name__ == "__main__":
    main()
