import React, { createContext, useContext, useState} from "react";
import type { Task } from "../components/Task";

const mockAlgorithm: Task[] = [
  {id: 'B300', title: 'Bug Issue in Form', info: 'Error when I try to submit the form', status:'new', acceptedID: null, type: 'beginner'},
  {id: 'B32', title: 'Title Layout Overlapping', info: 'Title does not show up when I run', status:'new', acceptedID: null, type: 'beginner'},
]; 

interface TaskDatabase {
    beginnerTasks: Task[];
    advancedTasks: Task[];
    createTask: (title: string, info: string) => void;
    acceptTask: (taskID: string, userID: string) => void;
    completeTask: (taskID: string) => void;
    deleteTask: (taskID: string) => void; 
    reuploadTask: (taskId: string) => void;
    editTask: (taskId: string, newTitle:string, newInfo: string) => void;
}

const TaskContext = createContext<TaskDatabase | undefined>(undefined); 

export function TaskProvider({children}: { children: React.ReactNode}) 
{
    const [allTasks, setAllTasks] = useState<Task[]>([...mockAlgorithm]);
    const createTask = (title: string, info: string) => 
        {
            const newTask: Task= 
            {
            id: crypto.randomUUID(), 
            title, 
            info, 
            status: 'new', 
            acceptedID: null, 
            type: 'advanced', 
            }
        //REAL DB INFORMATION HERE 
        setAllTasks((prevTasks: Task[]) =>  [...prevTasks, newTask]);
        };

const acceptTask= (taskId: string, userId: string) => 
    {
    setAllTasks((prevTasks : Task[]) => 
        prevTasks.map((task:Task) => 
            task.id === taskId ? {...task, status:'accepted', acceptedID: userId} :task 
        ));
    };

const completeTask = (taskId: string) => 
    {
    setAllTasks((prevTasks : Task[])=> 
        prevTasks.map((task : Task) => 
            task.id === taskId ? {...task, status:'completed'} : task ));
    };

const deleteTask = (taskId: string) => 
    {
    setAllTasks((prevTasks : Task[]) => prevTasks.filter(task => task.id !== taskId));
    };
const reuploadTask = (taskId: string) => {
    setAllTasks((prevTasks: Task[]) => prevTasks.map((task: Task) => task.id === taskId ? {...task, status: 'new', acceptedID: null}: task));
};

const editTask = (taskId: string, newTitle: string, newInfo: string) => {
    setAllTasks((prevTasks: Task[]) => prevTasks.map((task :Task) => task.id === taskId ? {...task, title: newTitle, info: newInfo} : task) ); 
};

const beginnerTasks = allTasks.filter(task => task.type === 'beginner');
const advancedTasks = allTasks.filter(task => task.type === 'advanced');

return (
    <TaskContext.Provider value={{ 
        beginnerTasks, 
        advancedTasks,
        createTask, 
        acceptTask, 
        completeTask, 
        deleteTask, 
        reuploadTask, 
        editTask
    }}> {children} </TaskContext.Provider>
);
}

export function useTasks() {
    const context = useContext(TaskContext);
    if (context === undefined) {
        throw new Error('useTasks myst be used within a TaskProvider'); }
        return context;
    }

