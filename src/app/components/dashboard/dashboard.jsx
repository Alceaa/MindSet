import React, { useState } from 'react';
import Header from '../header.jsx'
import { Link, Navigate} from "react-router-dom";
import { AppBar, Tabs, Tab, Typography, Box } from '@mui/material';
import Home from './home.jsx';
import Sets from './sets.jsx';
import "../../css/dashboard/dashboard.scss";

const Dashboard = () => {
    const [value, setValue] = React.useState(0);
    
    const handleChange = (event, newValue) => {
        setValue(newValue);
    };

    const renderTabContent = () => {
        switch (value) {
        case 0:
            return <Home />;
        case 1:
            return <Sets />;
        default:
            return <Home />;
        }
    };

    return(
        <div>
            <Header/>
            <Box className="tabsBox">
                <Tabs value={value} onChange={handleChange} className="tabs">
                    <Tab label="Домашняя страница" className="tab"/>
                    <Tab label="Сеты" className="tab"/>
                </Tabs>
                <Box sx={{ p: 3 }} className="tabsContent">
                    {renderTabContent()}
                </Box>
            </Box>
        </div>
    );
}

export default Dashboard;
