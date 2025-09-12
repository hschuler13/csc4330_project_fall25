// @ts-ignore
const fetch = globalThis.fetch || require('node-fetch');
// Simple GitHub REST API scraper to test fetching user data

// Define types for the GitHub API responses
interface GitHubUser {
  login: string;
  name: string;
  bio: string;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
  avatar_url: string;
}

interface GitHubRepo {
  name: string;
  full_name: string;
  description: string;
  language: string;
  stargazers_count: number;
  fork: boolean;
  updated_at: string;
  has_issues: boolean;
  open_issues_count: number;
  topics: string[];  // Added for topics
}

interface LanguageData {
  [language: string]: number;
}

// Main scraper class
class GitHubScraper {
  private baseURL = 'https://api.github.com';
  
  // Fetch user profile
  async getUserProfile(username: string): Promise<GitHubUser> {
    try {
      const response = await fetch(`${this.baseURL}/users/${username}`);
      
      if (!response.ok) {
        throw new Error(`Error fetching user: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      throw error;
    }
  }
  
  // Fetch user's top repositories
  async getUserRepos(username: string, limit: number = 10): Promise<GitHubRepo[]> {
    try {
      const response = await fetch(
        `${this.baseURL}/users/${username}/repos?sort=updated&per_page=${limit}`
      );
      
      if (!response.ok) {
        throw new Error(`Error fetching repos: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching repos:', error);
      throw error;
    }
  }
  
  // Fetch languages for a specific repo
  async getRepoLanguages(owner: string, repo: string): Promise<LanguageData> {
    try {
      const response = await fetch(
        `${this.baseURL}/repos/${owner}/${repo}/languages`
      );
      
      if (!response.ok) {
        throw new Error(`Error fetching languages: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching languages:', error);
      throw error;
    }
  }
  
  // Fetch user's pull requests
  async getUserPullRequests(username: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseURL}/search/issues?q=author:${username}+type:pr&per_page=10`
      );
      
      if (!response.ok) {
        throw new Error(`Error fetching PRs: ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching PRs:', error);
      throw error;
    }
  }
  
  // Main method to scrape all data for a user
  async scrapeUserData(username: string) {
    console.log(`\n Scraping GitHub data for: ${username}\n`);
    console.log('='.repeat(50));
    
    // 1. Get user profile
    console.log('\n USER PROFILE:');
    const user = await this.getUserProfile(username);
    console.log(`- Name: ${user.name || user.login}`);
    console.log(`- Bio: ${user.bio ? user.bio : 'Not available'}`);
    console.log(`- Avatar: ${user.avatar_url}`);
    console.log(`- Public Repos: ${user.public_repos}`);
    console.log(`- Followers: ${user.followers}`);
    console.log(`- Account Created: ${new Date(user.created_at).toLocaleDateString()}`);
    
    // 2. Get top 10 repositories
    console.log('\n TOP 10 REPOSITORIES:');
    const repos = await this.getUserRepos(username, 10);
    
    // Track all topics from repos
    const allTopics: { [topic: string]: number } = {};
    
    for (const repo of repos) {
      console.log(`\n  ${repo.name}:`);
      console.log(`  - Primary Language: ${repo.language || 'Not specified'}`);
      console.log(`  - Stars: ${repo.stargazers_count}`);
      console.log(`  - Author: ${repo.fork ? 'Others (forked)' : 'Original author'}`);
      console.log(`  - Last Updated: ${new Date(repo.updated_at).toLocaleDateString()}`);
      
      // Display topics for this repo
      if (repo.topics && repo.topics.length > 0) {
        console.log(`  - Topics: ${repo.topics.join(', ')}`);
        
        // Collect topics from non-forked repos
        if (!repo.fork) {
          repo.topics.forEach(topic => {
            allTopics[topic] = (allTopics[topic] || 0) + 1;
          });
        }
      }
      
      if (!repo.fork) { // Skip language analysis for forked repos
      const languages = await this.getRepoLanguages(username, repo.name);
  
        // Check if languages object is empty
      if (Object.keys(languages).length === 0) {
          console.log('  - Language Breakdown: No languages detected yet');
      } else {
        const totalBytes = Object.values(languages).reduce((a, b) => a + b, 0);
          
        console.log('  - Language Breakdown:');
        for (const [lang, bytes] of Object.entries(languages)) {
        const percentageNum = (bytes / totalBytes) * 100;
        const percentage = percentageNum < 0.01 ? percentageNum.toFixed(4) 
            : parseFloat(percentageNum.toFixed(2)).toString();
            console.log(`    • ${lang}: ${percentage}%`);
          }
        }
      }
    }
    
    // 4. Get recent pull requests
    console.log('\n RECENT PULL REQUESTS:');
    const prData = await this.getUserPullRequests(username);
    console.log(`- Total PRs found: ${prData.total_count}`);
    
    if (prData.items && prData.items.length > 0) {
      console.log('- Recent PRs:');
      prData.items.slice(0, 5).forEach((pr: any) => {
        console.log(`  • ${pr.title}`);
        console.log(`    Repository: ${pr.repository_url.split('/').slice(-2).join('/')}`);
        console.log(`    State: ${pr.state}`);
      });
    }
    
    // 5. Calculate derived metrics
    console.log('\n DERIVED METRICS FOR MATCHING:');
    
    // Calculate primary languages
    const languageCounts: { [key: string]: number } = {};
    for (const repo of repos) {
      if (repo.language && !repo.fork) {
        languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
      }
    }
    
    const primaryLanguages = Object.entries(languageCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([lang]) => lang);
    
    console.log(`- Primary Languages: ${primaryLanguages.join(', ') || 'None detected'}`);
    
    // Display top topics
    const topTopics = Object.entries(allTopics)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([topic]) => topic);
    
    console.log(`- Main Topics/Interests: ${topTopics.join(', ') || 'No topics specified'}`);
    
    // Determine activity level
    const lastUpdate = repos[0]?.updated_at;
    const daysSinceUpdate = lastUpdate 
      ? Math.floor((Date.now() - new Date(lastUpdate).getTime()) / (1000 * 60 * 60 * 24))
      : null;
    
    let activityLevel = 'Unknown';
    if (daysSinceUpdate !== null) {
      if (daysSinceUpdate < 7) activityLevel = 'Very Active';
      else if (daysSinceUpdate < 30) activityLevel = 'Active';
      else if (daysSinceUpdate < 90) activityLevel = 'Moderate';
      else activityLevel = 'Inactive';
    }
    
    console.log(`- Activity Level: ${activityLevel} (${daysSinceUpdate} days since last update)`);
    
    // Determine experience level
    const accountAge = Math.floor(
      (Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24 * 365)
    );
    
    let experienceLevel = 'Beginner';
    if (accountAge > 5 && user.public_repos > 20 && prData.total_count > 10) {
      experienceLevel = 'Advanced';
    } else if (accountAge > 2 && user.public_repos > 5 && prData.total_count > 0) {
      experienceLevel = 'Intermediate';
    }
    
    console.log(`- Estimated Experience: ${experienceLevel}`);
    console.log(`  (${accountAge} years on GitHub, ${user.public_repos} repos, ${prData.total_count} PRs)`);
    
    console.log('\n' + '='.repeat(50));
    console.log(' Scraping complete!\n');
  }
}

// Run the scraper
async function main() {
  const scraper = new GitHubScraper();
  
  try {
    await scraper.scrapeUserData('torvalds');
  } catch (error) {
    console.error('Failed to scrape data:', error);
  }
}

main();