import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#111827',
              border: '1px solid #1f2d3d',
              color: '#c8d6e5',
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: '13px',
            },
            success: { iconTheme: { primary: '#00ff9d', secondary: '#0a0e1a' } },
            error: { iconTheme: { primary: '#ff3366', secondary: '#0a0e1a' } },
          }}
        />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
)
