import React, { useState } from "react";
import "../styles/Home.css";

export default function Home() {
  const [isOn, setIsOn] = useState(false);

  return (
    <div className="HomePage">
      <h1 className="Title">Welcome, John Doe</h1>

      <div className="searchbox">
        <img src="/searchlogo.png" className="logo" />
        <input
          type="text"
          placeholder="Search by Name, Project Repo..."
          className="line"
        />
      </div>

      <div className="HomeBox1"></div>
      <div className="HomeBox2"></div>

      <div className="HomeBox">
        <h1 className="Title2">Karen Smith</h1>
        <div className="HeadShot">
          <img src="/headshotFM.jpg" className="picture" />
        </div>

        <div className="NoCircle">
          <img src="/yes.png" className="Yes" />
        </div>

        <div className="YesCircle">
          <img src="/no.png" className="No" />
        </div>
      </div>

      <p className="Info">Information</p>

      <div>
        <h3 className="Valerie">Valerie Banks</h3>
      </div>
      <div>
        <h3 className="Sam">Sam Tall</h3>
      </div>

      <div className="ConnectionM">
        <img src="/connection12.jpg" className="connectionMimg" />
      </div>
      <div className="ConnectionM2">
        <img src="/connection2.jpg" className="connectionM2img" />
      </div>

      <div className="Connection1">
        <img src="/connection12.jpg" className="connection1img" />
      </div>
      <div className="Connection2">
        <img src="/connection2.jpg" className="connection2img" />
      </div>

      <div className="MessageBox">
        <h1 className="MessageTitle">Messages</h1>
        <p className="MsgLine">___________________</p>
      </div>

      <div className="Connections">
        <h2 className="Connects">Your Connections</h2>
      </div>

      <div className="ProjectRepo">
        <h1> Your Current Project Repos</h1>
        <p className="MsgLine2">_______________________</p>
        <div className="Repos"> 
        <p> Project 1 </p>
        <p> Project 2 </p>
        <p> Project 4 </p>
        <p> Project 5 </p>
        </div>
      </div>

      <div className="toggle-switch">
        <label className="switch-label">
          <input
            type="checkbox"
            className="checkbox"
            checked={isOn}
            onChange={() => setIsOn(!isOn)}
          />
          <span className="slider"></span>
        </label>
      </div>
    </div>
  );
}