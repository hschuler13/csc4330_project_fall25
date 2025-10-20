export interface CompleteUserProfile {
    githubId: number;
    email: string | null;
    accessToken: string;
    username: string;
    name: string | null;
    avatarUrl: string;
    bio: string | null;
    followers: number;
    following: number;
    publicRepos: number;
    primaryLanguages: string[];
    topTopics: string[];
    experienceLevel: string;
    activityLevel: string;
    accountAgeYears: number;
    totalPRs: number;
    topRepos: {
        name: string;
        language: string | null;
        stars: number;
        isForked: boolean;
    }[];
    createdAt: string;
    lastLogin: string;
}
export declare function handleGitHubCallback(code: string): Promise<{
    success: boolean;
    user?: CompleteUserProfile;
    error?: string;
}>;
export declare function githubCallbackRoute(req: any, res: any): Promise<any>;
declare const _default: {
    handleGitHubCallback: typeof handleGitHubCallback;
    githubCallbackRoute: typeof githubCallbackRoute;
};
export default _default;
//# sourceMappingURL=Oauth-handler.d.ts.map