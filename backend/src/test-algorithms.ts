// Test script for personalized recommendation algorithms
  import { runUserFilter } from './algorithms/taskUserFilter.js';
  import { getTopRecommendations } from
  './algorithms/taskDistributionAlgorithm.js';

  async function testAlgorithms() {
      console.log('🧪 Testing Recommendation Algorithms\n');
      console.log('='.repeat(60));

      const username = 'stanlsu'; // Your GitHub username from earlier

      // Step 1: Run the filter algorithm to calculate personalized scores
      console.log('\n📋 STEP 1: Running user filter algorithm...');
      await runUserFilter(username, 20);

      // Step 2: Get top recommendations
      console.log('\n📋 STEP 2: Getting top 5 recommendations...');
      const topRecs = await getTopRecommendations(username, 5);

      console.log('\n' + '='.repeat(60));
      console.log('✅ Test Complete!');
      console.log(`\nGenerated ${topRecs.length} personalized recommendations for
   ${username}`);
  }

  testAlgorithms().catch(console.error);