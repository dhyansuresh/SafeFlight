import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import FlightMap from "./pages/FlightMap";
import FlightDetail from "./pages/FlightDetail";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<App />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/map" element={<FlightMap />} />
          <Route path="/flight/:id" element={<FlightDetail />} />
          {/* Later: /card/:token (public shared card), /friends, /flight/:id */}
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
