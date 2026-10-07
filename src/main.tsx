import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './index.css'

// Check app version to bust localStorage and force re-login on version change
const checkAppVersion = () => {
  try {
    const currentVersion = import.meta.env.VITE_APP_VERSION || '0.0.0'
    const storedVersion = localStorage.getItem('app_version')
    if (storedVersion !== currentVersion) {
      // Clear auth-related localStorage items to force re-login
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_id')
      localStorage.removeItem('user_role')
      localStorage.removeItem('admin_auth_token')
      localStorage.removeItem('admin_user_id')
      localStorage.removeItem('doctor_auth_token')
      localStorage.removeItem('doctor_user_id')
      localStorage.removeItem('original_role')
      // Also clear sessionStorage to be safe
      sessionStorage.clear()
      // Update stored version
      localStorage.setItem('app_version', currentVersion)
      // Reload to apply clean state
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