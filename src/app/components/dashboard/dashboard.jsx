import React from "react";
import { useSearchParams } from "react-router-dom";
import Home from "./home.jsx";
import Sets from "./sets.jsx";
import Graph from "./graph.jsx";
import "../../css/dashboard/dashboard.scss";
import "../../css/dashboard/graph.scss";

const Dashboard = () => {
    const [searchParams] = useSearchParams();
    const tab = searchParams.get("tab");

    if (tab === "sets") {
        return <Sets />;
    }
    if (tab === "graph") {
        return <Graph />;
    }
    return <Home />;
};

export default Dashboard;

