// NOTICE: within this code, min heaps are being used
// TO DO: implement the actual list of tasks when database gets updated
// TO DO: update comments for all methods 
// TO DO: make this code more efficient
// TO DO: be able to (i forgot what i was writing here)

// IMPORTS
import * as fs from "fs";
import * as path from 'path';
const testJson = JSON.parse(fs.readFileSync("./testData.json", "utf-8"));

// test function to make sure things operate properly
function userTaskSortTest() {
    // array to be filled with scores
    var scoreArr: string | any[] = [];
    // number of tasks to be shown to the user upon opening task page
    var k = 5;
    // put scores into the empty array 
    scoreSum(scoreArr);
    // sort the array into a proper binary min heap
    userTaskSort(scoreArr, scoreArr.length);
    // test - make sure array is in the correct order
    checkArrayOrder(scoreArr);
    // test - print out top five highest scores
    for (var i = 0; i < k; i++) {
        console.log(scoreArr[i]);
    }
    // save information into Json file - will be replaced eventually when SQL database is implemented
    saveJson();
}

// this is just a test function im not explaining it
// it just checks the order of the array
function checkArrayOrder(A: string | any[]) {
    var failFlag = false;
    for (var i = 0; i < A.length - 1; i++) {
        if (A[i] < A[i + 1]) {
            failFlag = true;
            break;
        }
    }
    if (failFlag === true)
        console.log("heapsort failed");
    else
        console.log("heapsort passed");
}

/*
 * method userTaskSort: creates a sorted binary heap of tasks based on totalScore
 * > inputs: number[] A (array to be turned into a min heap)
 *           number end (the last index of the array where there is a valid min heap)
 * > outputs: none 
 */
function userTaskSort(A: number[], end: number) {
    // turn the array into a min heap
    makeMinHeap(A, end);
    // while loop that does the sorting of the heap (hence, heapsort)
    // exit condition: only one element is left in the heap (index 0), nothing left to be sorted
    while (end > 0) {
        // the top of the heap & the last index of the heap swap places
        swap(A, 0, end);
        // heap has shrunk by one, indicate by decrementing
        end--;
        // turn this new heap back into a proper min heap to continue the sort properly at the next iteration
        heapify(A, 0, end);
    }
    // in the console, print out the values in the array
    console.log("[ ");
    for (var i = 0; i < end; i++)
        console.log(A[i]);
    console.log(" ]");
    console.log(" ");
}

/*
 * method heapify_all: sorts a given array into a min heap
 * > inputs: number[] A (array to be turned into a min heap)
 *           number end (the last index of the array where there is a valid min heap)
 * > outputs: none 
 */
function makeMinHeap(A: number[], end: number) {
    // check all parent nodes if they have children that do not violate the rules
    // the for loop makes sure all leaf nodes are ignored
    // call on heapify to make sure every subtree is sorted properly
    for (var i = Math.floor(end / 2); i >= 0; i--)
        heapify(A, i, end);
}

/*
 * method heapify: take a partially sorted heap and turn it into a proper min
 * heap
 * > inputs: number[] A (array that needs sorting)
 *           number top (the current top of the heap)
 *           number end (last valid entry of the min heap in the array)
 * > outputs: none 
 */
function heapify(A: number[], top: number, end: number) {
    // minchild will keep of what index of the heap is being looked at
    var minchild;
    // keep the loop going so long as there is a left child present
    // exit condition: only one child left in the heap -> break out
    while (top * 2 + 1 <= end) {
        // automatically assign left child as smallest
        minchild = top * 2 + 1;
        // if right child exists AND left child is greater than right child...
        if (minchild + 1 <= end && A[minchild]! > A[minchild + 1]!)
            // assign the right child as the smallest
            minchild++;
        // if the parent of the child has a bigger value...
        if (A[top]! > A[minchild]!) {
            // ...that breaks the rules of min heap.
            // perform a swap to rectify this
            swap(A, top, minchild);
            // indicate the child has now become the parent
            top = minchild;
        }
        // exit the method if no swaps are necessary
        else
            break;
    }
}

/*
 * method swap: swaps two values
 * > inputs: any(?) A[] (array of integers involved in heap shenaningans) -> unsure of type, autofixed by vscode
 * number i (first element to have its position swapped)
 * number j (second element to have its position swapped)
 * > outputs: none
 * there's nothing much else to say :/
 */
function swap(A: { [x: string]: any; }, i: number, j: number) {
    var temp = A[i];
    A[i] = A[j];
    A[j] = temp;
}

/*
 * method scoreSum: populate empty array with total scores of tasks
 * > inputs: any[] arr (empty array to input scores)
 * > outputs: none 
 */
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

/*
 * method saveJson: saves data into the test Json file
 * > inputs: none
 * > outputs: none 
 * > additional notes: will be removed once SQL database is implemented
 */
function saveJson() {
    const filePath = path.resolve('./testData.json');
    fs.writeFileSync(filePath, JSON.stringify(testJson, null, 2)); 
    console.log('Updated JSON saved to testDataUpdated.json');
}

// run the test of heapsort
userTaskSortTest();