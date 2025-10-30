// NOTICE: This algorithm now uses the database instead of min heaps
  // The database handles sorting efficiently via SQL ORDER BY

  // IMPORTS
  import { getUserRecommendations } from '../database/db.js';

  /*
   * Get top K recommendations for a user from database
   * > inputs: userLogin (string) - GitHub username
   *           k (number) - number of recommendations to return (default 5)
   * > outputs: array of top K recommendations
   */
  export async function getTopRecommendations(userLogin: string, k: number = 5) {
      console.log(`\n📊 Getting top ${k} recommendations for ${userLogin}...`);

      // Get recommendations from database (already sorted by total_score DESC)
      const recommendations = getUserRecommendations(userLogin, k);

      if (recommendations.length === 0) {
          console.log(`⚠️ No recommendations found for ${userLogin}`);
          console.log(`   Make sure to run the filter algorithm first!`);
          return [];
      }

      console.log(`✅ Found ${recommendations.length} recommendations:\n`);
      recommendations.forEach((rec: any, i: number) => {
          const title = rec.title.length > 50 ? rec.title.substring(0, 50) +
  '...' : rec.title;
          console.log(`  ${i + 1}. 
  ${rec.repo_owner}/${rec.repo_name}#${rec.issue_number}`);
          console.log(`     ${title}`);
          console.log(`     Score: ${rec.total_score.toFixed(3)} (Topic: 
  ${rec.topic_score.toFixed(3)}, Lang: ${rec.language_score.toFixed(3)}, Date: 
  ${rec.date_score.toFixed(3)})`);
          console.log();
      });

      return recommendations;
  }