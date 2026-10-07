import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import setService from "../../api/set.service";
import parseApiError from "../../utils/api.error";
import { useAuth } from "../../context/auth.context";
import SetCard from "./set.card.jsx";
import "../../css/dashboard/feed.scss";

const PAGE_SIZE = 24;

const SearchModal = ({ open, onClose }) => {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const [query, setQuery] = useState("");
    const [debounced, setDebounced] = useState("");
    const [sets, setSets] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState(null);
    const [savingId, setSavingId] = useState(null);
    const inputRef = useRef(null);

    const close = useCallback(() => {
        onClose?.();
    }, [onClose]);

    useEffect(() => {
        if (!open) {
            setQuery("");
            setDebounced("");
            setSets([]);
            setTotal(0);
            return undefined;
        }

        const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 10);
        const handleKey = (event) => {
            if (event.key === "Escape") {
                close();
            }
        };
        window.addEventListener("keydown", handleKey);
        return () => {
            window.clearTimeout(focusTimer);
            window.removeEventListener("keydown", handleKey);
        };
    }, [open, close]);

    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(query.trim()), 250);
        return () => window.clearTimeout(timer);
    }, [query]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }
        let cancelled = false;
        setLoading(true);
        setError("");
        setService
            .getPublicSets({ q: debounced || undefined, limit: PAGE_SIZE, offset: 0 })
            .then((data) => {
                if (!cancelled) {
                    setSets(data.sets ?? []);
                    setTotal(data.total ?? 0);
                }
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
    }, [open, debounced]);

    const handleSave = async (set) => {
        if (!isAuthenticated) {
            navigate("/signin");
            return;
        }
        setSavingId(set.id);
        setNotice(null);
        try {
            await setService.saveExternalSet(set.slug);
            setNotice({ kind: "success", text: `Сет «${set.title}» сохранён в вашу библиотеку` });
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setSavingId(null);
        }
    };

    const isOwn = (set) =>
        Boolean(set.author) && Boolean(user) && set.author.login === user.login;

    if (!open) {
        return null;
    }

    return (
        <div className="searchOverlay" role="dialog" aria-modal="true" onClick={close}>
            <div className="searchModal" onClick={(event) => event.stopPropagation()}>
                <header className="searchModalHead">
                    <input
                        ref={inputRef}
                        className="searchModalInput"
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Поиск сетов по названию и описанию…"
                        aria-label="Поиск сетов"
                    />
                    <button
                        type="button"
                        className="searchModalClose"
                        onClick={close}
                        aria-label="Закрыть поиск"
                    >
                        ✕
                    </button>
                </header>

                <div className="searchModalBody" onClick={close}>
                    {notice && (
                        <div
                            className={`alert${notice.kind === "error" ? " alertError" : " alertSuccess"}`}
                            role="status"
                        >
                            {notice.text}
                        </div>
                    )}
                    {loading && <p className="mutedText">Ищем…</p>}
                    {error && <p className="errorText">{error}</p>}
                    {!loading && !error && debounced && (
                        <p className="listMeta searchCount">Найдено: {total}</p>
                    )}
                    {!loading && !error && sets.length === 0 && (
                        <p className="mutedText">
                            {debounced ? "Ничего не найдено" : "Начните вводить запрос"}
                        </p>
                    )}
                    <div className="setGrid">
                        {sets.map((set) => (
                            <SetCard
                                key={set.id}
                                set={set}
                                to={`/s/${set.slug}`}
                                own={isOwn(set)}
                                onSave={isOwn(set) ? undefined : handleSave}
                                saving={savingId === set.id}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SearchModal;

