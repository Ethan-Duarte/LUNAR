import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import {InterfaceBoundary} from './lunar/InterfaceBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InterfaceBoundary label="Interface"><App /></InterfaceBoundary>
  </StrictMode>,
)
