// github-oauth-handler.ts
// OAuth handler that integrates with the GitHub scraper

import dotenv from 'dotenv';
import { GitHubScraper, type ScrapedUserProfile } from './github-scrapper.js';

dotenv.config();

// GitHub OAuth Configuration
const GITHUB_CONFIG = {
  CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
  CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || '',
  REDIRECT_URI: process.env.REDIRECT_URI || 'http://localhost:3000/callback'
};

// Types
interface GitHubAccessTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

// Complete user data combining OAuth and scraped data
export interface CompleteUserProfile {
  // From OAuth
  githubId: number;
  email: string | null;
  accessToken: string;
  
  // From Scraper
  username: string;
  name: string | null;
  avatarUrl: string;
  bio: string | null;
  followers: number;
  following: number;
  publicRepos: number;
  
  // Scraped metrics
  primaryLanguages: string[];
  topTopics: string[];
  experienceLevel: string;
  activityLevel: string;
  accountAgeYears: number;
  totalPRs: number;
  
  // Top repositories summary
  topRepos: {
    name: string;
    language: string | null;
    stars: number;
    isForked: boolean;
  }[];
  
  // Metadata
  createdAt: string;
  lastLogin: string;
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

// Step 2: Get user's primary email (if not public)
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

// Step 3: Get basic user data from OAuth
async function getBasicGitHubUser(accessToken: string): Promise<any> {
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

    return await response.json();
  } catch (error) {
    console.error('Error fetching GitHub user:', error);
    throw error;
  }
}

// Main handler for GitHub OAuth callback - NOW WITH SCRAPER
export async function handleGitHubCallback(code: string): Promise<{
  success: boolean;
  user?: CompleteUserProfile;
  error?: string;
}> {
  try {
    console.log('Step 1: Exchanging code for access token...');
    const accessToken = await exchangeCodeForAccessToken(code);
    
    console.log('Step 2: Getting basic user data from OAuth...');
    const basicUser = await getBasicGitHubUser(accessToken);
    
    console.log('Step 3: Getting user email...');
    let email = basicUser.email;
    if (!email) {
      email = await getGitHubUserEmails(accessToken);
    }
    
    console.log('Step 4: Running detailed GitHub scraper...');
    // Initialize scraper with access token for better rate limits
    const scraper = new GitHubScraper(accessToken);
    const scrapedData = await scraper.scrapeUserData(basicUser.login, accessToken);
    
    console.log('Step 5: Combining all data...');
    // Combine OAuth data with scraped data
    const completeProfile: CompleteUserProfile = {
      // OAuth data
      githubId: basicUser.id,
      email: email,
      accessToken: accessToken, // In production, encrypt this!
      
      // Basic profile from scraper
      username: scrapedData.user.login,
      name: scrapedData.user.name,
      avatarUrl: scrapedData.user.avatar_url,
      bio: scrapedData.user.bio,
      followers: scrapedData.user.followers,
      following: scrapedData.user.following,
      publicRepos: scrapedData.user.public_repos,
      
      // Scraped metrics
      primaryLanguages: scrapedData.metrics.primaryLanguages,
      topTopics: scrapedData.metrics.topTopics,
      experienceLevel: scrapedData.metrics.experienceLevel,
      activityLevel: scrapedData.metrics.activityLevel,
      accountAgeYears: scrapedData.metrics.accountAgeYears,
      totalPRs: scrapedData.pullRequests.total,
      
      // Top 5 repos summary
      topRepos: scrapedData.repos.slice(0, 5).map((repo: any) => ({
        name: repo.name,
        language: repo.language,
        stars: repo.stars,
        isForked: repo.isForked
      })),
      
      // Metadata
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    };
    
    console.log('Step 6: Ready to save to database...');
    // TODO: Save completeProfile to your database here
    // await saveUserToDatabase(completeProfile);
    
    console.log('✅ User profile complete with all GitHub data!');
    console.log(`- Username: ${completeProfile.username}`);
    console.log(`- Experience: ${completeProfile.experienceLevel}`);
    console.log(`- Languages: ${completeProfile.primaryLanguages.join(', ')}`);
    console.log(`- Activity: ${completeProfile.activityLevel}`);
    
    return {
      success: true,
      user: completeProfile
    };
    
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

// Express route handler example
export async function githubCallbackRoute(req: any, res: any) {
  const { code } = req.body || req.query;
  
  if (!code) {
    return res.status(400).json({ error: 'No authorization code provided' });
  }
  
  const result = await handleGitHubCallback(code);
  
  if (result.success) {
    // In production, don't send the access token to frontend
    const { accessToken, ...safeUserData } = result.user!;
    
    res.json({
      success: true,
      user: safeUserData,
      message: 'Login successful!'
    });
  } else {
    res.status(401).json({ error: result.error });
  }
}

// Export for use in your Express app
export default {
  handleGitHubCallback,
  githubCallbackRoute
};