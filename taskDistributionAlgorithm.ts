// NOTICE: within this code, min heaps are being used
// TO DO: implement the actual list of tasks when database gets updated
// TO DO: update comments for all methods 
// TO DO: fix scoring it's so unbalanced (skull emoji)
// TO DO: make this a proper priority queue (maybe idk)

import fs from "fs";
import path from 'path';
const testJson = JSON.parse(fs.readFileSync("./testData.json", "utf-8"));

function userTaskSortTest() {
    // uhhh this was just test stuff ignore this 
    // imagine theses are the user compatiblity scores of the tasks.
    // they will be turned into a max heap.
    // to visualize this as a heap, read the array from left to right.
    // this correlates with the positions of each number in the heap from top to
    // bottom.
    //let A1: number[] = [4, 9, 6, 22, 35, 11, 78, 43, 91, 7];
    // this is the last index of the array which there is a valid min heap
    //var end1: number = 9;
    // let us make two more for testing purposes
    /*let A2: number[] = [
      33, 74, 79, 26, 70, 49, 3, 80, 16, 66, 28, 5, 45, 57, 12, 77, 22, 75, 43,
      56, 100, 1, 27, 94, 3, 81, 85, 96, 61, 66, 76, 84, 82, 78, 21, 31, 6, 71,
      48, 8, 9, 37, 87, 55, 62, 14, 90, 4, 20, 32,
    ];
    var end2: number = 49;
  
    let A3: number[] = [
      74, 75, 23, 14, 70, 72, 6, 49, 95, 35, 47, 41, 83, 7, 37, 21, 40, 34, 86,
      88, 59, 52, 69, 26, 78, 38, 87, 73, 39, 62, 82, 11, 60, 9, 100, 45, 12, 15,
      56, 89, 54, 51, 53, 22, 3, 76, 66, 27, 8, 84, 97, 65, 32, 24, 94, 16, 64,
      25, 91, 30, 44, 81, 57, 48, 33, 90, 77, 28, 55, 79, 2, 63, 80, 4, 10, 5, 93,
      46, 1, 20, 61, 18, 92, 42, 58, 50, 67, 17, 36, 19, 99, 31, 13, 68, 43,
    ];
    var end3: number = 94;*/
    // k will only sort the array enough so the top k numbers will show.
    // in implementation, these are the tasks with user compatibility scores high enough 
    // to be displayed to the user.
    //let k: number = 5;
    // now, run the heap sort on the algorithms
    /*userTaskSort(A1, end1, k);
    userTaskSort(A2, end2, k);
    userTaskSort(A3, end3, k);*/
    // finally, make checks to ensure the arrays are in order
    /*checkArrayOrder(A1);
    checkArrayOrder(A2);
    checkArrayOrder(A3);*/
    var scoreArr: string | any[] = [];
    var k = 5;
    scoreSum(scoreArr);
    userTaskSort(scoreArr, scoreArr.length);
    checkArrayOrder(scoreArr);
    for (var i = 0; i < k; i++) {
        console.log(scoreArr[i]);
    }
    saveJson();
}


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


function userTaskSort(A: any[], end: number) {
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
 * > inputs: int A[] (array to be turned into a min heap)
 *           int end (the last index of the array where there is a valid min heap)
 * > outputs: none (void)
 */
function makeMinHeap(A: any, end: number) {
    // check all parent nodes if they have children that do not violate the rules
    // the for loop makes sure all leaf nodes are ignored
    // call on heapify to make sure every subtree is sorted properly
    for (var i = Math.floor(end / 2); i >= 0; i--)
        heapify(A, i, end);
}

/*
 * method heapify: take a partially sorted heap and turn it into a proper min
 * heap
 * > inputs: int A[] (array that needs sorting)
 *           int top (the current top of the heap)
 *           int end (last valid entry of the min heap in the array)
 * > outputs: none (void)
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
 * > inputs: int A[] (array of integers involved in heap shenaningans)
 * int i (first element to have its position swapped)
 * int j (second element to have its position swapped)
 * > outputs: none (void)
 * there's nothing much else to say :/
 */
function swap(A: { [x: string]: any; }, i: number, j: number) {
    var temp = A[i];
    A[i] = A[j];
    A[j] = temp;
}
function scoreSum(arr: any[]) {
    testJson.tasks.forEach(function (task: { totalScore: number; topicScore: any; languageScore: any; dateScore: any; }) {
        task.totalScore = Number(task.topicScore) + Number(task.languageScore) + Number(task.dateScore);
        arr.push(task.totalScore)
        console.log(task.totalScore)
    });
}

// save data into Json file
function saveJson() {
    const filePath = path.resolve('./testData.json');
    fs.writeFileSync(filePath, JSON.stringify(testJson, null, 2)); // pretty-print with 2 spaces
    console.log('Updated JSON saved to testDataUpdated.json');
}

// run the test of heapsort
userTaskSortTest();