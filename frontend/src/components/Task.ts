export interface Task {
    id: string; 
    title: string;
    info: string;

    status: 'new' | 'accepted' | 'completed'; 

    acceptedID: string | null; 

    type: 'beginner' | 'advanced';
}