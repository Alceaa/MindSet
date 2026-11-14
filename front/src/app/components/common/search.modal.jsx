import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import setService from "../../api/set.service";
import parseApiError from "../../utils/api.error";
import { useAuth } from "../../context/auth.context";
import SetCard from "./set.card.jsx";
import { Skeleton } from "./skeleton.jsx";
import EmptyState from "./empty.state.jsx";
import { useToast } from "./toast.jsx";
import "../../css/dashboard/feed.scss";

const PAGE_SIZE = 24;

const SearchModal = ({ open, onClose }) => {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const { push } = useToast();
    const [query, setQuery] = useState("");
    const [debounced, setDebounced] = useState("");
    const [sets, setSets] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [savingId, setSavingId] = useState(null);
    // Сеты, для которых снимок уже сделан в этой сессии: кнопка показывает «Сохранено».
    const [savedIds, setSavedIds] = useState(() => new Set());
    const inputRef = useRef(null);
    const modalRef = useRef(null);
    const previousFocus = useRef(null);

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

        previousFocus.current = document.activeElement;
        const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 10);

        const handleKey = (event) => {
            if (event.key === "Escape") {
                close();
                return;
            }
            if (event.key !== "Tab") {
                return;
            }

            const node = modalRef.current;
            if (!node) {
                return;
            }
            const focusable = node.querySelectorAll(
                'a[href], button:not([disabled]), input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])'
            );
            if (focusable.length === 0) {
                return;
            }
            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        window.addEventListener("keydown", handleKey);
        return () => {
            window.clearTimeout(focusTimer);
            window.removeEventListener("keydown", handleKey);
            if (previousFocus.current instanceof HTMLElement) {
                previousFocus.current.focus();
            }
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
        try {
            await setService.saveExternalSet(set.slug);
            // Снимок сделан: кнопка становится «Сохранено», чтобы не жать её дважды.
            setSavedIds((current) => new Set(current).add(set.id));
            push(`Сет «${set.title}» сохранён в вашу библиотеку`, "success");
        } catch (err) {
            push(parseApiError(err).message, "error");
        } finally {
            setSavingId(null);
        }
    };

    const isOwn = (set) =>
        Boolean(set.author) && Boolean(user) && set.author.login === user.login;

    // Снимок мог быть сделан раньше (серверный is_saved) или только что в этой сессии.
    const isSaved = (set) => Boolean(set.is_saved) || savedIds.has(set.id);

    if (!open) {
        return null;
    }

    return (
        <div
            className="searchOverlay"
            role="dialog"
            aria-modal="true"
            aria-label="Поиск сетов"
            onClick={close}
        >
            <div className="searchModal" ref={modalRef} onClick={(event) => event.stopPropagation()}>
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
                    {error && <p className="errorText">{error}</p>}
                    {loading && <Skeleton variant="card" count={4} label="Ищем…" />}
                    {!loading && !error && debounced && (
                        <p className="listMeta searchCount">Найдено: {total}</p>
                    )}
                    {!loading && !error && sets.length === 0 && (
                        <EmptyState
                            variant="inline"
                            title={debounced ? "Ничего не найдено" : "Начните вводить запрос"}
                        />
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
                                saved={isSaved(set)}
                                saveLabel={isSaved(set) ? "Сохранено" : "Сохранить"}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SearchModal;

