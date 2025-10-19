import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function Welcome() {

    const navigate = useNavigate()

  const handleFakeSignIn = () => {
    // Simulate a short "login" delay
    setTimeout(() => {
      // Redirect to a fake dashboard page
      navigate('/preferences')
    }, 1000)
  }
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center bg-gray-50 w-screen">
      <h1 className="text-5xl font-bold mb-4 pb-[1%]">Welcome to gitTogether</h1>
      <button onClick={handleFakeSignIn} className=" bg-black text-white rounded-lg hover:bg-gray-700 p-[10px]">
        Sign in with GitHub
      </button>
    </div>)
}