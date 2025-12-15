// main.jsx - Vérifiez l'ordre des imports
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';  // ⚠️ IMPORTANT : Doit venir avant App.jsx
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);