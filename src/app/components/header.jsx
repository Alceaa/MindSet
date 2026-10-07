import React, { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import { useAuth } from "../context/auth.context";

const initialOf = (login) => (login ? login.trim().charAt(0).toUpperCase() : "?");

const Header = () => {
    const { user, isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [anchorEl, setAnchorEl] = useState(null);

    const isSetsTab = searchParams.get("tab") === "sets";
    const isGraphTab = searchParams.get("tab") === "graph";
    const isExploreTab = location.pathname === "/explore";
    const isSavedTab = searchParams.get("tab") === "saved";
    const isHomeTab = !isExploreTab && !isSavedTab && !isSetsTab && !isGraphTab;

    const closeMenu = () => setAnchorEl(null);

    const handleLogout = async () => {
        closeMenu();
        await logout();
        navigate("/signin", { replace: true });
    };

    return (
        <header className="appHeader">
            <div className="headerInner">
                <Link className="brand" to={isAuthenticated ? "/dashboard" : "/signin"}>
                    <span className="brandMark">MS</span>
                    <span className="brandName">MindSet</span>
                </Link>

                <nav className="mainNav">
                    <Link
                        className={`navLink${isExploreTab ? " navLinkActive" : ""}`}
                        to="/explore"
                    >
                        Обзор
                    </Link>
                    {isAuthenticated && (
                        <>
                            <Link
                                className={`navLink${isHomeTab ? " navLinkActive" : ""}`}
                                to="/dashboard"
                            >
                                Домашняя
                            </Link>
                            <Link
                                className={`navLink${isSetsTab ? " navLinkActive" : ""}`}
                                to="/dashboard?tab=sets"
                            >
                                Сеты
                            </Link>
                            <Link
                                className={`navLink${isGraphTab ? " navLinkActive" : ""}`}
                                to="/dashboard?tab=graph"
                            >
                                Граф
                            </Link>
                            <Link
                                className={`navLink${isSavedTab ? " navLinkActive" : ""}`}
                                to="/dashboard?tab=saved"
                            >
                                Сохранённые
                            </Link>
                        </>
                    )}
                </nav>

                <div className="headerActions">
                    {isAuthenticated ? (
                        <>
                            <Link className="btn btnPrimary btnSmall" to="/sets/new">
                                Новый сет
                            </Link>
                            <IconButton
                                onClick={(event) => setAnchorEl(event.currentTarget)}
                                size="small"
                                aria-label="Меню пользователя"
                            >
                                <Avatar src={undefined}>{initialOf(user?.login)}</Avatar>
                            </IconButton>
                            <Menu
                                anchorEl={anchorEl}
                                open={Boolean(anchorEl)}
                                onClose={closeMenu}
                                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                                transformOrigin={{ vertical: "top", horizontal: "right" }}
                            >
                                <div className="userMenuHead">
                                    <strong>{user?.login}</strong>
                                    <span>{user?.email}</span>
                                </div>
                                <Divider />
                                <MenuItem onClick={handleLogout}>Выйти</MenuItem>
                            </Menu>
                        </>
                    ) : (
                        <>
                            <Link className="btn btnGhost btnSmall" to="/signup">
                                Регистрация
                            </Link>
                            <Link className="btn btnPrimary btnSmall" to="/signin">
                                Войти
                            </Link>
                        </>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Header;
