import React from "react";
import {useState} from "react";
import { Link } from 'react-router-dom';
import "../styles/Navbar.css";

function Navbar() {
    const [isOpen, setIsOpen] = useState(false);
      const toggleNavbar = () => setIsOpen(!isOpen);

    return (
        <div className={`navbar ${isOpen ? "open" : ""}`}>
            <div className="triangle" onClick={toggleNavbar}></div>
            <div className="HomeNav">
                <Link to="/"> Profile </Link>
            </div>
            <div className="Link2">
                <Link to="/About"> About </Link>
            </div>
            <div className="Link3">
                <Link to="/Settings"> Settings </Link>
            </div>
            <div className="Link4">
                <Link to="/"> Log Out </Link>
            </div>
            
            
        </div>
    );
}

export default Navbar;