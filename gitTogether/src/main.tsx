import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useRoutes } from 'react-router-dom'
import routes from '~react-pages'
import './index.css'

// Define the App component that uses vite-plugin-pages routes
function App() {
  const element = useRoutes(routes)
  return element
}

// Render the app once — wrapped in BrowserRouter
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)

