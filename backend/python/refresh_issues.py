# refresh_issues.py
# Checks existing issues in database to see if they're still open on GitHub
# Removes closed issues and reports how many new issues are needed

import sqlite3
import requests
import os
import sys
import time
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv('../.env')

DB_PATH = '../src/database/userdb.sqlite'
TARGET_ISSUE_COUNT = 100

def check_issue_status(repo_owner, repo_name, issue_number, github_token=None):
    """Check if a GitHub issue is still open via API"""
    url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/issues/{issue_number}"

    headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Mentor-Matcher'
    }

    if github_token:
        headers['Authorization'] = f'token {github_token}'

    try:
        response = requests.get(url, headers=headers, timeout=10)

        if response.status_code == 200:
            issue_data = response.json()
            return issue_data.get('state') == 'open'
        elif response.status_code == 404:
            # Issue was deleted or repo was deleted
            return False
        else:
            print(f"  ⚠️ API error {response.status_code} for {repo_owner}/{repo_name}#{issue_number}")
            # Assume it's still open to be safe (avoid deleting valid issues)
            return True
    except Exception as e:
        print(f"  ⚠️ Error checking {repo_owner}/{repo_name}#{issue_number}: {e}")
        # Assume it's still open to be safe
        return True

def check_existing_issues():
    """Check all issues in database and remove closed ones"""
    print("🔍 Checking existing issues in database...\n")

    # Get GitHub token from environment
    github_token = os.environ.get('GITHUB_TOKEN')
    if not github_token:
        print("⚠️ Warning: GITHUB_TOKEN not found. API rate limit will be low (60 requests/hour)")
    else:
        print("✅ Using GITHUB_TOKEN for higher API rate limits (5000 requests/hour)")

    # Connect to database
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Get all issues
    cursor.execute("""
        SELECT id, repo_owner, repo_name, issue_number, title
        FROM issues
        ORDER BY id
    """)
    existing_issues = cursor.fetchall()

    if len(existing_issues) == 0:
        print("📭 No issues in database. Need to scrape from scratch.\n")
        conn.close()
        return 0

    print(f"Found {len(existing_issues)} issues in database")
    print("Checking status on GitHub...\n")

    closed_count = 0
    still_open = []

    for issue_id, owner, repo, number, title in existing_issues:
        # Check status
        is_open = check_issue_status(owner, repo, number, github_token)

        if is_open:
            still_open.append(issue_id)
            print(f"✅ {owner}/{repo}#{number}: Still open")
        else:
            # Remove from database
            cursor.execute("DELETE FROM issues WHERE id = ?", (issue_id,))
            closed_count += 1
            title_preview = title[:50] + '...' if len(title) > 50 else title
            print(f"❌ {owner}/{repo}#{number}: Closed/Deleted - Removed from database")

        # Rate limit: sleep 0.1s between requests (max 10 requests/second)
        time.sleep(0.1)

    conn.commit()
    conn.close()

    print(f"\n{'='*60}")
    print(f"📊 Results:")
    print(f"  - Still open: {len(still_open)} issues")
    print(f"  - Removed (closed): {closed_count} issues")
    print(f"  - Target: {TARGET_ISSUE_COUNT} issues")
    print(f"  - Need to scrape: {max(0, TARGET_ISSUE_COUNT - len(still_open))} new issues")
    print(f"{'='*60}\n")

    return len(still_open)

if __name__ == '__main__':
    remaining = check_existing_issues()
    needed = max(0, TARGET_ISSUE_COUNT - remaining)

    # Output in a format that shell scripts can easily parse
    print(f"REMAINING={remaining}")
    print(f"NEEDED={needed}")

    # Exit with the number of issues needed (for use in scripts)
    sys.exit(0)