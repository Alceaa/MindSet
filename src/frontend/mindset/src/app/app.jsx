import React from "react";
import { createRoot } from 'react-dom/client';
import Login from './components/auth/login/login.jsx'
import Registration from './components/auth/registration/registration.jsx'
import Dashboard from "./components/dashboard/dashboard.jsx";
import {
    createBrowserRouter,
    RouterProvider,
    Navigate
  } from "react-router-dom";
import Logout from "./components/auth/logout.jsx";

const router = createBrowserRouter([
    {
        path: "/",
        element: <Navigate to="dashboard/"/>
    },
    {
        path: "dashboard/",
        element: <Dashboard />
    },
    {
        path: "signin/",
        element: <Login />
    },
    {
        path: "signup/",
        element: <Registration />
    },
    {
        path: "logout/",
        element: <Logout />
    }
])

createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <RouterProvider router={router} />
    </React.StrictMode>
);
