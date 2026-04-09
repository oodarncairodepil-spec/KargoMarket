import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthBootstrap } from './components/AuthBootstrap'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthBootstrap>
        <App />
      </AuthBootstrap>
    </BrowserRouter>
  </StrictMode>,
)
