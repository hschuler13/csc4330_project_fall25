import { graphql } from "@octokit/graphql";
import * as fs from 'node:fs';
import * as path from 'node:path';
import dotenv from 'dotenv';
// Load environment variables from .env file
dotenv.config();
// Check if token exists
if (!process.env.GITHUB_TOKEN) {
    console.error('❌ Error: GITHUB_TOKEN not found in environment variables!');
    console.error('Please create a .env file with: GITHUB_TOKEN=your_token_here');
    process.exit(1);
}
// Initialize GraphQL client with authentication
const graphqlWithAuth = graphql.defaults({
    headers: {
        authorization: `token ${process.env.GITHUB_TOKEN}`,
    },
});
// Target repositories to scrape
const TARGET_REPOS = [
    { owner: 'microsoft', repo: 'vscode' },
    { owner: 'facebook', repo: 'react' },
    { owner: 'tensorflow', repo: 'tensorflow' },
    { owner: 'kubernetes', repo: 'kubernetes' },
    { owner: 'pytorch', repo: 'pytorch' },
    { owner: 'rust-lang', repo: 'rust' },
    { owner: 'pandas-dev', repo: 'pandas' },
    { owner: 'scikit-learn', repo: 'scikit-learn' },
    { owner: 'elastic', repo: 'elasticsearch' },
    { owner: 'home-assistant', repo: 'core' }
];
class GFIScraperGraphQL {
    // === Storage: deduped via Map ===
    closedIssuesMap = new Map();
    issueKey = (owner, repo, num) => `${owner}/${repo}#${num}`;
    repoStats = new Map();
    outputDir = './scraped_data_graphql';
    // For has_gfi_label feature only (we now query only the exact label)
    gfiLabelVariations = [
        'good first issue',
        'good-first-issue',
        'goodfirstissue',
        'beginner',
        'beginner friendly',
        'beginner-friendly',
        'easy',
        'starter',
        'first-timers-only',
        'first timers only'
    ];
    // === Caches ===
    userIdByLogin = new Map(); // login -> userId
    commitCountCache = new Map(); // `${owner}/${repo}|${authorId}|${untilISO}` -> count
    prHumanResolver = new Map(); // `${owner}/${repo}#PR` -> human login or null
    // Bot detection
    KNOWN_BOTS = new Set(["dependabot[bot]", "github-actions[bot]", "renovate[bot]", "mergify[bot]"]);
    isBotLogin = (login) => !!login && (login.endsWith("[bot]") || this.KNOWN_BOTS.has(login));
    constructor() {
        // Create output directory if it doesn't exist
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }
    getClosedIssuesArray() {
        return Array.from(this.closedIssuesMap.values());
    }
    // Main scraping orchestrator
    async scrapeAllRepos() {
        console.log('Starting Enhanced GitHub data scraping with GraphQL...\n');
        console.log('This version uses GraphQL for more accurate resolver detection\n');
        for (const target of TARGET_REPOS) {
            console.log(`\n📊 Processing ${target.owner}/${target.repo}...`);
            try {
                await this.scrapeRepository(target.owner, target.repo);
                // Save progress after each repo
                this.saveProgress();
            }
            catch (error) {
                console.error(`❌ Error processing ${target.owner}/${target.repo}:`, error);
                continue;
            }
        }
        console.log('\n✅ Scraping complete!');
        this.saveFinalDataset();
    }
    // Get repository stats using GraphQL
    async getRepoStats(owner, repo) {
        const query = `
      query GetRepoStats($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          stargazerCount
          diskUsage
          primaryLanguage { name }
          createdAt
          mentionableUsers { totalCount }
        }
      }
    `;
        const result = await graphqlWithAuth(query, { owner, repo });
        return {
            stars: result.repository.stargazerCount,
            size: result.repository.diskUsage,
            language: result.repository.primaryLanguage?.name || null,
            contributor_count: result.repository.mentionableUsers.totalCount,
            created_at: result.repository.createdAt,
            closed_gfi_count: 0
        };
    }
    // Scrape a single repository
    async scrapeRepository(owner, repo) {
        const repoStats = await this.getRepoStats(owner, repo);
        console.log(`  📋 Fetching closed issues with GFI-related labels...`);
        const closedGFIIssues = await this.getClosedGFIIssues(owner, repo);
        console.log(`    Found ${closedGFIIssues.length} closed GFI-related issues`);
        repoStats.closed_gfi_count = closedGFIIssues.length;
        let processedClosed = 0;
        for (const issue of closedGFIIssues) {
            const issueData = await this.processClosedIssue(owner, repo, issue);
            if (issueData) {
                const key = this.issueKey(owner, repo, issueData.issue_number);
                this.closedIssuesMap.set(key, issueData); // idempotent
                processedClosed++;
                if (processedClosed % 10 === 0) {
                    console.log(`    Processed ${processedClosed}/${closedGFIIssues.length} GFI issues...`);
                }
            }
        }
        this.repoStats.set(`${owner}/${repo}`, repoStats);
        console.log(`  ✓ Processed ${processedClosed} closed GFI issues`);
    }
    // Get closed issues with EXACT "good first issue" label
    async getClosedGFIIssues(owner, repo) {
        const allIssues = [];
        const query = `
      query GetClosedGFIIssues($owner: String!, $repo: String!, $cursor: String) {
        repository(owner: $owner, name: $repo) {
          issues(
            first: 100
            after: $cursor
            states: CLOSED
            filterBy: { labels: ["good first issue"] }
            orderBy: { field: UPDATED_AT, direction: DESC }
          ) {
            pageInfo { hasNextPage endCursor }
            nodes {
              number
              title
              body
              state
              createdAt
              closedAt
              author { login }
              labels(first: 10) { nodes { name } }
              comments { totalCount }
              timelineItems(first: 100, itemTypes: [CLOSED_EVENT, CROSS_REFERENCED_EVENT]) {
                nodes {
                  __typename
                  ... on ClosedEvent {
                    createdAt
                    closer {
                      __typename
                      ... on PullRequest {
                        number
                        merged
                        mergedAt
                        author { login }
                      }
                      ... on Commit {
                        oid
                        author { user { login } }
                      }
                    }
                  }
                  ... on CrossReferencedEvent {
                    source {
                      __typename
                      ... on PullRequest {
                        number
                        title
                        body
                        merged
                        mergedAt
                        author { login }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
        let hasNextPage = true;
        let cursor = null;
        while (hasNextPage) {
            try {
                const result = await graphqlWithAuth(query, { owner, repo, cursor });
                if (result?.repository?.issues?.nodes) {
                    allIssues.push(...result.repository.issues.nodes);
                }
                hasNextPage = result?.repository?.issues?.pageInfo?.hasNextPage ?? false;
                cursor = result?.repository?.issues?.pageInfo?.endCursor ?? null;
                await new Promise(resolve => setTimeout(resolve, 100)); // tiny pacing
            }
            catch (error) {
                console.error(`Error fetching issues for ${owner}/${repo}:`, error);
                break;
            }
        }
        // No alternative-label fallback (per your preference)
        // Safety: dedupe by issue number within this fetch
        const unique = Array.from(new Map(allIssues.map(i => [i.number, i])).values());
        return unique;
    }
    // Process a closed issue
    async processClosedIssue(owner, repo, issue) {
        try {
            const createdDate = new Date(issue.createdAt);
            const closedDate = issue.closedAt ? new Date(issue.closedAt) : new Date();
            const daysOpen = Math.floor((closedDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
            const labels = issue.labels.nodes.map((label) => label.name);
            const hasGFILabel = labels.some((label) => this.gfiLabelVariations.some(v => label.toLowerCase().includes(v.toLowerCase())));
            // Find resolver from timeline
            const resolverInfo = await this.findResolverFromTimeline(owner, repo, issue);
            const issueData = {
                repo_owner: owner,
                repo_name: repo,
                issue_number: issue.number,
                title: issue.title || '',
                body: issue.body || '',
                labels,
                state: issue.state,
                created_at: issue.createdAt,
                closed_at: issue.closedAt,
                author: issue.author?.login || 'unknown',
                num_comments: issue.comments.totalCount,
                resolver: resolverInfo?.resolver || null,
                resolver_commit_count_before_resolution: null,
                is_newcomer_resolver: null,
                has_gfi_label: hasGFILabel,
                resolution_pr_number: resolverInfo?.pr_number || null,
                resolution_method: resolverInfo?.method || null,
                days_open: daysOpen,
                confidence_score: resolverInfo?.confidence || null
            };
            // If we found a resolver, get their contribution history (with de-bot handling)
            if (resolverInfo?.resolver) {
                const until = issue.closedAt ?? new Date().toISOString();
                const contributorStats = await this.getContributorStats(owner, repo, resolverInfo.resolver, issue.closedAt, resolverInfo?.pr_number != null ? { prNumber: resolverInfo.pr_number } : undefined);
                issueData.resolver_commit_count_before_resolution = contributorStats.commitCount;
                issueData.is_newcomer_resolver =
                    contributorStats.commitCount === null
                        ? null
                        : contributorStats.commitCount < 3;
            }
            return issueData;
        }
        catch (error) {
            console.error(`Error processing issue #${issue.number}:`, error);
            return null;
        }
    }
    // Find resolver from timeline using GraphQL data
    async findResolverFromTimeline(owner, repo, issue) {
        const timelineItems = issue?.timelineItems?.nodes || [];
        // 1) ClosedEvent with PR (merged)
        for (const item of timelineItems) {
            if (item.__typename === 'ClosedEvent' && item.closer?.__typename === 'PullRequest') {
                const pr = item.closer;
                if (pr.merged) {
                    return {
                        resolver: pr.author?.login || 'unknown',
                        pr_number: pr.number,
                        method: 'pr',
                        confidence: 'high'
                    };
                }
            }
        }
        // 2) Cross-referenced merged PRs; prefer explicit closing keywords
        const referencingPRs = timelineItems
            .filter((it) => it.__typename === 'CrossReferencedEvent' &&
            it.source?.__typename === 'PullRequest' &&
            it.source?.merged)
            .map((it) => it.source);
        if (referencingPRs.length > 0) {
            const fixesRegex = new RegExp(`(close[sd]?|fix(?:e[sd])?|resolve[sd]?)\\s*#${issue.number}\\b`, 'i');
            for (const pr of referencingPRs) {
                const text = `${pr.title ?? ''} ${pr.body ?? ''}`.toLowerCase();
                if (fixesRegex.test(text)) {
                    return {
                        resolver: pr.author?.login || 'unknown',
                        pr_number: pr.number,
                        method: 'pr',
                        confidence: 'high'
                    };
                }
            }
            // fallback: just pick the first merged referencing PR (medium)
            const candidate = referencingPRs[0];
            return {
                resolver: candidate.author?.login || 'unknown',
                pr_number: candidate.number,
                method: 'pr',
                confidence: 'medium'
            };
        }
        // 3) No PRs found — check for ClosedEvent by commit
        for (const item of timelineItems) {
            if (item.__typename === 'ClosedEvent' && item.closer?.__typename === 'Commit') {
                const login = item.closer?.author?.user?.login;
                if (login) {
                    return {
                        resolver: login,
                        pr_number: null,
                        method: 'commit',
                        confidence: 'medium'
                    };
                }
            }
        }
        // 4) Unknown
        return null;
    }
    // Get pull requests that reference an issue (used as fallback earlier)
    async getLinkedPullRequests(owner, repo, issueNumber) {
        const query = `
      query GetLinkedPRs($owner: String!, $repo: String!, $issueNumber: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $issueNumber) {
            timelineItems(first: 100, itemTypes: [CONNECTED_EVENT, DISCONNECTED_EVENT, CROSS_REFERENCED_EVENT]) {
              nodes {
                __typename
                ... on ConnectedEvent {
                  subject {
                    __typename
                    ... on PullRequest {
                      number
                      title
                      merged
                      author { login }
                    }
                  }
                }
                ... on CrossReferencedEvent {
                  source {
                    __typename
                    ... on PullRequest {
                      number
                      title
                      body
                      merged
                      author { login }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
        try {
            const result = await graphqlWithAuth(query, { owner, repo, issueNumber });
            const prs = [];
            for (const item of result.repository.issue.timelineItems.nodes) {
                if (item.__typename === 'ConnectedEvent' && item.subject?.__typename === 'PullRequest') {
                    prs.push(item.subject);
                }
                else if (item.__typename === 'CrossReferencedEvent' && item.source?.__typename === 'PullRequest') {
                    prs.push(item.source);
                }
            }
            return prs;
        }
        catch (error) {
            console.error(`Error getting linked PRs for issue #${issueNumber}:`, error);
            return [];
        }
    }
    // === Step 1 + Step 2 (de-bot): Contributor stats ===
    async getContributorStats(owner, repo, username, beforeDate, // ISO closedAt
    opts) {
        // De-bot: if resolver is a bot, try to map to human via PR commits; else skip
        let loginToCount = username;
        if (this.isBotLogin(username)) {
            const prNum = opts?.prNumber;
            if (prNum) {
                const mapped = await this.mapBotPRToHuman(owner, repo, prNum);
                if (mapped) {
                    loginToCount = mapped;
                }
                else {
                    // Skip newcomer counting for bot with no clear human
                    return { commitCount: null, prCount: 0, firstContributionDate: null };
                }
            }
            else {
                return { commitCount: null, prCount: 0, firstContributionDate: null };
            }
        }
        // 1) Resolve login -> user id (with cache)
        const authorId = await this.getUserId(loginToCount);
        if (!authorId) {
            return { commitCount: 0, prCount: 0, firstContributionDate: null };
        }
        // 2) Count commits on default branch up to closedAt (with cache)
        const until = beforeDate;
        const ccKey = `${owner}/${repo}|${authorId}|${until}`;
        if (this.commitCountCache.has(ccKey)) {
            const cached = this.commitCountCache.get(ccKey);
            const prCount = await this.getUserPRCount(loginToCount);
            return { commitCount: cached, prCount, firstContributionDate: null };
        }
        const historyQuery = `
      query ($owner: String!, $repo: String!, $authorId: ID!, $until: GitTimestamp!) {
        repository(owner: $owner, name: $repo) {
          defaultBranchRef {
            target {
              ... on Commit {
                history(author: { id: $authorId }, until: $until) {
                  totalCount
                }
              }
            }
          }
        }
      }
    `;
        try {
            const histRes = await graphqlWithAuth(historyQuery, {
                owner, repo, authorId, until
            });
            const totalCount = histRes.repository?.defaultBranchRef?.target?.history?.totalCount ?? 0;
            this.commitCountCache.set(ccKey, totalCount);
            // 3) Optional: global PR count for user (cheap)
            const prCount = await this.getUserPRCount(loginToCount);
            return { commitCount: totalCount, prCount, firstContributionDate: null };
        }
        catch (e) {
            console.warn(`Could not get commit history for ${loginToCount} in ${owner}/${repo}:`, e);
            return { commitCount: 0, prCount: 0, firstContributionDate: null };
        }
    }
    // Map a bot-authored PR to a human (unique commit author/committer; else mergedBy if human)
    async mapBotPRToHuman(owner, repo, prNumber) {
        const key = `${owner}/${repo}#${prNumber}`;
        if (this.prHumanResolver.has(key))
            return this.prHumanResolver.get(key);
        const q = `
      query ($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            commits(first: 50) {
              nodes {
                commit {
                  author   { user { login } }
                  committer{ user { login } }
                }
              }
            }
            mergedBy { __typename ... on User { login } ... on Bot { login } }
          }
        }
      }
    `;
        try {
            const res = await graphqlWithAuth(q, { owner, repo, number: prNumber });
            const nodes = res?.repository?.pullRequest?.commits?.nodes ?? [];
            const humans = new Set();
            for (const n of nodes) {
                const a = n?.commit?.author?.user?.login;
                const c = n?.commit?.committer?.user?.login;
                if (a && !this.isBotLogin(a))
                    humans.add(a);
                if (c && !this.isBotLogin(c))
                    humans.add(c);
            }
            let mapped = null;
            if (humans.size === 1) {
                const [only] = humans; // typed as string | undefined
                if (only !== undefined) {
                    mapped = only; // mapped: string | null is OK
                }
            }
            else if (humans.size === 0) {
                const mb = res?.repository?.pullRequest?.mergedBy;
                if (mb?.__typename === "User" && mb?.login && !this.isBotLogin(mb.login)) {
                    mapped = mb.login;
                }
            } // else ambiguous → null
            this.prHumanResolver.set(key, mapped);
            return mapped;
        }
        catch (e) {
            console.warn(`mapBotPRToHuman failed for ${key}:`, e);
            this.prHumanResolver.set(key, null);
            return null;
        }
    }
    // Cached: login -> userId
    async getUserId(login) {
        if (this.userIdByLogin.has(login))
            return this.userIdByLogin.get(login);
        const q = `query ($login: String!) { user(login: $login) { id } }`;
        try {
            const res = await graphqlWithAuth(q, { login });
            const id = res?.user?.id ?? null;
            if (id)
                this.userIdByLogin.set(login, id);
            return id;
        }
        catch (e) {
            console.warn(`getUserId failed for ${login}:`, e);
            return null;
        }
    }
    // Simple global PR count for a user (uncached is fine; cheap)
    async getUserPRCount(login) {
        const q = `
      query ($login: String!) {
        user(login: $login) {
          contributionsCollection {
            totalPullRequestContributions
          }
        }
      }
    `;
        try {
            const res = await graphqlWithAuth(q, { login });
            return res?.user?.contributionsCollection?.totalPullRequestContributions ?? 0;
        }
        catch {
            return 0;
        }
    }
    // Save progress (intermediate save)
    saveProgress() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `progress_${timestamp}.json`;
        const filepath = path.join(this.outputDir, filename);
        const issues = this.getClosedIssuesArray();
        fs.writeFileSync(filepath, JSON.stringify({
            closed_gfi_issues: issues,
            repo_stats: Array.from(this.repoStats.entries()),
            scraped_at: new Date().toISOString(),
            total_closed_gfi: issues.length
        }, null, 2));
        console.log(`  💾 Progress saved to ${filename}`);
    }
    // Save final dataset
    saveFinalDataset() {
        const issues = this.getClosedIssuesArray();
        const jsonPath = path.join(this.outputDir, 'gfi_training_data.json');
        fs.writeFileSync(jsonPath, JSON.stringify({
            closed_gfi_issues: issues,
            repo_stats: Array.from(this.repoStats.entries()),
            metadata: {
                total_closed_gfi_issues: issues.length,
                high_confidence_resolutions: issues.filter(i => i.confidence_score === 'high').length,
                medium_confidence_resolutions: issues.filter(i => i.confidence_score === 'medium').length,
                low_confidence_resolutions: issues.filter(i => i.confidence_score === 'low').length,
                newcomer_resolved_count: issues.filter(i => i.is_newcomer_resolver === true).length,
                experienced_resolved_count: issues.filter(i => i.is_newcomer_resolver === false).length,
                unknown_resolver_count: issues.filter(i => i.is_newcomer_resolver === null).length,
                scraped_at: new Date().toISOString()
            }
        }, null, 2));
        const csvPath = path.join(this.outputDir, 'gfi_training_data.csv');
        this.saveTrainingCSV(csvPath);
        console.log(`\n📁 Final dataset saved to:`);
        console.log(`   - JSON: ${jsonPath}`);
        console.log(`   - CSV: ${csvPath}`);
        this.printSummary();
    }
    // Convert closed issues to CSV format for training
    saveTrainingCSV(filepath) {
        const headers = [
            'repo_owner',
            'repo_name',
            'issue_number',
            'title',
            'body_length',
            'num_labels',
            'created_at',
            'closed_at',
            'num_comments',
            'has_gfi_label',
            'days_open',
            'resolver',
            'resolver_commit_count',
            'is_newcomer_resolver',
            'resolution_method',
            'confidence_score'
        ];
        const issues = this.getClosedIssuesArray();
        const rows = issues.map(issue => [
            issue.repo_owner,
            issue.repo_name,
            issue.issue_number,
            `"${issue.title.replace(/"/g, '""')}"`,
            issue.body.length,
            issue.labels.length,
            issue.created_at,
            issue.closed_at || '',
            issue.num_comments,
            issue.has_gfi_label ? 1 : 0,
            issue.days_open ?? '',
            issue.resolver ?? '',
            issue.resolver_commit_count_before_resolution ?? '',
            issue.is_newcomer_resolver === true ? 1 : issue.is_newcomer_resolver === false ? 0 : '',
            issue.resolution_method ?? '',
            issue.confidence_score ?? ''
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        fs.writeFileSync(filepath, csvContent);
    }
    // Print summary statistics
    printSummary() {
        const issues = this.getClosedIssuesArray();
        const total = issues.length;
        const newcomerResolved = issues.filter(i => i.is_newcomer_resolver === true).length;
        const experiencedResolved = issues.filter(i => i.is_newcomer_resolver === false).length;
        const unknownResolver = issues.filter(i => i.is_newcomer_resolver === null).length;
        const highConfidence = issues.filter(i => i.confidence_score === 'high').length;
        const mediumConfidence = issues.filter(i => i.confidence_score === 'medium').length;
        const lowConfidence = issues.filter(i => i.confidence_score === 'low').length;
        const pct = (num, den) => den > 0 ? (num / den * 100).toFixed(1) : '0.0';
        console.log('\n📊 GRAPHQL-ENHANCED TRAINING DATA SUMMARY:');
        console.log('═══════════════════════════════════════════════════════');
        console.log('\n📋 CLOSED "GOOD FIRST ISSUE" LABELED ISSUES:');
        console.log(`  Total collected: ${total}`);
        console.log(`  Resolved by newcomers (<3 commits): ${newcomerResolved} (${pct(newcomerResolved, total)}%)`);
        console.log(`  Resolved by experienced (3+ commits): ${experiencedResolved} (${pct(experiencedResolved, total)}%)`);
        console.log(`  Unknown resolver: ${unknownResolver} (${pct(unknownResolver, total)}%)`);
        console.log('\n🎯 CONFIDENCE SCORES:');
        console.log(`  High confidence: ${highConfidence} (${pct(highConfidence, total)}%)`);
        console.log(`  Medium confidence: ${mediumConfidence} (${pct(mediumConfidence, total)}%)`);
        console.log(`  Low confidence: ${lowConfidence} (${pct(lowConfidence, total)}%)`);
        console.log('\n🎯 KEY FINDING:');
        if (total > 0) {
            const successRate = pct(newcomerResolved, total);
            console.log(`  GFI Label Success Rate: ${successRate}%`);
            if (newcomerResolved / total < 0.5) {
                console.log(`  ⚠️  Less than 50% of GFI issues were resolved by newcomers!`);
                console.log(`  This validates the need for ML filtering.`);
            }
            else {
                console.log(`  ✅ Majority of GFI issues were resolved by newcomers.`);
            }
        }
        else {
            console.log('  No issues collected yet — skipping rate analysis.');
        }
        console.log('\n📦 PER-REPOSITORY BREAKDOWN:');
        for (const [repoName, stats] of this.repoStats) {
            const repoIssues = issues.filter(i => `${i.repo_owner}/${i.repo_name}` === repoName);
            const repoTotal = repoIssues.length || stats.closed_gfi_count || 0;
            const repoNewcomers = repoIssues.filter(i => i.is_newcomer_resolver === true).length;
            const repoHighConfidence = repoIssues.filter(i => i.confidence_score === 'high').length;
            console.log(`  ${repoName}:`);
            console.log(`    - Closed GFI issues (found): ${stats.closed_gfi_count}`);
            if (repoTotal > 0) {
                console.log(`    - Resolved by newcomers: ${repoNewcomers} (${pct(repoNewcomers, repoTotal)}%)`);
                console.log(`    - High confidence resolutions: ${repoHighConfidence} (${pct(repoHighConfidence, repoTotal)}%)`);
            }
            else {
                console.log(`    - No processed issues yet for this repo.`);
            }
        }
    }
}
// Check rate limit using GraphQL
async function checkRateLimit() {
    const query = `
    query {
      rateLimit {
        limit
        cost
        remaining
        resetAt
      }
    }
  `;
    try {
        const result = await graphqlWithAuth(query);
        console.log(`📊 API Rate Limit: ${result.rateLimit.remaining}/${result.rateLimit.limit} points remaining`);
        console.log(`   Resets at: ${new Date(result.rateLimit.resetAt).toLocaleString()}\n`);
        if (result.rateLimit.remaining < 1000) {
            console.warn('⚠️  Warning: Low API rate limit remaining. Consider waiting or reducing scope.\n');
        }
    }
    catch (error) {
        console.error('Error checking rate limit:', error);
    }
}
// Main execution
async function main() {
    console.log('🚀 GitHub GFI ML Data Scraper - GRAPHQL VERSION');
    console.log('════════════════════════════════════════════════════\n');
    console.log('Using GraphQL for more accurate resolver detection\n');
    await checkRateLimit();
    const scraper = new GFIScraperGraphQL();
    await scraper.scrapeAllRepos();
}
main().catch(console.error);
//# sourceMappingURL=train-model.js.map