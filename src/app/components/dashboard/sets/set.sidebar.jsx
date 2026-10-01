import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

const WIDTH_KEY = "mindset:sidebar:width";
const MIN_WIDTH = 200;
const MAX_WIDTH = 460;

const readWidth = () => {
    try {
        const stored = Number(window.localStorage.getItem(WIDTH_KEY));
        return Number.isFinite(stored) && stored > 0 ? stored : 288;
    } catch {
        return 288;
    }
};

const SetSidebar = ({ sets, currentId, collapsed, onToggle }) => {
    const [query, setQuery] = useState("");
    const [width, setWidth] = useState(readWidth);
    const resizing = useRef(null);

    useEffect(() => {
        try {
            window.localStorage.setItem(WIDTH_KEY, String(width));
        } catch {
            return;
        }
    }, [width]);

    useEffect(() => {
        const handleMove = (event) => {
            if (!resizing.current) {
                return;
            }
            const delta = event.clientX - resizing.current.startX;
            const next = resizing.current.startWidth + delta;
            setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next)));
        };

        const handleUp = () => {
            resizing.current = null;
        };

        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);

        return () => {
            window.removeEventListener("mousemove", handleMove);
            window.removeEventListener("mouseup", handleUp);
        };
    }, []);

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) {
            return sets;
        }
        return sets.filter((item) => item.title.toLowerCase().includes(needle));
    }, [sets, query]);

    const startResize = (event) => {
        resizing.current = { startX: event.clientX, startWidth: width };
        event.preventDefault();
    };

    if (collapsed) {
        return (
            <aside className="setSidebar setSidebarCollapsed">
                <button
                    type="button"
                    className="setSidebarToggle"
                    onClick={onToggle}
                    title="Показать меню сетов"
                >
                    »
                </button>
            </aside>
        );
    }

    return (
        <aside className="setSidebar" style={{ width: `${width}px` }}>
            <div className="setSidebarHead">
                <span className="setSidebarTitle">
                    Сеты <span className="listMeta">{sets.length}</span>
                </span>
                <button
                    type="button"
                    className="setSidebarToggle"
                    onClick={onToggle}
                    title="Скрыть меню сетов"
                >
                    «
                </button>
            </div>

            <input
                className="input setSidebarSearch"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по названию"
            />

            <ul className="setSidebarList">
                {filtered.map((item) => (
                    <li key={item.id}>
                        <Link
                            className={`setSidebarItem${
                                String(item.id) === String(currentId)
                                    ? " setSidebarItemActive"
                                    : ""
                            }`}
                            to={`/sets/${item.id}`}
                        >
                            {item.title}
                        </Link>
                    </li>
                ))}
                {filtered.length === 0 && (
                    <li className="setSidebarEmpty mutedText">Ничего не найдено</li>
                )}
            </ul>

            <Link className="btn btnGhost btnBlock" to="/sets/new">
                Новый сет
            </Link>

            <div
                className="setSidebarResizer"
                onMouseDown={startResize}
                role="separator"
                aria-orientation="vertical"
            />
        </aside>
    );
};

export default SetSidebar;