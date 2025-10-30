//Previous attempts at implementation of .sql files was going nowhere
//sqlite seems much, much easier to implement. I have wasted my time.
//better-sqlite was recommended by Papa Google AI.


import Database from "better-sqlite3";



const db = new Database("src/database/userdb.sqlite");

export function initializeSchema() {
    const alterUserTable = `
          ALTER TABLE users ADD COLUMN experience_level TEXT;
          ALTER TABLE users ADD COLUMN preferred_topics TEXT;
          ALTER TABLE users ADD COLUMN preferred_languages TEXT;
          ALTER TABLE users ADD COLUMN account_age_years INTEGER;
          ALTER TABLE users ADD COLUMN total_prs INTEGER;
          ALTER TABLE users ADD COLUMN activity_level TEXT;
          ALTER TABLE users ADD COLUMN last_scraped_at TEXT;
      `;

      try {
          const statements = alterUserTable.split(';').filter(s => s.trim());
          statements.forEach(stmt => {
              try {
                  db.exec(stmt);
              } catch (err) {
                  // Column already exists, ignore
              }
          });
      } catch (err) {
          console.log("Some columns may already exist");
      }

      // Create issues table
      db.exec(`
          CREATE TABLE IF NOT EXISTS issues (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              repo_owner TEXT NOT NULL,
              repo_name TEXT NOT NULL,
              issue_number INTEGER NOT NULL,
              title TEXT,
              body TEXT,
              labels TEXT,
              repo_topics TEXT,
              primary_language TEXT,
              languages TEXT,
              days_open INTEGER,
              url TEXT,
              newcomer_score REAL,
              scraped_at TEXT,
              UNIQUE(repo_owner, repo_name, issue_number)
          )
      `);

      // Create user_recommendations table
      db.exec(`
          CREATE TABLE IF NOT EXISTS user_recommendations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_login TEXT NOT NULL,
              issue_id INTEGER NOT NULL,
              topic_score REAL,
              language_score REAL,
              date_score REAL,
              total_score REAL,
              recommended_at TEXT,
              FOREIGN KEY (user_login) REFERENCES users(login),
              FOREIGN KEY (issue_id) REFERENCES issues(id)
          )
      `);

      // Create indexes for performance
      db.exec(`
          CREATE INDEX IF NOT EXISTS idx_recommendations_user 
          ON user_recommendations(user_login);
          
          CREATE INDEX IF NOT EXISTS idx_recommendations_score 
          ON user_recommendations(total_score DESC);
      `);

      console.log("Database schema initialized");
    }

      initializeSchema();

//Exportable function to insert users into the database
export function insertOrUpdateUser(user : any) {
    const stmt = db.prepare(`
          INSERT OR REPLACE INTO users (
              login, name, bio, public_repos, followers, following, 
              created_at, updated_at, avatar_url,
              experience_level, preferred_topics, preferred_languages,
              account_age_years, total_prs, activity_level, last_scraped_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
          user.login,
          user.name,
          user.bio,
          user.public_repos,
          user.followers,
          user.following,
          user.created_at,
          user.updated_at,
          user.avatar_url,
          user.experienceLevel || null,
          user.preferredTopics ? JSON.stringify(user.preferredTopics) : null,
          user.preferredLanguages ? JSON.stringify(user.preferredLanguages) : null,
          user.accountAgeYears || null,
          user.totalPRs || null,
          user.activityLevel || null,
          new Date().toISOString()
      );

      console.log(`User ${user.login} saved to database`);
}

// Insert multiple issues (from ML predictions)
  export function insertIssues(issues: any[]) {
      const stmt = db.prepare(`
          INSERT OR REPLACE INTO issues (
              repo_owner, repo_name, issue_number, title, body,
              labels, repo_topics, primary_language, languages,
              days_open, url, newcomer_score, scraped_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = db.transaction((issues: any[]) => {
          for (const issue of issues) {
              stmt.run(
                  issue.repo_owner,
                  issue.repo_name,
                  issue.issue_number,
                  issue.title,
                  issue.body || '',
                  issue.labels ? JSON.stringify(issue.labels) : null,
                  issue.repo_topics ? JSON.stringify(issue.repo_topics) : null,
                  issue.primary_language || null,
                  issue.languages ? JSON.stringify(issue.languages) : null,
                  issue.days_open || 0,
                  issue.url,
                  issue.newcomer_score || 0,
                  new Date().toISOString()
              );
          }
      });

      insertMany(issues);
      console.log(`Inserted ${issues.length} issues into database`);
  }

   // Get all issues (for algorithm processing)
  export function getAllIssues() {
      const stmt = db.prepare(`SELECT * FROM issues ORDER BY newcomer_score DESC`);
      return stmt.all();
  }

  // Clear old issues (older than 90 days)
  export function clearOldIssues() {
      const stmt = db.prepare(`DELETE FROM issues WHERE days_open > 90`);
      const result = stmt.run();
      console.log(`Deleted ${result.changes} old issues`);
  }

  // Insert a user recommendation (personalized score)
  export function insertUserRecommendation(recommendation: any) {
      const stmt = db.prepare(`
          INSERT OR REPLACE INTO user_recommendations (
              user_login, issue_id, topic_score, language_score, 
              date_score, total_score, recommended_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
          recommendation.user_login,
          recommendation.issue_id,
          recommendation.topic_score,
          recommendation.language_score,
          recommendation.date_score,
          recommendation.total_score,
          new Date().toISOString()
      );
  }

  // Get top N recommendations for a user
  export function getUserRecommendations(userLogin: string, limit: number = 5) {
      const stmt = db.prepare(`
          SELECT 
              r.*,
              i.repo_owner,
              i.repo_name,
              i.issue_number,
              i.title,
              i.body,
              i.labels,
              i.repo_topics,
              i.primary_language,
              i.languages,
              i.url,
              i.newcomer_score
          FROM user_recommendations r
          JOIN issues i ON r.issue_id = i.id
          WHERE r.user_login = ?
          ORDER BY r.total_score DESC
          LIMIT ?
      `);

      return stmt.all(userLogin, limit);
  }

  // Get user by login
  export function getUser(login: string) {
      const stmt = db.prepare(`SELECT * FROM users WHERE login = ?`);
      return stmt.get(login);
  }

  // Clear all recommendations for a user (for re-calculating)
  export function clearUserRecommendations(userLogin: string) {
      const stmt = db.prepare(`DELETE FROM user_recommendations WHERE user_login = ?`);
      const result = stmt.run(userLogin);
      console.log(`Cleared ${result.changes} recommendations for ${userLogin}`);
  }

//Will create another table if this works. Just need something to work.
//Works in my DB Browser. Gonna see if I can hook it into the scraper.

//Print Users to check work
export function printUsers(){
    //query all users
    const stmt = db.prepare(`SELECT * FROM USERS`)
    //https://www.reddit.com/r/learnprogramming/comments/ubsv26/better_sqlite_3_get_only_returns_one_row_of/
    const users = stmt.all(); //.all() returns array of the rows of the table

    if (users.length == 0) 
    {
        console.log("No users in database.");
        return;
    }
    console.log("Users in database:");
    users.forEach((user) =>{
        console.log(user);
    });
}

