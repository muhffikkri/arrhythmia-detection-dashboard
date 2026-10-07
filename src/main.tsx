import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'

// Check app version to bust localStorage/sessionStorage/cookies on version change.
// Full wipe (not just auth keys) so stale state from a previous deploy cannot
// be reused after VITE_APP_VERSION is bumped in .env.
const checkAppVersion = () => {
  try {
    const currentVersion = import.meta.env.VITE_APP_VERSION || '0.0.0'
    const storedVersion = localStorage.getItem('app_version')
    if (storedVersion !== currentVersion) {
      localStorage.clear()
      sessionStorage.clear()
      document.cookie.split(';').forEach((c) => {
        const name = c.split('=')[0].trim()
        document.cookie = `${name}=; path=/; domain=${location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
        document.cookie = `${name}=; path=/; domain=.${location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT`
      })
      localStorage.setItem('app_version', currentVersion)
      window.location.reload()
    }
  } catch (e) {
    console.warn('Failed to check app version', e)
  }
}

// Menghubungkan aplikasi React ke elemen <div id="root"> di index.html
checkAppVersion()
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)