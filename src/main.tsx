// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Login from './pages/Login'
import Formulario from './pages/Formulario'
import AdminPanel from './pages/Admin/AdminPanel'  // ← Agregar import
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/formulario" element={<Formulario />} />
        <Route path="/admin" element={<AdminPanel />} />  {/* ← Agregar esta línea */}
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)