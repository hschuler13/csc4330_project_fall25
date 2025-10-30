# predict_issues.py
import json
import csv
from pathlib import Path
import pandas as pd
from train_model import GFIPredictor  # Import your class
import sqlite3

MODEL_PATH = '../model/gfi_predictor.pkl'
INPUT_JSON = '../data/scraped/open_gfi_issues/open_gfi_issues_latest.json'
OUTPUT_CSV = '../data/output/recommended_issues.csv'

def _normalize_timestamp_naive(series: pd.Series) -> pd.Series:
    """Parse timestamps as UTC, then drop tz to make them tz-naive (avoids tz errors in model)."""
    s = pd.to_datetime(series, errors='coerce', utc=True)
    return s.dt.tz_convert(None)

def _ensure_list(x):
    if isinstance(x, list):
        return x
    if x is None or (isinstance(x, float) and pd.isna(x)):
        return []
    return [x]  # gracefully wrap scalars

def _flatten_list(x):
    if isinstance(x, (list, tuple)):
        return '; '.join(map(str, x))
    return '' if x is None else str(x)

def _format_languages(languages):
    """Format language list with percentages into readable string"""
    if not languages:
        return ''
    if isinstance(languages, list):
        # Handle list of dict objects with name and percentage
        formatted = []
        for lang in languages:
            if isinstance(lang, dict):
                name = lang.get('name', 'Unknown')
                pct = lang.get('percentage', 0)
                formatted.append(f"{name}:{pct}%")
            else:
                formatted.append(str(lang))
        return '; '.join(formatted)
    return str(languages)

def save_to_database(df):
      """Save predicted issues to SQLite database"""
      DB_PATH = '../src/database/userdb.sqlite'

      conn = sqlite3.connect(DB_PATH)
      cursor = conn.cursor()

      # Clear old issues first
      cursor.execute("DELETE FROM issues WHERE days_open > 90")

      # Insert each issue
      inserted = 0
      for _, row in df.iterrows():
          try:
              # Convert lists to JSON strings for database storage
              labels_json = json.dumps(row.get('labels', [])) if isinstance(row.get('labels'), list) else '[]'
              topics_json = json.dumps(row.get('repo_topics', [])) if isinstance(row.get('repo_topics'), list) else '[]'
              languages_json = json.dumps(row.get('languages', [])) if isinstance(row.get('languages'), list) else '[]'

              cursor.execute("""
                  INSERT OR REPLACE INTO issues (
                      repo_owner, repo_name, issue_number, title, body,
                      labels, repo_topics, primary_language, languages,
                      days_open, url, newcomer_score, scraped_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
              """, (
                  row.get('repo_owner', ''),
                  row.get('repo_name', ''),
                  int(row.get('issue_number', 0)),
                  row.get('title', ''),
                  str(row.get('body', ''))[:500],  # Truncated body
                  labels_json,
                  topics_json,
                  row.get('primary_language', ''),
                  languages_json,
                  int(row.get('days_open', 0)),
                  row.get('url', ''),
                  float(row.get('newcomer_score', 0))
              ))
              inserted += 1
          except Exception as e:
              print(f" Error inserting issue: {e}")
              continue

      conn.commit()
      conn.close()

      print(f"\n Saved {inserted} issues to database at {DB_PATH}")

def main():
    # Load the trained model
    predictor = GFIPredictor()
    predictor.load_model(MODEL_PATH)

    # Load the open issues from scraper
    with open(INPUT_JSON, 'r') as f:
        data = json.load(f)

    # Convert to DataFrame
    open_issues_df = pd.DataFrame(data.get('issues', []))
    if open_issues_df.empty:
        print("No issues found in JSON.")
        return

    # --- Normalize timestamps BEFORE prediction (fix tz-aware/naive subtraction) ---
    if 'created_at' in open_issues_df.columns:
        open_issues_df['created_at'] = _normalize_timestamp_naive(open_issues_df['created_at'])
    for col in ('updated_at', 'closed_at'):
        if col in open_issues_df.columns:
            open_issues_df[col] = _normalize_timestamp_naive(open_issues_df[col])

    # Ensure list-like fields are lists (prevents errors later)
    for col in ['labels', 'assignees', 'participants', 'repo_topics']:
        if col in open_issues_df.columns:
            open_issues_df[col] = open_issues_df[col].apply(_ensure_list)

    # --- Predict top issues (your existing model logic returns top 20) ---
    top_recommendations = predictor.predict_open_issues(open_issues_df)

    # Save to database FIRST (before flattening for CSV)
    save_to_database(top_recommendations)

    # --- Post-process for a clean, teammate-friendly CSV ---
    df = top_recommendations.copy()

    # Handle languages specially - format with percentages
    if 'languages' in df.columns:
        df['languages'] = df['languages'].apply(_format_languages)

    # Flatten other list fields
    for col in ['labels', 'assignees', 'participants', 'repo_topics']:
        if col in df.columns:
            df[col] = df[col].apply(_flatten_list)

    # Clean body: collapse whitespace + trim to keep spreadsheets usable
    if 'body' in df.columns:
        df['body'] = (
            df['body']
              .fillna('')
              .astype(str)
              .str.replace(r'\s+', ' ', regex=True)
              .str.slice(0, 500)   # adjust length if you want
        )

    # Format dates (simple & consistent)
    for col in ['created_at', 'updated_at']:
        if col in df.columns:
            dt = pd.to_datetime(df[col], errors='coerce')
            df[col] = dt.dt.strftime('%Y-%m-%d').fillna('')

    # Round the model score
    if 'newcomer_score' in df.columns:
        df['newcomer_score'] = pd.to_numeric(df['newcomer_score'], errors='coerce').round(3)

    # Fill helpful composite if missing
    if 'repo_full_name' not in df.columns and {'repo_owner','repo_name'}.issubset(df.columns):
        df['repo_full_name'] = df['repo_owner'].astype(str) + '/' + df['repo_name'].astype(str)

    # Final column order - LANGUAGES FIRST as requested by teammate
    cols = [
        # Language info FIRST
        'primary_language','languages',
        # Then repo info
        'repo_owner','repo_name','repo_full_name','repo_topics',
        # Issue details
        'issue_number','title','body','labels',
        # Metadata
        'num_comments','assignees','participants','has_gfi_label',
        'created_at','updated_at','days_open','url',
        # ML score
        'newcomer_score',
    ]
    cols = [c for c in cols if c in df.columns]

    # Save
    Path(OUTPUT_CSV).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(OUTPUT_CSV, index=False, columns=cols, quoting=csv.QUOTE_MINIMAL, doublequote=True)
    print(f"\n Top {len(df)} recommended issues saved to {OUTPUT_CSV}")
    print(f" Columns: {', '.join(cols)}")
    
    # Show sample of language distribution
    if 'primary_language' in df.columns:
        lang_counts = df['primary_language'].value_counts().head(5)
        print(f"\n Top languages in recommendations:")
        for lang, count in lang_counts.items():
            print(f"   {lang}: {count} issues")

if __name__ == '__main__':
    main()