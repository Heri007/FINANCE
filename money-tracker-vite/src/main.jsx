// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";

import "./index.css";
import App from "./App.jsx";

import { UserProvider } from "./contexts/UserContext";
import { FinanceProvider } from "./contexts/FinanceContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <UserProvider>
      <FinanceProvider>
        <App />
      </FinanceProvider>
    </UserProvider>
  </React.StrictMode>
);
