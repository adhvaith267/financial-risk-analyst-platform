import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Landing from "./pages/Landing.jsx"
import Platform from "./pages/Platform.jsx"
export default function App(){return <BrowserRouter><Routes><Route path="/" element={<Landing />} /><Route path="/platform" element={<Platform />} /><Route path="*" element={<Navigate to="/" replace />} /></Routes></BrowserRouter>}