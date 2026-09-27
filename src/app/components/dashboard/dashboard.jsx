import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import Box from "@mui/material/Box";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import { useAuth } from "../../context/auth.context";
import Home from "./home.jsx";
import Sets from "./sets.jsx";
import "../../css/dashboard/dashboard.scss";

const TAB_SETS = "sets";
const Dashboard = () => {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const activeTab = searchParams.get("tab") === TAB_SETS ? 1 : 0;

    const handleChange = (event, value) => {
        setSearchParams(value === 1 ? { tab: TAB_SETS } : {}, { replace: true });
    };

    return (
        <div className="page">
            <div className="pageHead">
                <div>
                    <h1 className="pageTitle">Привет, {user?.login}</h1>
                    <p className="pageSubtitle">Ваши сеты и последние изменения</p>
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
                </Tabs>
                <Box className="tabsContent">{activeTab === 1 ? <Sets /> : <Home />}</Box>
            </Box>
        </div>
    );
};

export default Dashboard;
