// src/server.ts
import express, { type RequestHandler } from 'express';

const app = express();
const PORT = Number(process.env.PORT ?? 3000);
const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173'; // your React dev URL

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
    // IMPORTANT for NodeNext/TS:
    // Keep ".js" in the import path in your TS source. When compiled, dist/server.js will
    // import "./Oauth-handler.js" which should exist next to it in dist/.
    const mod = await import('./Oauth-handler.js');
    const handleGitHubCallback: (c: string) => Promise<OAuthResult> =
      (mod as any).handleGitHubCallback ?? (mod as any).default;

    if (typeof handleGitHubCallback !== 'function') {
      throw new Error('handleGitHubCallback not exported from ./Oauth-handler.js');
    }

    const result = await handleGitHubCallback(code);

    if (result.success) {
      // TODO: set a real session/JWT cookie here (HttpOnly, Secure in prod)
      // res.cookie('session', token, { httpOnly: true, sameSite: 'lax', secure: true });

      // Dev experience: just bounce to the frontend with a success flag
      const dest = new URL('/auth/signed-in', FRONTEND_URL);
      dest.searchParams.set('u', result.user.username);
      res.redirect(dest.toString());
    } else {
      const dest = new URL('/auth/error', FRONTEND_URL);
      dest.searchParams.set('m', result.error ?? 'OAuth failed');
      res.redirect(dest.toString());
    }
  } catch (err) {
    console.error(err);
    const dest = new URL('/auth/error', FRONTEND_URL);
    dest.searchParams.set('m', 'Server error');
    res.redirect(dest.toString());
  }
};
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
