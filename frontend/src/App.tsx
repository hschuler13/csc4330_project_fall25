import { useState } from 'react'
import './App.css';
import { BrowserRouter as Router, Route, Routes} from 'react-router-dom';
import Navbar from "./components/Navbar";
import Home from './pages/Home';
import About from './pages/About';
import Settings from './pages/Settings';
import Mentor from './pages/Mentor';
import { TaskProvider } from './context/TaskContext';

function App() {
  const [count, setCount] = useState(0)

  return (
    <TaskProvider> 
      <Router>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/About" element={<About />} />
          <Route path="/Settings" element={<Settings />} />
          <Route path="/Mentor" element={<Mentor />} />
        </Routes>
      </Router>
    </TaskProvider>
  );
}

export default App
