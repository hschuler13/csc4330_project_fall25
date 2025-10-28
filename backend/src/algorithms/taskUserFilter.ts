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
import * as fs from "fs";
import * as path from 'path';
const testJson = JSON.parse(fs.readFileSync("./testData.json", "utf-8"));

/*
 * method runUserFilter: runs all methods necessary in evaluating each score for task, or throwing a task away
 * > inputs: none
 * > outputs: none 
 */
function runUserFilter(){
  var scoreArr: string | any[] = [];
  var k = 5;
  dateScore();
  topicScore();
  languageScore();
  scoreSum(scoreArr);
  for(var i = 0; i < k; i++){
    console.log(scoreArr[k])
  }
  saveJson();
}

// QUESTION: date should definitely remove tasks from running, but should topic & language automatically remove it ?
// I am asking just in case of false negatives
// *for now, they do not 

/*
 * method topicScore: for each task, assign a score based on how many topics associated with 
 * > inputs: none
 * > outputs: none 
 */
function topicScore() {
    console.log("running topic score calculations")
    // arbitrary multiplier to change the weight of this factor
    var k = 0.45;
    //https://stackoverflow.com/questions/12433604/how-can-i-find-matching-values-in-two-arrays
    // go through each task and assign topicScore 
    testJson.tasks.forEach(function (task: { topics: any[]; topicScore: number; }) {
        // TODO: adjust to do any user (0 -> replaced with input i as to where user is in array)
        // actually, we're using SQL so this is all gonna change hahahahahahahahaha :))
        // compare the array of topics of the associated task with the array of topics the user has indicated interest in
        var filteredArr = task.topics.filter(function (element: any) {
            return testJson.users[0].preferredTopics.includes(element);
        });
        // test - print new array in console
        console.log(filteredArr);
        // percentage of topics that match user's topics of interest (matching # task topics/ total # topics of user interest)
        var p = filteredArr.length / testJson.users[0].preferredTopics.length;
        // input topic score into task (percentage of matching topics * weight)
        task.topicScore = p * k;
        // test - log topicScore
        console.log(task.topicScore)
    });
    console.log("")
}

/*
 * method topicScore: for each task, assign a score based on how relevant the languages associated with the task are
 * > inputs: none
 * > outputs: none 
 */
function languageScore() {
  console.log("running language score calculations");
  // arbitrary multiplier to change the weight of this factor
  const k = 0.35;
  // go through each task and assign languageScore 
  testJson.tasks.forEach(function (task: { taskLanguage: string | any[]; languageScore: string; }) {
    // total language score for task
    let z = 0;
    // look through every language the task is associated with
    for (let i = 0; i < task.taskLanguage.length; i++) {
      // relevance score of current language of task being looked at 
      let y = 0;
      // check if language is present within user's preferred languages
      // true: returns index where langauge is present in user's preferred languages 
      // false: returns -1
      const sameLanguage = testJson.users[0].languages.indexOf(task.taskLanguage[i]);
      // if the language is present within the user's used languages
      if (sameLanguage !== -1) {
        // weight it based on where it ranks (higher ranked language -> lower index value)
        y = 0.2 ** sameLanguage;
      }
      // add individual language score to total language score
      z += y;
    }
    // https://stackoverflow.com/questions/3337849/difference-between-tofixed-and-toprecision
    // weight the score for the total languageScore and assign it
    task.languageScore = (z * k).toFixed(2);
    // test - make sure dateScore is correct
    console.log(task.languageScore);
  });
  console.log("");
}

// IDEA: maybe let user adjust this to their liking (?)
// QUESTION: would frontend be chill w/ that ?

/*
 * method dateScore: for each task, determine if a task is worthy of being scored, then assign a score based on how close to cutoff the task is
 * > inputs: none
 * > outputs: none 
 */
function dateScore() {
    console.log("running date score calculations");
    // arbitrary multiplier to change the weight of this factor
    var k = 0.20;
    // cutoff for task in days (for now, it is 3 months)
    var cutoff = 90;
    // go through each task and assign dateScore if task is not above the cutoff date
    // otherwise, remove that task from being a candidate of suggestion to the user
    testJson.tasks.forEach(function (task: { daysSincePublished: number; dateScore: string; forUser: boolean}) {
        // check to make sure date of task is less than 3 months old
        // procedure if task is below cutoff
        if (task.daysSincePublished <= cutoff){
          // allow task entry into heap
          task.forUser = true;
          // input weighted score into task
          task.dateScore = (task.daysSincePublished * k).toFixed(2);
          // test - make sure dateScore is correct
          console.log(task.dateScore)
        }
        // procedure if task is above cutoff
        else { 
          // prevent task from entering heap
          task.forUser = false;
          // move onto the next element
          return;
        }
    });
    console.log("");
}


// save data into the Json file - will be removed once it is time to integrate SQL into the mix
function saveJson() {
    const filePath = path.resolve('./testData.json');
    fs.writeFileSync(filePath, JSON.stringify(testJson, null, 2));
    console.log('Updated JSON saved to testDataUpdated.json');
}

// a different way of storing appropriate tasks will need to be established once database in SQL is established
function scoreSum(arr: any[]) {
    // look through each task present
    testJson.tasks.forEach(function (task: { totalScore: number; topicScore: any; languageScore: any; dateScore: any; forUser: boolean}) {
        // procedure if task has been marked as appropriate for user
        if(task.forUser == true){
            // add all three scores together into one total score
            task.totalScore = Number(task.topicScore) + Number(task.languageScore) + Number(task.dateScore);
            // TO DO: somehow associate task object with score (wait until SQL database established)
            // add total score into array 
            arr.push(task.totalScore)
            // test - print score into console
            console.log(task.totalScore)
        }
        // procedure if task has not been marked as appropriate for user
        else{
            // skip to next task
            return;
        }
    });
}

// run that 
runUserFilter();
