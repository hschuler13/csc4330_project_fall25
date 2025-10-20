// src/server.ts
import express, { type RequestHandler } from 'express';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Debug log to verify env variables are loaded
console.log('🔍 Environment Check:');
console.log('CLIENT_ID:', process.env.GITHUB_CLIENT_ID || 'MISSING!');
console.log('CLIENT_SECRET:', process.env.GITHUB_CLIENT_SECRET ? '✓ exists' : 'MISSING!');
console.log('PORT:', process.env.PORT || '3000 (default)');

const app = express();
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

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
