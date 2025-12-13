import React, { useEffect, useState } from "react";
import "../styles/Home.css";
import { HomeBox } from "../components/HomeBox";
import { useTasks } from "../context/TaskContext";

export default function Home() {
//PLACEHOLDER FOR ALGORITHM 
//THE ID MUST BE UNIQUE OR ELSE REACT's KEY WILL ACT UP AND DUPLICATE BEGINNER TASK IN ADVANCED MODE
const [isAdvancedMode, setIsAdvancedMode] = useState(false);
const { beginnerTasks, advancedTasks, completeTask} = useTasks();
const taskToDisplay = isAdvancedMode ? advancedTasks: beginnerTasks;
const fake_ID = "menteeMr.JLD"; 
const allTasks = [...beginnerTasks, ...advancedTasks];
const myAcceptedTasks = allTasks.filter (
  task=> task.acceptedID === fake_ID
);

const beginnerTasksDisplayList = beginnerTasks.filter(task=> {
  if(task.status === 'new') {
    return true;
  }
  if ((task.status === 'accepted' || task.status === 'completed') && task.acceptedID === fake_ID) {
    return true;
  }
  return false;
});

const advancedTasksDisplayList = advancedTasks.filter(task=> { 
    if(task.status === 'new') {
      return true;
    }
    if ((task.status === 'accepted' || task.status === 'completed') && task.acceptedID === fake_ID) {
      return true;
    }
    return false; 
  });

const taskToDisplayList = isAdvancedMode ? advancedTasksDisplayList : beginnerTasksDisplayList;
  return (
    <div className="HomePage">
      <div className="LeftSide">
        <div className="ProjectRepo">
          <h1> Current Tasks </h1>
          <div className="Content-container">
            <div className="Repos"> 
              {myAcceptedTasks.length > 0 ? (myAcceptedTasks.map(task=> ( <div key = {task.id} className="RepoItems"> <p> {task.title} </p> {task.status === 'completed' ? (<span>✓</span>) : (<button className="completeButton" onClick={()=> completeTask(task.id)}> Complete </button>)} </div>))) : ( <p> No tasks accepted yet! Git Working! </p>)}
            </div>
          </div>
        </div> 
      </div>

      <div className="Center"> 
        <h1 className="Title">Welcome, John Doe</h1>

        <div className="Levels">
          <h2 className="beginner"> Beginner </h2>  
          <div className="toggle-switch">
            <label className="switch-label">
              <input
                type="checkbox"
                className="checkbox"
                checked={isAdvancedMode}
                onChange={() => setIsAdvancedMode(!isAdvancedMode)}/>
              <span className="slider"></span>
            </label>
          </div>
          <h2 className="advanced"> Advanced </h2> 
        </div>

        {taskToDisplayList.map(task=>
          (<HomeBox key={task.id} task={task}/>)
        )}
      </div>

      <div className="RightSide">       

      </div> 
    </div>
  );
}