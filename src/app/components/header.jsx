import React, { useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Divider from "@mui/material/Divider";
import { useAuth } from "../context/auth.context";
import SearchModal from "./common/search.modal.jsx";

const initialOf = (login) => (login ? login.trim().charAt(0).toUpperCase() : "?");

const Header = () => {
    const { user, isAuthenticated, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const [anchorEl, setAnchorEl] = useState(null);
    const [searchOpen, setSearchOpen] = useState(false);

    const isSetsTab = searchParams.get("tab") === "sets";
    const isGraphTab = searchParams.get("tab") === "graph";
    const isExploreTab = location.pathname === "/explore";
    const isProfileTab = location.pathname.startsWith("/u/") || location.pathname === "/settings";
    const isHomeTab = !isExploreTab && !isSetsTab && !isGraphTab && !isProfileTab;

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
                        </>
                    )}
                </nav>

                <div className="headerActions">
                    <button
                        className="btn btnGhost btnSmall searchTrigger"
                        type="button"
                        onClick={() => setSearchOpen(true)}
                        aria-label="Поиск сетов"
                    >
                        <span aria-hidden="true">🔍</span>
                        <span className="searchTriggerLabel">Поиск</span>
                    </button>

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
                                <Avatar src={user?.avatar || undefined}>{initialOf(user?.login)}</Avatar>
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
                                <MenuItem
                                    component={Link}
                                    to={`/u/${user?.login ?? ""}`}
                                    onClick={closeMenu}
                                >
                                    Мой профиль
                                </MenuItem>
                                <MenuItem component={Link} to="/settings" onClick={closeMenu}>
                                    Настройки профиля
                                </MenuItem>
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

            <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
        </header>
    );
};

export default Header;
