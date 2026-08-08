import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import FlightDetail from "./pages/FlightDetail";
import Friends from "./pages/Friends";
import FriendFlights from "./pages/FriendFlights";
import SharedFlightPage from "./pages/SharedFlight";
import Join from "./pages/Join";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route element={<App />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/flight/:id" element={<FlightDetail />} />
                    <Route path="/friends" element={<Friends />} />
                    <Route path="/friends/:userId" element={<FriendFlights />} />
                    <Route path="/s/:token" element={<SharedFlightPage />} />
                    <Route path="/join/:token" element={<Join />} />
                </Route>
            </Routes>
        </BrowserRouter>
    </React.StrictMode>
);
