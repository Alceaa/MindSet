import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import setService from "../../api/set.service";
import parseApiError from "../../utils/api.error";
import { useAuth } from "../../context/auth.context";
import "../../css/dashboard/dashboard.scss";

const PAGE_SIZE = 12;

const Explore = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const [sets, setSets] = useState([]);
    const [total, setTotal] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState(null);
    const [savingId, setSavingId] = useState(null);
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");

    const loadPage = useCallback(
        (searchValue, offset) =>
            setService.getPublicSets({
                q: searchValue || undefined,
                limit: PAGE_SIZE,
                offset,
            }),
        []
    );

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        setError("");

        loadPage(query, 0)
            .then((data) => {
                if (cancelled) {
                    return;
                }
                setSets(data.sets ?? []);
                setTotal(data.total ?? 0);
                setHasMore(Boolean(data.has_more));
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(parseApiError(err).message);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [loadPage, query]);

    const handleLoadMore = async () => {
        setLoadingMore(true);
        setError("");
        try {
            const data = await loadPage(query, sets.length);
            setSets((current) => [...current, ...(data.sets ?? [])]);
            setTotal(data.total ?? 0);
            setHasMore(Boolean(data.has_more));
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setLoadingMore(false);
        }
    };

    const handleSubmit = (event) => {
        event.preventDefault();
        setQuery(search.trim());
    };

    const handleReset = () => {
        setSearch("");
        setQuery("");
    };

    const handleSave = async (set) => {
        if (!isAuthenticated) {
            navigate("/signin");
            return;
        }

        setSavingId(set.id);
        setNotice(null);
        try {
            await setService.saveExternalSet(set.slug);
            setNotice({
                kind: "success",
                text: `Сет «${set.title}» сохранён в вашу библиотеку`,
            });
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setSavingId(null);
        }
    };

    return (
        <section className="explore">
            <header className="exploreHead">
                <h1 className="exploreTitle">Публичные сеты</h1>
                <p className="mutedText">
                    Заметки, открытые авторами для всех.
                </p>
            </header>

            <form className="exploreSearch" onSubmit={handleSubmit} role="search">
                <input
                    className="input"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Поиск по названию или описанию"
                    maxLength={100}
                    aria-label="Поиск по публичным сетам"
                />
                <button className="btn btnPrimary" type="submit">
                    Найти
                </button>
                {query !== "" && (
                    <button className="btn btnGhost" type="button" onClick={handleReset}>
                        Сбросить
                    </button>
                )}
            </form>

            {error !== "" && (
                <div className="alert alertError" role="alert">
                    {error}
                </div>
            )}

            {notice && (
                <div
                    className={`alert ${notice.kind === "success" ? "alertSuccess" : "alertError"}`}
                    role="status"
                >
                    {notice.text}
                </div>
            )}

            {loading ? (
                <p className="mutedText">Загружаем публичные сеты...</p>
            ) : sets.length === 0 ? (
                <div className="emptyState">
                    <h2>{query === "" ? "Публичных сетов пока нет" : "Ничего не найдено"}</h2>
                    <p className="mutedText">
                        {query === ""
                            ? "Откройте свой сет для всех — он появится здесь."
                            : "Попробуйте другое слово или сбросьте поиск."}
                    </p>
                    {query === "" ? (
                        <Link className="btn btnPrimary" to="/sets/new">
                            Создать сет
                        </Link>
                    ) : (
                        <button className="btn btnGhost" type="button" onClick={handleReset}>
                            Сбросить поиск
                        </button>
                    )}
                </div>
            ) : (
                <>
                    <p className="exploreCount mutedText">Найдено: {total}</p>
                    <div className="setGrid">
                        {sets.map((set) => {
                            const isOwn =
                                Boolean(set.author) &&
                                Boolean(user) &&
                                set.author.login === user.login;

                            return (
                                <div className="setCard" key={set.id}>
                                    <Link className="setCardMain" to={`/s/${set.slug}`}>
                                        <h3 className="setTitle">{set.title}</h3>
                                        {set.description ? (
                                            <p className="setDescription">{set.description}</p>
                                        ) : (
                                            <p className="setDescription mutedText">
                                                Без описания
                                            </p>
                                        )}
                                    </Link>
                                    <div className="setMeta">
                                        <span className="badge">
                                            {set.author ? `@${set.author.login}` : "автор скрыт"}
                                        </span>
                                        <span className="listMeta">
                                            Изменён {set.last_activity}
                                        </span>
                                    </div>
                                    {!isOwn && (
                                        <button
                                            className="btn btnGhost btnSmall"
                                            type="button"
                                            disabled={savingId === set.id}
                                            onClick={() => handleSave(set)}
                                        >
                                            {savingId === set.id
                                                ? "Сохраняем..."
                                                : "Сохранить"}
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                    {hasMore && (
                        <div className="exploreMore">
                            <button
                                className="btn btnGhost"
                                type="button"
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                            >
                                {loadingMore ? "Загружаем..." : "Показать ещё"}
                            </button>
                        </div>
                    )}
                </>
            )}
        </section>
    );
};

export default Explore;
