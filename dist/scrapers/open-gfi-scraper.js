import { graphql } from "@octokit/graphql";
import * as fs from "node:fs";
import * as path from "node:path";
import dotenv from "dotenv";
// Load environment variables
dotenv.config();
if (!process.env.GITHUB_TOKEN) {
    console.error("❌ Error: GITHUB_TOKEN not found in environment variables!");
    console.error("Please create a .env file with: GITHUB_TOKEN=your_token_here");
    process.exit(1);
}
// Initialize GraphQL client
const graphqlWithAuth = graphql.defaults({
    headers: { authorization: `token ${process.env.GITHUB_TOKEN}` },
});
// Helper: sleep function
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
// Robust GraphQL wrapper with retry logic for various error types
async function graphqlWithBackoff(query, variables, maxRetries = 3) {
    let delay = 1000;
    const maxDelay = 60_000;
    let retries = 0;
    while (retries < maxRetries) {
        try {
            const result = await graphqlWithAuth(query, variables);
            if (!result) {
                throw new Error('Received undefined/null response from GitHub API');
            }
            return result;
        }
        catch (err) {
            const status = err?.status || err?.response?.status;
            const msg = String(err?.message || "");
            const retryAfter = Number(err?.response?.headers?.["retry-after"]) || 0;
            // Handle 502 Bad Gateway and 504 Timeout errors
            if (status === 502 || status === 504) {
                retries++;
                if (retries >= maxRetries) {
                    console.error(`❌ GitHub server error (${status}) after ${maxRetries} retries`);
                    throw err;
                }
                console.warn(`⚠️ GitHub server error (${status}). Retry ${retries}/${maxRetries} in 3s...`);
                await sleep(3000);
                continue;
            }
            // Handle secondary rate limits
            if (status === 403 && /secondary rate limit/i.test(msg)) {
                const wait = Math.max(retryAfter * 1000, delay);
                const jitter = Math.floor(Math.random() * 500);
                const total = wait + jitter;
                console.warn(`⏳ Secondary rate limit hit. Waiting ${Math.ceil(total / 1000)}s...`);
                await sleep(total);
                delay = Math.min(delay * 2, maxDelay);
                retries++;
                continue;
            }
            throw err;
        }
    }
    throw new Error(`Failed after ${maxRetries} retries`);
}
class OpenGFIScraper {
    issues = [];
    outputDir = "./data/scraped/open_gfi_issues";
    // Popular repos to search
    TARGET_REPOS = [
        { owner: "microsoft", repo: "vscode" },
        { owner: "facebook", repo: "react" },
        { owner: "vercel", repo: "next.js" },
        { owner: "golang", repo: "go" },
        { owner: "rust-lang", repo: "rust" },
        { owner: "python", repo: "cpython" },
        { owner: "nodejs", repo: "node" },
        { owner: "kubernetes", repo: "kubernetes" },
        { owner: "tensorflow", repo: "tensorflow" },
        { owner: "pytorch", repo: "pytorch" },
        { owner: "django", repo: "django" },
        { owner: "rails", repo: "rails" },
        { owner: "expressjs", repo: "express" },
        { owner: "vuejs", repo: "core" },
        { owner: "sveltejs", repo: "svelte" },
        { owner: "docker", repo: "docker-ce" },
        { owner: "elastic", repo: "elasticsearch" },
        { owner: "grafana", repo: "grafana" },
        { owner: "pandas-dev", repo: "pandas" },
        { owner: "numpy", repo: "numpy" },
        { owner: "scikit-learn", repo: "scikit-learn" },
        { owner: "jupyter", repo: "notebook" },
        { owner: "home-assistant", repo: "core" },
        { owner: "freeCodeCamp", repo: "freeCodeCamp" },
        { owner: "electron", repo: "electron" },
        { owner: "flutter", repo: "flutter" },
    ];
    constructor() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }
    // Search for open GFI issues across all GitHub with topics and languages
    async searchGlobalGFIIssues(maxResults = 500) {
        console.log(`\n🌍 Searching for open GFI issues across all GitHub (max ${maxResults})...`);
        // Query includes languages now
        const query = `
      query SearchGFIIssues($queryStr: String!, $cursor: String) {
        search(query: $queryStr, type: ISSUE, first: 50, after: $cursor) {
          issueCount
          pageInfo { hasNextPage endCursor }
          nodes {
            ... on Issue {
              repository {
                name
                owner { login }
                stargazerCount
                primaryLanguage { name }
                languages(first: 20, orderBy: {field: SIZE, direction: DESC}) { 
                  totalSize
                  edges {
                    node { name }
                    size
                  }
                }
                repositoryTopics(first: 10) { 
                  nodes { 
                    topic { name } 
                  } 
                }
              }
              number
              title
              body
              createdAt
              updatedAt
              labels(first: 10) { 
                nodes { name } 
              }
              comments { totalCount }
              assignees { totalCount }
              participants { totalCount }
              url
            }
          }
        }
      }
    `;
        const searchQuery = 'label:"good first issue" state:open sort:updated-desc';
        let cursor = null;
        let totalFetched = 0;
        let consecutiveErrors = 0;
        while (totalFetched < maxResults) {
            try {
                const result = await graphqlWithBackoff(query, { queryStr: searchQuery, cursor });
                if (!result || !result.search) {
                    console.warn("⚠️ Unexpected response structure, retrying...");
                    consecutiveErrors++;
                    if (consecutiveErrors >= 3) {
                        console.error("❌ Too many consecutive errors, stopping search");
                        break;
                    }
                    await sleep(2000);
                    continue;
                }
                consecutiveErrors = 0;
                const nodes = result.search?.nodes || [];
                for (const issue of nodes) {
                    if (!issue?.repository)
                        continue;
                    // Extract topics from repository
                    const repoTopics = issue.repository.repositoryTopics?.nodes
                        ?.map((n) => n?.topic?.name)
                        .filter(Boolean) ?? [];
                    // Extract primary language
                    const primaryLanguage = issue.repository.primaryLanguage?.name || null;
                    // Extract all languages with percentages
                    const languages = this.processLanguages(issue.repository.languages);
                    const openIssue = this.processOpenIssue(issue, undefined, undefined, repoTopics, primaryLanguage, languages);
                    this.issues.push(openIssue);
                    totalFetched++;
                    if (totalFetched >= maxResults)
                        break;
                }
                console.log(`  Fetched ${totalFetched} issues so far...`);
                if (!result.search.pageInfo?.hasNextPage || totalFetched >= maxResults)
                    break;
                cursor = result.search.pageInfo?.endCursor || null;
                // Longer delay to avoid rate limits
                await sleep(2000);
            }
            catch (error) {
                console.error(`\n❌ Error during search: ${error.message}`);
                consecutiveErrors++;
                if (consecutiveErrors >= 3) {
                    console.error("Too many errors, stopping search");
                    break;
                }
                console.log("Waiting 5 seconds before retry...");
                await sleep(5000);
            }
        }
        console.log(`✅ Found ${totalFetched} open GFI issues globally`);
    }
    // Helper to process languages and calculate percentages
    processLanguages(languagesData) {
        if (!languagesData || !languagesData.edges)
            return [];
        const totalSize = languagesData.totalSize || 0;
        if (totalSize === 0)
            return [];
        return languagesData.edges
            .map((edge) => ({
            name: edge.node?.name || 'Unknown',
            percentage: Math.round((edge.size / totalSize) * 1000) / 10 // Round to 1 decimal
        }))
            .filter((lang) => lang.percentage > 0); // Only include languages with >0%
    }
    // Fetch from specific repositories with topics and languages
    async fetchFromTargetRepos() {
        console.log("\n📦 Fetching open GFI issues from target repositories...\n");
        for (const target of this.TARGET_REPOS) {
            try {
                await this.fetchRepoOpenGFIIssues(target.owner, target.repo);
            }
            catch (error) {
                console.error(`Error fetching ${target.owner}/${target.repo}:`, error);
                continue;
            }
        }
    }
    // Fetch from a specific repository with topics and languages
    async fetchRepoOpenGFIIssues(owner, repo) {
        console.log(`  Checking ${owner}/${repo}...`);
        const query = `
      query GetOpenGFIIssues($owner: String!, $repo: String!, $cursor: String) {
        repository(owner: $owner, name: $repo) {
          primaryLanguage { name }
          languages(first: 20, orderBy: {field: SIZE, direction: DESC}) { 
            totalSize
            edges {
              node { name }
              size
            }
          }
          repositoryTopics(first: 10) { 
            nodes { 
              topic { name } 
            } 
          }
          issues(
            first: 50
            after: $cursor
            states: OPEN
            filterBy: { labels: ["good first issue"] }
            orderBy: { field: CREATED_AT, direction: DESC }
          ) {
            pageInfo { hasNextPage endCursor }
            totalCount
            nodes {
              number
              title
              body
              createdAt
              updatedAt
              labels(first: 10) { nodes { name } }
              comments { totalCount }
              assignees { totalCount }
              participants { totalCount }
              url
            }
          }
        }
      }
    `;
        let cursor = null;
        let repoIssueCount = 0;
        try {
            const result = await graphqlWithBackoff(query, { owner, repo, cursor });
            if (!result?.repository?.issues) {
                console.log(`    ⚠️ Could not access repository or issues`);
                return;
            }
            if (result.repository.issues.totalCount === 0) {
                console.log(`    No open GFI issues found`);
                return;
            }
            console.log(`    Found ${result.repository.issues.totalCount} open GFI issues`);
            // Extract repository data
            const repoTopics = result.repository.repositoryTopics?.nodes
                ?.map((n) => n?.topic?.name)
                .filter(Boolean) ?? [];
            const primaryLanguage = result.repository.primaryLanguage?.name || null;
            const languages = this.processLanguages(result.repository.languages);
            let hasNextPage = true;
            while (hasNextPage) {
                const pageResult = cursor
                    ? await graphqlWithBackoff(query, { owner, repo, cursor })
                    : result;
                if (!pageResult?.repository?.issues) {
                    console.warn(`    ⚠️ Unexpected response structure, skipping remaining pages`);
                    break;
                }
                const nodes = pageResult.repository.issues.nodes || [];
                for (const issue of nodes) {
                    const openIssue = this.processOpenIssue(issue, owner, repo, repoTopics, primaryLanguage, languages);
                    this.issues.push(openIssue);
                    repoIssueCount++;
                }
                hasNextPage = pageResult.repository.issues.pageInfo?.hasNextPage || false;
                cursor = pageResult.repository.issues.pageInfo?.endCursor || null;
                if (!hasNextPage)
                    break;
                await sleep(2000);
            }
            console.log(`    ✓ Collected ${repoIssueCount} issues`);
        }
        catch (error) {
            console.error(`    ❌ Error: ${error.message || error}`);
        }
    }
    // Process issue with topics and languages
    processOpenIssue(issue, owner, repo, repoTopics, primaryLanguage, languages) {
        const repoOwner = owner || issue.repository?.owner?.login || "unknown";
        const repoName = repo || issue.repository?.name || "unknown";
        const createdDate = new Date(issue.createdAt);
        const now = new Date();
        const daysOpen = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
        const labels = issue.labels?.nodes?.map((label) => label.name) || [];
        // Get topics from passed parameter or from issue repository
        const topics = repoTopics ??
            (issue.repository?.repositoryTopics?.nodes || [])
                .map((n) => n?.topic?.name)
                .filter(Boolean) ?? [];
        // Get primary language from passed parameter or from issue repository
        const mainLanguage = primaryLanguage ??
            issue.repository?.primaryLanguage?.name ?? null;
        // Get languages from passed parameter or process from issue repository
        const repoLanguages = languages ??
            this.processLanguages(issue.repository?.languages) ?? [];
        return {
            repo_owner: repoOwner,
            repo_name: repoName,
            issue_number: issue.number,
            title: issue.title || "",
            body: issue.body || "",
            labels,
            created_at: issue.createdAt,
            updated_at: issue.updatedAt,
            num_comments: issue.comments?.totalCount || 0,
            has_gfi_label: true,
            url: issue.url || `https://github.com/${repoOwner}/${repoName}/issues/${issue.number}`,
            days_open: daysOpen,
            assignees: issue.assignees?.totalCount || 0,
            participants: issue.participants?.totalCount || 0,
            repo_topics: topics,
            primary_language: mainLanguage,
            languages: repoLanguages
        };
    }
    // Save to JSON
    saveToJSON() {
        const timestamp = new Date().toISOString().split("T")[0];
        const filename = `open_gfi_issues_${timestamp}.json`;
        const filepath = path.join(this.outputDir, filename);
        const latestPath = path.join(this.outputDir, "open_gfi_issues_latest.json");
        const data = {
            metadata: {
                total_issues: this.issues.length,
                scraped_at: new Date().toISOString(),
                repos_checked: this.TARGET_REPOS.length,
                unique_repos: new Set(this.issues.map((i) => `${i.repo_owner}/${i.repo_name}`)).size,
            },
            issues: this.issues,
        };
        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        fs.writeFileSync(latestPath, JSON.stringify(data, null, 2));
        console.log(`\n💾 Data saved to:`);
        console.log(`   - ${filepath}`);
        console.log(`   - ${latestPath}`);
    }
    // Print summary
    printSummary() {
        console.log("\n📊 SUMMARY");
        console.log("═".repeat(50));
        console.log(`Total open GFI issues collected: ${this.issues.length}`);
        const byRepo = new Map();
        for (const issue of this.issues) {
            const key = `${issue.repo_owner}/${issue.repo_name}`;
            byRepo.set(key, (byRepo.get(key) || 0) + 1);
        }
        const sortedRepos = Array.from(byRepo.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
        console.log("\nTop 10 repositories by issue count:");
        for (const [repo, count] of sortedRepos) {
            console.log(`  ${repo}: ${count} issues`);
        }
        const ageGroups = { "< 7 days": 0, "7-30 days": 0, "30-90 days": 0, "> 90 days": 0 };
        for (const issue of this.issues) {
            if (issue.days_open < 7)
                ageGroups["< 7 days"]++;
            else if (issue.days_open <= 30)
                ageGroups["7-30 days"]++;
            else if (issue.days_open <= 90)
                ageGroups["30-90 days"]++;
            else
                ageGroups["> 90 days"]++;
        }
        console.log("\nIssue age distribution:");
        for (const [group, count] of Object.entries(ageGroups)) {
            const pct = this.issues.length ? ((count / this.issues.length) * 100).toFixed(1) : "0.0";
            console.log(`  ${group}: ${count} issues (${pct}%)`);
        }
        const noComments = this.issues.filter((i) => i.num_comments === 0).length;
        const hasAssignee = this.issues.filter((i) => i.assignees > 0).length;
        const pctNo = this.issues.length ? ((noComments / this.issues.length) * 100).toFixed(1) : "0.0";
        const pctAsg = this.issues.length ? ((hasAssignee / this.issues.length) * 100).toFixed(1) : "0.0";
        console.log("\nActivity metrics:");
        console.log(`  Issues with no comments: ${noComments} (${pctNo}%)`);
        console.log(`  Issues with assignees: ${hasAssignee} (${pctAsg}%)`);
        // Show topic distribution
        const topicCounts = new Map();
        for (const issue of this.issues) {
            for (const topic of issue.repo_topics || []) {
                topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
            }
        }
        const topTopics = Array.from(topicCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        if (topTopics.length > 0) {
            console.log("\nTop 10 repository topics:");
            for (const [topic, count] of topTopics) {
                console.log(`  ${topic}: ${count} issues`);
            }
        }
        // Show language distribution
        const languageCounts = new Map();
        for (const issue of this.issues) {
            if (issue.primary_language) {
                languageCounts.set(issue.primary_language, (languageCounts.get(issue.primary_language) || 0) + 1);
            }
        }
        const topLanguages = Array.from(languageCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
        if (topLanguages.length > 0) {
            console.log("\nTop 10 primary programming languages:");
            for (const [lang, count] of topLanguages) {
                const pct = ((count / this.issues.length) * 100).toFixed(1);
                console.log(`  ${lang}: ${count} issues (${pct}%)`);
            }
        }
    }
    // Check rate limit
    async checkRateLimit() {
        const query = `
      query {
        rateLimit { limit cost remaining resetAt }
      }
    `;
        try {
            const result = await graphqlWithBackoff(query, {});
            console.log(`\n📊 API Rate Limit: ${result.rateLimit.remaining}/${result.rateLimit.limit} remaining`);
            console.log(`   Resets at: ${new Date(result.rateLimit.resetAt).toLocaleString()}`);
        }
        catch (error) {
            console.error("Error checking rate limit:", error);
        }
    }
}
// Main execution
async function main() {
    console.log("🔍 GitHub Open GFI Issues Scraper (with Topics)");
    console.log("═".repeat(50));
    console.log('This scraper collects open "good first issue" labeled issues');
    console.log("with repository topics for ML model prediction.\n");
    const scraper = new OpenGFIScraper();
    await scraper.checkRateLimit();
    // Option 1: Global search (recommended)
    await scraper.searchGlobalGFIIssues(1000);
    // Option 2: Target specific repositories
    // await scraper.fetchFromTargetRepos();
    // Option 3: Both
    // await scraper.searchGlobalGFIIssues(500);
    // await scraper.fetchFromTargetRepos();
    scraper.saveToJSON();
    scraper.printSummary();
    await scraper.checkRateLimit();
    console.log("\n✅ Scraping complete!");
    console.log("📁 Output saved to: ./open_gfi_issues/open_gfi_issues_latest.json");
    console.log("\nNext step: Feed this JSON to your trained ML model for predictions!");
}
main().catch(console.error);
//# sourceMappingURL=open-gfi-scraper.js.map