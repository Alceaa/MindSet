import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import setService from "../../api/set.service";
import parseApiError from "../../utils/api.error";
import SetCard from "../common/set.card.jsx";
import SavedSets from "./saved.sets.jsx";
import { stripMarkdown } from "../../utils/markdown.preview";
import "../../css/dashboard/dashboard.scss";
import "../../css/dashboard/feed.scss";

const VIEW_KEY = "mindset:sets:view";

const VISIBILITY_FILTERS = [
    { value: "all", label: "Все" },
    { value: "public", label: "Публичные" },
    { value: "unlisted", label: "По ссылке" },
    { value: "private", label: "Личные" },
];

const Sets = () => {
    const [sets, setSets] = useState([]);
    const [tombstones, setTombstones] = useState([]);
    const [busyId, setBusyId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [visibility, setVisibility] = useState("all");
    const [view, setView] = useState(() => {
        try {
            return window.localStorage.getItem(VIEW_KEY) === "grid" ? "grid" : "list";
        } catch {
            return "list";
        }
    });

    useEffect(() => {
        try {
            window.localStorage.setItem(VIEW_KEY, view);
        } catch {
            // игнорируем недоступность localStorage
        }
    }, [view]);

    const loadSets = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [setsData, tombstoneData] = await Promise.all([
                setService.getSets(),
                setService.getSetTombstones().catch(() => []),
            ]);
            setSets(setsData);
            setTombstones(tombstoneData);
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSets();
    }, [loadSets]);

    const forbidCopies = async (tombstone) => {
        setBusyId(tombstone.id);
        setError("");
        try {
            await setService.forbidSetTombstone(tombstone.id);
            await loadSets();
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setBusyId(null);
        }
    };

    const filtered = useMemo(() => {
        const needle = search.trim().toLowerCase();
        return sets.filter((set) => {
            if (visibility !== "all" && set.visibility !== visibility) {
                return false;
            }
            if (!needle) {
                return true;
            }
            const haystack = `${set.title} ${set.description} ${set.preview ?? ""}`.toLowerCase();
            return haystack.includes(needle);
        });
    }, [sets, search, visibility]);

    if (loading) {
        return <p className="mutedText">Загружаем сеты…</p>;
    }

    if (error && sets.length === 0) {
        return (
            <div className="alert alertError" role="alert">
                {error}
                <button className="btn btnGhost btnSmall" onClick={loadSets}>
                    Повторить
                </button>
            </div>
        );
    }

    return (
        <div className="page">
            <header className="pageHead">
                <div>
                    <h1 className="pageTitle">Сеты</h1>
                    <p className="pageSubtitle">Ваши заметки и сохранённые снимки</p>
                </div>
                <Link className="btn btnPrimary" to="/sets/new">
                    Новый сет
                </Link>
            </header>

            <div className="setFilters">
                <input
                    className="input setFilterSearch"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Поиск по названию, описанию или содержимому"
                    aria-label="Поиск по сетам"
                />
                <div className="filterChips" role="group" aria-label="Фильтр по доступу">
                    {VISIBILITY_FILTERS.map((item) => (
                        <button
                            key={item.value}
                            type="button"
                            className={`filterChip${
                                visibility === item.value ? " filterChipActive" : ""
                            }`}
                            onClick={() => setVisibility(item.value)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && (
                <div className="alert alertError" role="alert">
                    {error}
                </div>
            )}

            {tombstones.length > 0 && (
                <section className="card">
                    <h2 className="cardTitle">Отложенные удаления</h2>
                    <p className="mutedText">
                        Копии этих сетов остаются у читателей до указанной даты, после чего
                        удалятся безвозвратно. Запрет можно применить досрочно.
                    </p>
                    <ul className="plainList">
                        {tombstones.map((item) => (
                            <li key={item.id}>
                                <span className="savedItemMain">
                                    <span className="listTitle">
                                        {item.title || `Сет #${item.set_id}`}
                                    </span>
                                    <span className="listMeta">копии до {item.deadline}</span>
                                </span>
                                <span className="savedItemActions">
                                    <button
                                        className="btn btnGhost btnSmall"
                                        type="button"
                                        disabled={busyId === item.id || item.forbid_applied}
                                        onClick={() => forbidCopies(item)}
                                    >
                                        {item.forbid_applied
                                            ? "Запрет применён"
                                            : "Запретить копии сейчас"}
                                    </button>
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            <section className="stack">
                <div className="setSectionHead">
                    <h2 className="feedSectionTitle">
                        Авторские <span className="listMeta">{filtered.length}</span>
                    </h2>
                    <div className="viewToggle" role="group" aria-label="Вид отображения">
                        <button
                            type="button"
                            className={`viewToggleBtn${view === "list" ? " viewToggleBtnActive" : ""}`}
                            onClick={() => setView("list")}
                            title="Списком"
                        >
                            ☰ Список
                        </button>
                        <button
                            type="button"
                            className={`viewToggleBtn${view === "grid" ? " viewToggleBtnActive" : ""}`}
                            onClick={() => setView("grid")}
                            title="Сеткой"
                        >
                            ▦ Сетка
                        </button>
                    </div>
                </div>
                {filtered.length === 0 ? (
                    <div className="emptyState">
                        <h2>Сетов не найдено</h2>
                        <p className="mutedText">
                            {sets.length === 0
                                ? "Создайте первый сет — это заметка, внутри которой можно связывать слова с другими сетами."
                                : "Попробуйте изменить запрос или фильтр."}
                        </p>
                        {sets.length === 0 && (
                            <Link className="btn btnPrimary" to="/sets/new">
                                Создать сет
                            </Link>
                        )}
                    </div>
                ) : view === "list" ? (
                    <ul className="setList">
                        {filtered.map((set) => (
                            <li key={set.id}>
                                <Link className="setListRow" to={`/sets/${set.id}`}>
                                    <span className="setListMain">
                                        <span className="setListTitle">{set.title}</span>
                                        <span className="setListPreview">
                                            {stripMarkdown(set.preview || set.description || "")}
                                        </span>
                                    </span>
                                    <span className="setListMeta">
                                        изменён {set.last_activity}
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="setGrid">
                        {filtered.map((set) => (
                            <SetCard
                                key={set.id}
                                set={set}
                                to={`/sets/${set.id}`}
                                likeable={false}
                                showAuthor={false}
                            />
                        ))}
                    </div>
                )}
            </section>

            <SavedSets query={search} />
        </div>
    );
};

export default Sets;

