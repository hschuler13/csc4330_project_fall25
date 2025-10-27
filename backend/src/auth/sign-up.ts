// github-auth.ts
// Backend logic for GitHub SSO
require('dotenv').config();

// GitHub OAuth Configuration
const GITHUB_CONFIG = {
  CLIENT_ID: process.env.GITHUB_CLIENT_ID || 'YOUR_CLIENT_ID',
  CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
  REDIRECT_URI: process.env.REDIRECT_URI || 'http://localhost:3000/callback'
};

// Types
interface GitHubAccessTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  email: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

// Step 1: Exchange authorization code for access token
async function exchangeCodeForAccessToken(code: string): Promise<string> {
  const tokenUrl = 'https://github.com/login/oauth/access_token';
  
  const params = new URLSearchParams({
    client_id: GITHUB_CONFIG.CLIENT_ID,
    client_secret: GITHUB_CONFIG.CLIENT_SECRET,
    code: code,
    redirect_uri: GITHUB_CONFIG.REDIRECT_URI
  });

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    if (!response.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const data = await response.json() as GitHubAccessTokenResponse;
    return data.access_token;
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    throw error;
  }
}

// Step 2: Get user data from GitHub
async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user data');
    }

    return await response.json() as GitHubUser;
  } catch (error) {
    console.error('Error fetching GitHub user:', error);
    throw error;
  }
}

// Step 3: Get user's primary email (if not public)
async function getGitHubUserEmails(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://api.github.com/user/emails', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return null;
    }

    const emails = await response.json() as GitHubEmail[];
    const primaryEmail = emails.find(email => email.primary && email.verified);
    
    return primaryEmail ? primaryEmail.email : null;
  } catch (error) {
    console.error('Error fetching user emails:', error);
    return null;
  }
}

// Main handler for GitHub OAuth callback
async function handleGitHubCallback(code: string) {
  try {
    // Step 1: Exchange code for access token
    const accessToken = await exchangeCodeForAccessToken(code);
    
    // Step 2: Get user data
    const githubUser = await getGitHubUser(accessToken);
    
    // Step 3: Get email if not public
    let email = githubUser.email;
    if (!email) {
      email = await getGitHubUserEmails(accessToken);
    }
    
    // Step 4: Create or update user in your database
    const userData = {
      githubId: githubUser.id,
      username: githubUser.login,
      email: email,
      name: githubUser.name,
      avatarUrl: githubUser.avatar_url,
      bio: githubUser.bio,
      publicRepos: githubUser.public_repos,
      followers: githubUser.followers,
      following: githubUser.following,
      githubCreatedAt: githubUser.created_at,
      accessToken: accessToken, // Store encrypted in production!
      lastLogin: new Date().toISOString()
    };
    
    // TODO: Save to your database
    // const user = await saveOrUpdateUser(userData);
    console.log('User data to save:', userData);
    
    // Step 5: Create session/JWT token for your app
    const sessionToken = generateSessionToken(userData);
    
    return {
      success: true,
      user: {
        id: githubUser.id,
        username: githubUser.login,
        email: email,
        name: githubUser.name,
        avatarUrl: githubUser.avatar_url
      },
      token: sessionToken
    };
    
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

// Generate a session token (simplified - use JWT in production)
function generateSessionToken(user: any): string {
  // TODO: In production, use JWT (jsonwebtoken package)
  // Example: jwt.sign({ userId: user.githubId }, SECRET, { expiresIn: '7d' })
  
  // For now, just return a simple token
  return Buffer.from(JSON.stringify({
    userId: user.githubId,
    username: user.username,
    timestamp: Date.now()
  })).toString('base64');
}

// Express route handler example
async function githubCallbackRoute(req: any, res: any) {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }
  
  const result = await handleGitHubCallback(code);
  
  if (result.success) {
    res.json(result);
  } else {
    res.status(401).json({ error: result.error });
  }
}

// Database placeholder functions
async function saveOrUpdateUser(userData: any) {
  // TODO: Implement your database logic
  // Example with MongoDB:
  /*
  const existingUser = await User.findOne({ githubId: userData.githubId });
  
  if (existingUser) {
    // Update existing user
    return await User.findOneAndUpdate(
      { githubId: userData.githubId },
      userData,
      { new: true }
    );
  } else {
    // Create new user
    return await User.create(userData);
  }
  */
  
  console.log('TODO: Save user to database', userData);
  return userData;
}

// Export for use in your Express app
module.exports = {
  handleGitHubCallback,
  githubCallbackRoute,
  exchangeCodeForAccessToken,
  getGitHubUser,
  getGitHubUserEmails
};

/* 
SETUP INSTRUCTIONS:

1. Create a GitHub OAuth App:
   - Go to GitHub Settings > Developer settings > OAuth Apps
   - Click "New OAuth App"
   - Fill in:
     - Application name: Your app name
     - Homepage URL: http://localhost:3000
     - Authorization callback URL: http://localhost:3000/callback
   - Save and copy the Client ID and Client Secret

2. Set environment variables:
   GITHUB_CLIENT_ID=your_client_id_here
   GITHUB_CLIENT_SECRET=your_client_secret_here
   REDIRECT_URI=http://localhost:3000/callback

3. In your Express app:
   app.post('/api/auth/github/callback', githubCallbackRoute);

4. Install required packages:
   npm install node-fetch
   npm install jsonwebtoken (for JWT tokens)
   npm install bcrypt (if you need password hashing elsewhere)
*/