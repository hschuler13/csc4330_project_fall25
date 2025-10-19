import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { useState } from "react";

export default function Preferences() {
    const navigate = useNavigate();
  let topics: String[] = [
    "javascript",
    "python",
    "java",
    "react",
    "html",
    "css",
    "nodejs",
    "typescript",
    "csharp",
    "vue",
    "docker",
    "kubernetes",
    "machine-learning",
    "deep-learning",
    "data-science",
    "graphql",
    "android",
    "ios",
    "devops",
    "flutter",
  ];

  const [activeButtons, setActiveButtons] = useState(
    Array(topics.length).fill(false)
  );

  const colorClick = (index: any) => {
    const newState = [...activeButtons];
    newState[index] = !newState[index]; // toggle the state
    setActiveButtons(newState);
  };

    const handleFakeSubmit = () => {
    // Simulate a short "login" delay
    setTimeout(() => {
      // Redirect to a fake dashboard page
      navigate('/home')
    }, 1000)
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center bg-gray-50 w-screen">
      <div className="flex flex-col items-center justify-center text-center">
        <h1 className="text-3xl font-bold mb-4 pb-px text-[#1a1a1a]">
          Select topics that interest you
        </h1>
        <h3 className="text-m font-medium mb-4 pb-px">
          We will give you tasks that suit your preferences{" "}
        </h3>
        <div className="flex flex-row">
            <Input
              className="w-[70%] border-solid border-black border-2 mr-[10px] text-[#1a1a1a]"
              placeholder="Search topics..."
            />
            <Button className="w-[30%] bg-black text-white" onClick={handleFakeSubmit}>Submit</Button>
        </div>
      </div>
      <div className="flex justify-center pt-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {topics.map((topic, i) => (
            <Button
              key={i}
              onClick={() => colorClick(i)}
              className={`${
    activeButtons[i] ? "bg-black text-teal-200" : "bg-black text-white"
  }`}
            >
              {topic}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
