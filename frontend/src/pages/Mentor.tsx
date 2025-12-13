import React, { useEffect, useState } from "react";
import "../styles/Mentor.css";
import "../styles/Home.css";
import type {Task} from "../components/Task";
import { useTasks } from "../context/TaskContext";
import { NotifyBox } from "../components/NotifyBox";

export default function Mentor() {
  const {advancedTasks, createTask , deleteTask, reuploadTask, editTask } = useTasks();
  const [tasks, setTasks] = useState<Task[]>([]); 
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskInfo, setNewTaskInfo] = useState("");
  const [activeTab, setActiveTab] = useState<'ongoing' | 'all'>('all'); 
  const allTasks = advancedTasks;

//load tasks from DB HERE: 
//useEffect(() => { fetch('/api/tasks') }, []); 

  const submitEvent = (event: React.FormEvent) => {event.preventDefault(); 
    if (!newTaskTitle.trim() || !newTaskInfo.trim()) return; 
    createTask(newTaskTitle, newTaskInfo); 
    setNewTaskTitle(" ");
    setNewTaskInfo(" "); 
  }; 

  const onGoingTasks = advancedTasks.filter(
    task => task.status === 'accepted' )

  const completedTasks = advancedTasks.filter(
    task => task.status === 'completed'
  )
  
  return (
    <div className="Background">
      <div className="LeftSide">
        <div className="NotifyBox">
          <h1>  Notifications  </h1>
              <div className="NotificationContent"> 
                <NotifyBox tasks = {advancedTasks}/>
              </div>        
        </div> 
      </div>

    <div className="Center"> 
      <h1 className="TitleMentor"> Git Creating! Mentor</h1>
{/*My form: */}
      <div className="CreateNewTasks">
        <form className="taskCard" onSubmit={submitEvent}> 
          <h1 className="CreateTitleHomeBox"> Create New Task </h1>

          <div className="inputContainer"> 
            <input type="text" required value= {newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} maxLength={600}/> 
            <span className="TitleofTask"> Enter Your Task Title </span> 
          </div>

          <div className="inputContainer"> <textarea required value={newTaskInfo} onChange={(e) => setNewTaskInfo(e.target.value)}/> 
            <span className="TitleofTask"> Enter Task Info...</span> 
          </div> 

          <button type="submit" className="AddButton"> 
            Add Task +
          </button>
        </form>
      </div>

      <div className="TabComponent"> 
        <button className={activeTab === 'all' ? 'active' : ''} onClick={() => setActiveTab('all')}> All Tasks </button>
        <button className={activeTab === 'ongoing' ? 'active' : ''} onClick={()=> setActiveTab('ongoing')}> Ongoing Tasks </button>
      </div>

      {activeTab === 'all' && ( 
        <div className="ExistingTasks">
          {advancedTasks.length===0 && <p> No Tasks Created Yet! Git Tasking! </p>}
          {advancedTasks.map(task => 
            (
            <div key={task.id} className={`MtaskBox status-${task.status}`}> 
              <div className="MTaskBoxHeader"> 
              <h3> {task.title} </h3> 
            {task.status === 'accepted' && 
            (
              <span className="OngoingBox"> Ongoing </span>
            )}
            {task.status === 'completed' && 
            (
              <span className="onGoingCompleted"> Completed </span>
            )} 
            </div>
            <div className="MTaskBoxBody"> 
              <p> {task.info} </p>
            <div className="mentorActions"> 
              {task.status === 'new' && (<button className="DeleteTaskBtn1" onClick={() => deleteTask(task.id)}> Delete Task </button>)}
              {task.status === 'accepted' && (<button className="DeleteTaskBtn2" onClick={() => reuploadTask(task.id)}> Reupload Task </button>)}
              {task.status === 'completed' && (<> <button className="DeleteTaskBtn3" onClick={() => reuploadTask(task.id)}> Reupload Task </button>
                <button className="DeleteTaskBtn" onClick={() => deleteTask(task.id)}> Delete Task </button> </>
              )}
            </div>
            </div>
            </div> 
            ))}
            </div> )} 

      {activeTab === 'ongoing' && 
      ( 
        <div className="ExistingTasks">
          {onGoingTasks.length ===0 && <p> No Tasks Currently in Progress! Git Progressing! </p>}
          {onGoingTasks.map(task => (<div key={task.id} className="MtaskBox"> 
            <div className="MTaskBoxHeader"> 
              <h3> {task.title} </h3> 
            </div> 
            <div className="MTaskBoxBody"> 
              <p> Assigned to: {task.acceptedID} </p> 
              <div className="mentorActions"> 
                <button onClick={()=>reuploadTask(task.id)}> Reupload Task 
                </button> 
              </div> 
            </div> 
            </div> 
            ))}
        </div> 
      )          
      }
    </div>

  <div className="RightSide">     
    {/*
    <div className="MessageBox">
      <h1 className="MessageTitle">Messages</h1>
      <p className="MsgLine">___________________</p>
      <div>
        <h3 className="Valerie"> Mentee 1 </h3>
      </div>

      <div>
        <h3 className="Sam"> Mentee 2 </h3>
      </div>
    </div>
    */}
  </div>

</div>
  )
}


