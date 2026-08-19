import axios from 'axios'

// In production the React build is served by Nginx, which proxies /api/ to
// the FastAPI backend at 127.0.0.1:8000. In local dev Vite's dev server
// proxies /api/ to http://localhost:8000 (configured in vite.config.js).
// Either way, relative paths work without touching this file.
const client = axios.create({
  baseURL: '/api',
})

export default client
