import React from "react";
import {useState} from "react";
import { Link } from 'react-router-dom'; 
import { useTasks } from "../context/TaskContext.tsx";
import type {Task} from './Task.ts'; 

import "../styles/Home.css";

import dropdownIcon from '../assets/dropdownIcon.png'; 
import upButton from '../assets/upButton.png'; 

interface HomeBoxTask {

    task: Task; 

}

export function HomeBox({task}: HomeBoxTask) {
    const [isBoxBig, setIsBoxBig] = useState(false);
    const {acceptTask} = useTasks(); 
    const fakeID = "menteeMr.JLD"; 

    const renderButton = () => {
        if (task.status === 'new') {
        return (
            <button className= "taskAcceptButton" onClick={()=> acceptTask(task.id, fakeID)}> 
            Accept </button>
            );
         } 
        if (task.status === 'accepted' && task.acceptedID === fakeID) {
        return (
            <button className= "taskAcceptButton" disabled> Accepted </button>)
         } 
        if (task.status === 'completed' && task.acceptedID === fakeID) {
        return (<button className= "taskAcceptButton" disabled> Completed </button>)
        } }

            
    return (
        <div className="HomeBox">
            <div className={`TaskContainer ${isBoxBig ? "expanded" : ""}`}>
                <div className="TitleHomeBox">
                    <h2> {task.title} </h2>
                </div>
                <div className="expandInfoB"> 
                    <h3> {task.info} </h3>
                </div>

            <div className="TaskActions"> 
                {renderButton()}
            </div>
            </div>
    

        </div>
    )
}