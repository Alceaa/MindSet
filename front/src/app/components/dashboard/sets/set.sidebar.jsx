import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

const WIDTH_KEY = "mindset:sidebar:width";
const COLLAPSED_KEY = "mindset:sidebar:collapsed-groups";
const MIN_WIDTH = 200;
const MAX_WIDTH = 460;

// Прокрутка списка переживает перерисовки: при открытии сета список
// не должен прыгать в начало.
let savedScrollTop = 0;

const readWidth = () => {
    try {
        const stored = Number(window.localStorage.getItem(WIDTH_KEY));
        return Number.isFinite(stored) && stored > 0 ? stored : 288;
    } catch {
        return 288;
    }
};

const readCollapsedGroups = () => {
    try {
        const raw = window.localStorage.getItem(COLLAPSED_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
        return [];
    }
};

const SetSidebar = ({ sets, collections = [], currentId, collapsed, onToggle }) => {
    const [query, setQuery] = useState("");
    const [width, setWidth] = useState(readWidth);
    const [collapsedGroups, setCollapsedGroups] = useState(readCollapsedGroups);
    const listRef = useRef(null);
    const resizing = useRef(null);

    useEffect(() => {
        try {
            window.localStorage.setItem(WIDTH_KEY, String(width));
        } catch {
            return;
        }
    }, [width]);

    useEffect(() => {
        try {
            window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsedGroups));
        } catch {
            return;
        }
    }, [collapsedGroups]);

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

    // Группы: коллекции по своему порядку, сеты без коллекции — в конце.
    const groups = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const visible = needle
            ? sets.filter((item) => item.title.toLowerCase().includes(needle))
            : sets;

        const buckets = new Map();
        const without = [];

        for (const item of visible) {
            const itemCollections = item.collections ?? [];

            if (itemCollections.length > 0) {
                // Сет может лежать сразу в нескольких коллекциях — показываем его в каждой.
                for (const collection of itemCollections) {
                    const bucket = buckets.get(collection.id) ?? {
                        id: collection.id,
                        items: [],
                    };
                    bucket.items.push(item);
                    buckets.set(collection.id, bucket);
                }
            } else {
                without.push(item);
            }
        }

        const result = collections
            .filter((collection) => buckets.has(collection.id))
            .map((collection) => ({
                id: collection.id,
                title: collection.title,
                color: collection.color,
                items: buckets.get(collection.id).items,
            }));

        // Коллекция могла пропасть из списка (удалили в другой вкладке) — показываем как есть.
        for (const [id, bucket] of buckets) {
            if (!result.some((group) => group.id === id)) {
                result.push({ id, title: "Коллекция", color: "", items: bucket.items });
            }
        }

        if (without.length > 0) {
            result.push({ id: 0, title: "Без коллекции", color: "", items: without });
        }

        return result;
    }, [sets, collections, query]);

    const itemCount = groups.reduce((sum, group) => sum + group.items.length, 0);
    const centeredOnce = useRef(false);

    // Список приходит асинхронно и может перерисоваться: пока элементов нет, прокрутку
    // ставить некуда, поэтому возвращаем её каждый раз, когда элементы появились.
    useLayoutEffect(() => {
        const list = listRef.current;
        if (!list || itemCount === 0) {
            return;
        }

        if (savedScrollTop > 0) {
            list.scrollTop = savedScrollTop;
            return;
        }

        if (!centeredOnce.current) {
            centeredOnce.current = true;
            // Первый показ: подводим список к открытому сету, чтобы он был на виду.
            list.querySelector(".setSidebarItemActive")?.scrollIntoView({ block: "nearest" });
        }
    }, [itemCount]);

    const toggleGroup = (id) => {
        setCollapsedGroups((current) => {
            const key = String(id);
            return current.includes(key)
                ? current.filter((item) => item !== key)
                : [...current, key];
        });
    };

    const handleScroll = (event) => {
        savedScrollTop = event.currentTarget.scrollTop;
    };

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
                    aria-label="Показать меню сетов"
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
                    aria-label="Скрыть меню сетов"
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

            <ul className="setSidebarList" ref={listRef} onScroll={handleScroll}>
                {groups.map((group) => {
                    const isCollapsed = collapsedGroups.includes(String(group.id));

                    return (
                        <li key={group.id} className="setSidebarGroup">
                            <button
                                type="button"
                                className="setSidebarGroupHead"
                                onClick={() => toggleGroup(group.id)}
                                aria-expanded={!isCollapsed}
                            >
                                <span className="setSidebarGroupArrow" aria-hidden="true">
                                    {isCollapsed ? "▸" : "▾"}
                                </span>
                                {group.id !== 0 && (
                                    <span
                                        className={`collectionDot collectionDot-${group.color || "default"}`}
                                        aria-hidden="true"
                                    />
                                )}
                                <span className="setSidebarGroupTitle">{group.title}</span>
                                <span className="listMeta">{group.items.length}</span>
                            </button>

                            {!isCollapsed && (
                                <ul className="setSidebarGroupList">
                                    {group.items.map((item) => (
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
                                </ul>
                            )}
                        </li>
                    );
                })}

                {groups.length === 0 && (
                    <li className="setSidebarEmpty mutedText">
                        {sets.length === 0 ? "Сетов пока нет" : "Ничего не найдено"}
                    </li>
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