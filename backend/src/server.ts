// src/server.ts
import express, { type RequestHandler } from 'express';
import dotenv from 'dotenv';
import { getUser, getUserRecommendations, getAllIssues } from './database/db.js';
import { runUserFilter } from './algorithms/taskUserFilter.js';
import { getTopRecommendations } from './algorithms/taskDistributionAlgorithm.js';

// Load environment variables from .env file
dotenv.config();

// Debug log to verify env variables are loaded
console.log('🔍 Environment Check:');
console.log('CLIENT_ID:', process.env.GITHUB_CLIENT_ID || 'MISSING!');
console.log('CLIENT_SECRET:', process.env.GITHUB_CLIENT_SECRET ? '✓ exists' : 'MISSING!');
console.log('PORT:', process.env.PORT || '3000 (default)');

const app = express();
// Middleware to parse JSON bodies
app.use(express.json());
const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';


// --- Result typing from your OAuth handler ---
type SuccessResult = { success: true; user: { username: string; experienceLevel?: string } };
type ErrorResult   = { success: false; error?: string };
type OAuthResult   = SuccessResult | ErrorResult;

// --- Simple landing page for quick manual test (optional) ---
const rootHandler: RequestHandler = (_req, res) => {
  res.send(`
    <html>
      <body style="padding: 50px; font-family: Arial;">
        <h1>Test GitHub OAuth</h1>
        <a href="/api/auth/github/start"
           style="padding: 10px 20px; background: #24292e; color: white; text-decoration: none; border-radius: 5px;">
          Sign in with GitHub
        </a>
      </body>
    </html>
  `);
};
app.get('/', rootHandler);

// 1) Start: redirect the browser to GitHub
const startAuth: RequestHandler = (_req, res) => {
  const redirectUri = encodeURIComponent(`http://localhost:${PORT}/api/auth/github/callback`);
  const scope = encodeURIComponent('read:user user:email');
  const url = `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${redirectUri}&scope=${scope}`;
  res.redirect(url);
};
app.get('/api/auth/github/start', startAuth);

// 2) Callback from GitHub: exchange code on the server, then redirect to React
const callbackHandler: RequestHandler = async (req, res) => {
  const codeQ = req.query.code;
  const code = typeof codeQ === 'string' ? codeQ : undefined;
  if (!code) {
    res.status(400).send('<h1>Missing ?code=...</h1>');
    return;
  }

  try {
    const mod = await import('./auth/Oauth-handler.js');
    const handleGitHubCallback: (c: string) => Promise<OAuthResult> =
      (mod as any).handleGitHubCallback ?? (mod as any).default;

    if (typeof handleGitHubCallback !== 'function') {
      throw new Error('handleGitHubCallback not exported from ./Oauth-handler.js');
    }

    const result = await handleGitHubCallback(code);

    if (result.success) {
      // Temporary: Display success directly (no frontend needed)
      res.send(`
        <html>
          <head>
            <style>
              body {
                font-family: Arial, sans-serif;
                max-width: 600px;
                margin: 50px auto;
                padding: 20px;
                background: #f5f5f5;
              }
              .success-box {
                background: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              }
              h1 { color: #28a745; }
              .info { margin: 10px 0; }
              a {
                display: inline-block;
                margin-top: 20px;
                padding: 10px 20px;
                background: #24292e;
                color: white;
                text-decoration: none;
                border-radius: 5px;
              }
            </style>
          </head>
          <body>
            <div class="success-box">
              <h1>✅ GitHub OAuth Success!</h1>
              <div class="info"><strong>Username:</strong> ${result.user.username}</div>
              <div class="info"><strong>Email:</strong> ${(result.user as any).email || 'Not available'}</div>
              <div class="info"><strong>Name:</strong> ${(result.user as any).name || 'Not available'}</div>
              <a href="/">← Back to Home</a>
            </div>
          </body>
        </html>
      `);
    } else {
      res.send(`
        <html>
          <body style="padding: 50px; font-family: Arial;">
            <h1>❌ OAuth Failed</h1>
            <p>Error: ${result.error ?? 'Unknown error'}</p>
            <a href="/">Try again</a>
          </body>
        </html>
      `);
    }
  } catch (err) {
    console.error(err);
    res.status(500).send(`
      <html>
        <body style="padding: 50px; font-family: Arial;">
          <h1>❌ Server Error</h1>
          <p>Something went wrong during authentication.</p>
          <a href="/">Go back</a>
        </body>
      </html>
    `);
  }
}; // ← Make sure this closing brace and semicolon are here!

app.get('/api/auth/github/callback', callbackHandler);

// 3) Example API the React app can call after sign-in
const meHandler: RequestHandler = (_req, res) => {
  // In real code, read user from your session/JWT and return JSON
  res.json({ ok: true, user: null });
};
app.get('/api/me', meHandler);

// ============================================================
  // API ENDPOINTS FOR FRONTEND
  // ============================================================

  // GET /api/user/:username - Get user profile from database
  const getUserHandler: RequestHandler = async (req, res) => {
    try {
      const { username } = req.params;
      const user = getUser(username) as any;

      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Parse JSON fields
      const profile = {
        ...user,
        preferred_topics: user.preferred_topics ? JSON.parse(user.preferred_topics) : [],
        preferred_languages: user.preferred_languages ? JSON.parse(user.preferred_languages) : []
      };

      res.json({ success: true, user: profile });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  };
  app.get('/api/user/:username', getUserHandler);

  // GET /api/recommendations/:username - Get personalized recommendations
  const getRecommendationsHandler: RequestHandler = async (req, res) => {
    try {
      const { username } = req.params;
      const limit = Number(req.query.limit) || 5;

      // Check if user exists
      const user = getUser(username) as any;
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found. Please sign in first.'
        });
      }

      // Get recommendations from database
      const recommendations = getUserRecommendations(username, limit);

      if (recommendations.length === 0) {
        return res.json({
          success: true,
          recommendations: [],
          message: 'No recommendations yet. Generate them first.'
        });
      }

      // Parse JSON fields in recommendations
      const parsed = recommendations.map((rec: any) => ({
        ...rec,
        labels: rec.labels ? JSON.parse(rec.labels) : [],
        repo_topics: rec.repo_topics ? JSON.parse(rec.repo_topics) : [],
        languages: rec.languages ? JSON.parse(rec.languages) : []
      }));

      res.json({ success: true, recommendations: parsed });
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  };
  app.get('/api/recommendations/:username', getRecommendationsHandler);

  // POST /api/recommendations/:username/generate - Generate recommendations for user
  const generateRecommendationsHandler: RequestHandler = async (req, res) => {
    try {
      const { username } = req.params;
      const limit = Number(req.body?.limit) || 20;

      // Check if user exists
      const user = getUser(username) as any;
      if (!user) {
        return res.status(404).json({
          success: false,
          error: 'User not found. Please sign in first.'
        });
      }

      console.log(`Generating recommendations for ${username}...`);

      // Run the recommendation algorithm
      await runUserFilter(username, limit);

      // Get the top recommendations
      const recommendations = getUserRecommendations(username, 5);

      res.json({
        success: true,
        message: `Generated ${recommendations.length} recommendations`,
        recommendations
      });
    } catch (error) {
      console.error('Error generating recommendations:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  };
  app.post('/api/recommendations/:username/generate',
  generateRecommendationsHandler);

  // GET /api/issues - Get all issues (for debugging/admin)
  const getIssuesHandler: RequestHandler = (_req, res) => {
    try {
      const issues = getAllIssues();
      res.json({ success: true, count: issues.length, issues });
    } catch (error) {
      console.error('Error fetching issues:', error);
      res.status(500).json({ success: false, error: 'Server error' });
    }
  };
  app.get('/api/issues', getIssuesHandler);

  // ============================================================

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
