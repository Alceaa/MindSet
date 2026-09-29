import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { useAuth } from "../../context/auth.context";
import Home from "./home.jsx";
import Sets from "./sets.jsx";
import Graph from "./graph.jsx";
import "../../css/dashboard/dashboard.scss";
import "../../css/dashboard/graph.scss";

const TABS = ["home", "sets", "graph"];

const Dashboard = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const tabParam = searchParams.get("tab");
    const activeTab = Math.max(TABS.indexOf(tabParam), 0);

    const handleChange = (event, value) => {
        const next = TABS[value];
        setSearchParams(next === "home" ? {} : { tab: next }, { replace: true });
    };

    const renderTabContent = () => {
        switch (TABS[activeTab]) {
            case "sets":
                return <Sets />;
            case "graph":
                return <Graph />;
            default:
                return <Home />;
        }
    };

    return (
        <div className="page">
            <div className="pageHead">
                <div>
                    <h1 className="pageTitle">Привет, {user?.login}</h1>
                    <p className="pageSubtitle">
                        Ваши сеты, связи между ними и последние изменения
                    </p>
                </div>
                <Link className="btn btnPrimary" to="/sets/new">
                    Новый сет
                </Link>
            </div>

            <Box className="tabsBox">
                <Tabs
                    value={activeTab}
                    onChange={handleChange}
                    variant="scrollable"
                    allowScrollButtonsMobile
                >
                    <Tab label="Домашняя страница" />
                    <Tab label="Сеты" />
                    <Tab label="Граф связей" />
                </Tabs>
                <Box className="tabsContent">{renderTabContent()}</Box>
            </Box>
        </div>
    );
};

export default Dashboard;
