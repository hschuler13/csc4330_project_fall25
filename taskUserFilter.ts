// this is used to filter tasks to create a curated top
// i assume the hyperfilter will only gather available tasks that are suitable for a broad range of newcomers (whether or not they have a gfi label or not)
// how often should task list be updated ? (only have 5000 github api calls at a time)
// all tasks are initialized to false to being assigned to user before going through the user filter

// TODO: make better criteria, i just needed some criteria as a start
// TODO: ask user what interests are when introduced, associate with available github tags
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

//     potential criteria: type of task (?) - vscode has types, diff. from labels, they use as extra categories (bug, task, feature), but not all oss does this
//     * continue with new criteria ideation

import fs from "fs";
import path from 'path';
const testJson = JSON.parse(fs.readFileSync("./testData.json", "utf-8"));

// note: perhaps a different order is best, but oh well, that is for next sprint's me
// lowkey, i can put these all together, but for just figuring it out, separation is fine
// optimize this next sprint

// 1. look at the topics
function topicScore() {
    console.log("running topic score calculations")
    //https://stackoverflow.com/questions/12433604/how-can-i-find-matching-values-in-two-arrays
    testJson.tasks.forEach(function (task: { topics: any[]; topicScore: number; }) {
        // NOTE: make sure all topics have same casing (this is Steven's job)
        // filter through task topics and only find one's user is interested in
        // TODO: adjust to do any user (0 -> replaced with input i as to where user is in array)
        // actually, we're using SQL so this is all gonna change hahahahahahahahaha :))
        var filteredArr = task.topics.filter(function (element: any) {
            return testJson.users[0].preferredTopics.includes(element);
        });
        console.log(filteredArr);
        // arbitrary multiplier to change the weight of this factor
        var k = 45;
        // percentage of topics that match user's topics of interest (matching task topics/ total topics of user interest)
        var p = filteredArr.length / testJson.users[0].preferredTopics.length;
        // input topic score into task
        task.topicScore = p * k;
        // log that
        console.log(task.topicScore)
    });
    console.log("")
}

// 2. look at the languages
function languageScore() {
  console.log("running language score calculations");
  testJson.tasks.forEach(function (task: { taskLanguage: string | any[]; languageScore: string; }) {
    // arbitrary multiplier to change the weight of this factor
    const k = 35;
    // total language score for task
    let z = 0;

    // look through every language the task is associated with
    // Steven got that
    for (let i = 0; i < task.taskLanguage.length; i++) {
      let y = 0;
      const sameLanguage = testJson.users[0].languages.indexOf(task.taskLanguage[i]);
      // if the language is present within the user's used languages
      if (sameLanguage !== -1) {
        // weight it based on where it ranks (higher ranked language -> lower index value)
        y = 0.2 ** sameLanguage;
      }
      // add to total language score
      z += y;
    }
    // https://stackoverflow.com/questions/3337849/difference-between-tofixed-and-toprecision
    // weight the score for the total languageScore
    task.languageScore = (z * k).toFixed(2);
    // log that
    console.log(task.languageScore);
  });
  console.log("");
}

// 3. look at the date
function dateScore() {
    console.log("running date score calculations");
    testJson.tasks.forEach(function (task: { datePublished: string | number | Date; dateScore: string; }) {
        // arbitrary multiplier to change the weight of this factor
        var k = 20;
        // total date score for task
        var x = checkDateDistance(task.datePublished).daysFromBarrier / 100;
        // input weighted score into task
        task.dateScore = (x * k).toFixed(2);
        console.log(task.dateScore)
    });
    console.log("");
}

// save data into the Json file
function saveJson() {
    const filePath = path.resolve('./testData.json');
    fs.writeFileSync(filePath, JSON.stringify(testJson, null, 2)); // pretty-print with 2 spaces
    console.log('Updated JSON saved to testDataUpdated.json');
}

type DateCheckResult = {
  isWithinLastThreeMonths: boolean;
  daysFromBarrier: number; // negative = before, positive = after
  barrierDate: string;     // ISO date string (YYYY-MM-DD)
};

// use days open (Steven scraped it, thank you bro)
// *so this can be deleted next sprint
function checkDateDistance(isoString: string | number | Date) {
    var givenDate = new Date(isoString);
    var now = new Date();
    // Calculate 3 months ago
    var threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(now.getMonth() - 3);
    // Difference in ms
    var diffMs = givenDate.getTime() - threeMonthsAgo.getTime();
    // Convert to days - past 3 months, score of 0
    var diffDays = diffMs < 0 ? 0 : Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return {
        isWithinLastThreeMonths: givenDate >= threeMonthsAgo && givenDate <= now,
        daysFromBarrier: diffDays,
        barrierDate: threeMonthsAgo.toISOString().split("T")[0]
    };
}


topicScore();
languageScore();
dateScore();
saveJson();
