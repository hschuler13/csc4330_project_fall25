// PURPOSE: keeps tasks appropriate for the specified user to be organized further, and otherwise discards inapproriate matches
// NOTES: all tasks are initialized to false to being assigned to user before going through the user filter

// TODO: make better criteria, i just needed some criteria as a start -> criteria approved by Elijah (my goat)
// TODO: ask user what interests are when introduced, associate with available github tags
// TODO: do the true false thing bozo
// *the topics should be ranked from 1 to k

// factors to consider:
//     1) topics related to task (look at topics of repo task is in)
//     * in real practice, there will be an attribute that shows what repo a task belongs to
//     that repo will have all the topics in there
//     * for test purposes, topics will be assigned to individual tasks

//     2) language of task (some repos use multiple languages)
//     *if the task has multiple languages associated with it, toss it, the newcomer doesn't want that smoke
//     *but maybe it might be a css, html type deal, so keep it maybe if that's what the user vibes with
//     *this is something for next sprint me to worry about

//     3) how new task is (newer task, maybe more relevant, less of an undertaking potentially ?, also ensure repos are active)

// IMPORTS
import { getUser, getAllIssues, insertUserRecommendation,
  clearUserRecommendations } from '../database/db.js';


  /*
   * method runUserFilter: Calculate personalized scores for a user
   * > inputs: userLogin (string) - the GitHub username
   * > outputs: top K recommended issues
   */
  export async function runUserFilter(userLogin: string, k: number = 5) {
    console.log(`\n🎯 Calculating personalized recommendations for 
  ${userLogin}...`);

    // Get user from database
    const user = getUser(userLogin) as any;
    if (!user) {
      console.error(`❌ User ${userLogin} not found in database`);
      return [];
    }

    // Parse JSON fields
      const preferredTopics = user.preferred_topics ?
      JSON.parse(user.preferred_topics) : [];
      const preferredLanguages = user.preferred_languages ?
      JSON.parse(user.preferred_languages) : [];

    console.log(`  Topics: ${preferredTopics.join(', ') || 'None'}`);
    console.log(`  Languages: ${preferredLanguages.join(', ') || 'None'}`);

    // Get all issues from database
    const issues = getAllIssues() as any[];
    console.log(`  Found ${issues.length} issues to evaluate`);

    // Clear old recommendations for this user
    clearUserRecommendations(userLogin);

    // Calculate scores for each issue
    const recommendations: any[] = [];

    for (const issue of issues as any[]) {
      // Parse JSON fields
      const issueTopics = issue.repo_topics ? JSON.parse(issue.repo_topics) : [];

      // Calculate individual scores
      const topicScore = calculateTopicScore(issueTopics, preferredTopics);
      const languageScore = calculateLanguageScore(issue.primary_language,
  preferredLanguages);
      const dateScore = calculateDateScore(issue.days_open);

      // Filter out issues older than 90 days
      if (issue.days_open > 90) {
        continue;
      }

      const totalScore = topicScore + languageScore + dateScore;

      // Save to database
      insertUserRecommendation({
        user_login: userLogin,
        issue_id: issue.id,
        topic_score: topicScore,
        language_score: languageScore,
        date_score: dateScore,
        total_score: totalScore
      });

      recommendations.push({
        issue_id: issue.id,
        repo: `${issue.repo_owner}/${issue.repo_name}`,
        issue_number: issue.issue_number,
        title: issue.title,
        total_score: totalScore
      });
    }

    // Sort by total score and return top K
    recommendations.sort((a, b) => b.total_score - a.total_score);
    const topK = recommendations.slice(0, k);

    console.log(`\n✅ Top ${k} recommendations:`);
    topK.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec.repo}#${rec.issue_number}: 
  ${rec.title.substring(0, 50)}... (Score: ${rec.total_score.toFixed(3)})`);
    });

    return topK;
  }

  // Helper function to calculate topic score
  function calculateTopicScore(issueTopics: string[], userTopics: string[]): 
  number {
    if (userTopics.length === 0) return 0;

    const k = 0.45; // Weight for topic score
    const matchingTopics = issueTopics.filter(topic =>
  userTopics.includes(topic));
    const percentage = matchingTopics.length / userTopics.length;

    return percentage * k;
  }

  // Helper function to calculate language score
  function calculateLanguageScore(primaryLanguage: string | null, userLanguages: 
  string[]): number {
    if (!primaryLanguage || userLanguages.length === 0) return 0;

    const k = 0.35; // Weight for language score
    const languageIndex = userLanguages.indexOf(primaryLanguage);

    if (languageIndex === -1) return 0;

    // Higher ranked languages get higher scores (0.2^rank)
    const score = Math.pow(0.2, languageIndex);
    return score * k;
  }

  // Helper function to calculate date score
  function calculateDateScore(daysOpen: number): number {
    const k = 0.20; // Weight for date score
    const cutoff = 90;

    if (daysOpen > cutoff) return 0;

    // Newer issues get higher scores
    return (cutoff - daysOpen) / cutoff * k;
  }