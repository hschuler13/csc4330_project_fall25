import React from 'react';
import type { Task } from './Task'; 
import '../styles/Mentor.css';  

interface NotifyBoxData{
    tasks: Task[];
}

export function NotifyBox({tasks}: NotifyBoxData){
    const notifications = tasks.filter(
        task => task.status === 'accepted' || task.status === 'completed');
    
        const recentNotifs = notifications.slice(-5).reverse();

        return (
            <>
            {recentNotifs.length === 0 && ( <p> No tasks completed yet! </p>)}
            {recentNotifs.map(task => (
                <div key={task.id} className="notifContent">
                    {task.status === 'accepted' && 
                    (
                        <p> 
                            <strong className="NotifID"> {task.acceptedID} </strong> has accepted your task: <strong className="NotifTitle"> {task.title} </strong>
                        </p>
                    )}
                    {task.status === 'completed' && 
                    (
                        <p>
                            <strong className="NotifID">{task.acceptedID}</strong> has finished your task: <strong className="NotifyTitle"> {task.title} </strong>
                        </p> 
                    )}
                </div> ))}
            </>
        );
}