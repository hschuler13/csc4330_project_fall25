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
    topics: string[];
}
interface LanguageData {
    [language: string]: number;
}
export interface ScrapedUserProfile {
    user: GitHubUser;
    repos: {
        name: string;
        language: string | null;
        stars: number;
        isForked: boolean;
        lastUpdated: string;
        topics: string[];
        languages?: {
            [key: string]: string;
        };
    }[];
    metrics: {
        primaryLanguages: string[];
        topTopics: string[];
        activityLevel: string;
        daysSinceLastUpdate: number | null;
        experienceLevel: string;
        accountAgeYears: number;
        totalPRs: number;
    };
    pullRequests: {
        total: number;
        recent: {
            title: string;
            repository: string;
            state: string;
        }[];
    };
}
export declare class GitHubScraper {
    private baseURL;
    private accessToken;
    constructor(accessToken?: string);
    private getHeaders;
    getUserProfile(username: string): Promise<GitHubUser>;
    getUserRepos(username: string, limit?: number): Promise<GitHubRepo[]>;
    getRepoLanguages(owner: string, repo: string): Promise<LanguageData>;
    getUserPullRequests(username: string): Promise<any>;
    scrapeUserData(username: string, accessToken?: string): Promise<ScrapedUserProfile>;
}
export default GitHubScraper;
//# sourceMappingURL=github-scrapper.d.ts.map