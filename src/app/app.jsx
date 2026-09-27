import React from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "./theme";
import { AuthProvider } from "./context/auth.context";
import RequireAuth from "./components/routing/require.auth.jsx";
import RedirectIfAuthed from "./components/routing/redirect.if.authed.jsx";
import RootRedirect from "./components/routing/root.redirect.jsx";
import NotFound from "./components/routing/not.found.jsx";
import AppLayout from "./layouts/app.layout.jsx";
import AuthLayout from "./layouts/auth.layout.jsx";
import Login from "./components/auth/login/login.jsx";
import Registration from "./components/auth/registration/registration.jsx";
import Logout from "./components/auth/logout.jsx";
import Dashboard from "./components/dashboard/dashboard.jsx";
import CreateSet from "./components/dashboard/sets/create.set.jsx";

const router = createBrowserRouter([
    {
        path: "/",
        element: <RootRedirect />,
    },
    {
        element: <AuthLayout />,
        children: [
            {
                path: "signin",
                element: (
                    <RedirectIfAuthed>
                        <Login />
                    </RedirectIfAuthed>
                ),
            },
            {
                path: "signup",
                element: (
                    <RedirectIfAuthed>
                        <Registration />
                    </RedirectIfAuthed>
                ),
            },
        ],
    },
    {
        element: <AppLayout />,
        children: [
            {
                path: "dashboard",
                element: (
                    <RequireAuth>
                        <Dashboard />
                    </RequireAuth>
                ),
            },
            {
                path: "sets/new",
                element: (
                    <RequireAuth>
                        <CreateSet />
                    </RequireAuth>
                ),
            },
            {
                path: "logout",
                element: (
                    <RequireAuth>
                        <Logout />
                    </RequireAuth>
                ),
            },
        ],
    },
    {
        path: "*",
        element: <NotFound />,
    },
]);

const App = () => (
    <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
            <RouterProvider router={router} />
        </AuthProvider>
    </ThemeProvider>
);

export default App;

