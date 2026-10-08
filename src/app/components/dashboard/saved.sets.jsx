import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import setService from "../../api/set.service";
import parseApiError from "../../utils/api.error";
import "../../css/dashboard/dashboard.scss";

const STATE_META = {
    live: { label: "Актуален", badgeClass: "badge badgeSuccess" },
    frozen: { label: "Заморожен", badgeClass: "badge" },
    attention: { label: "Требует внимания", badgeClass: "badge badgeWarning" },
    source_gone: { label: "Источник удалён", badgeClass: "badge" },
    hidden: { label: "Источник закрыт", badgeClass: "badge badgeWarning" },
    suppressed: { label: "Доступ отозван", badgeClass: "badge badgeWarning" },
};

const stateMeta = (state) => STATE_META[state] ?? { label: state, badgeClass: "badge" };

const openTargetFor = (item) => {
    if (item.frozen) {
        return `/snapshots/${item.id}`;
    }
    if (
        item.state === "source_gone" ||
        item.state === "hidden" ||
        item.state === "suppressed"
    ) {
        return `/snapshots/${item.id}`;
    }
    if (item.live_slug) {
        return `/s/${item.live_slug}`;
    }
    return `/snapshots/${item.id}`;
};

const SavedSets = ({ query = "" }) => {
    const [items, setItems] = useState([]);
    const [attention, setAttention] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const data = await setService.getSavedSets();
            setItems(data.saved ?? []);
            setAttention(data.attention ?? []);
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const runAction = async (id, action) => {
        setBusyId(id);
        setError("");
        try {
            await action();
            await load();
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setBusyId(null);
        }
    };

    const handleRefresh = (id) => runAction(id, () => setService.refreshSavedSet(id));

    const handleFreeze = (item) =>
        runAction(item.id, () => setService.freezeSavedSet(item.id, !item.frozen));

    const handleRemove = (item) => {
        const confirmed = window.confirm(
            `Убрать «${item.title}» из библиотеки? Снимок будет удалён безвозвратно.`
        );
        if (!confirmed) {
            return;
        }
        runAction(item.id, () => setService.deleteSavedSet(item.id));
    };

    const renderItem = (item) => {
        const meta = stateMeta(item.state);
        const target = openTargetFor(item);
        const busy = busyId === item.id;
        const canRefresh =
            item.set_id > 0 && item.state !== "hidden" && item.state !== "suppressed";

        return (
            <div className="savedItem" key={item.id}>
                <div className="savedItemMain">
                    {target ? (
                        <Link className="savedItemTitle" to={target}>
                            {item.title}
                        </Link>
                    ) : (
                        <span className="savedItemTitle">{item.title}</span>
                    )}
                    <div className="savedItemMeta">
                        <span className={meta.badgeClass}>{meta.label}</span>
                        <span className="badge">@{item.source_login}</span>
                        <span className="listMeta">сохранён {item.date_saved}</span>
                        <span className="listMeta">обновлён {item.last_update}</span>
                    </div>
                </div>
                <div className="savedItemActions">
                    <button
                        className="btn btnGhost btnSmall"
                        type="button"
                        disabled={busy || !canRefresh}
                        onClick={() => handleRefresh(item.id)}
                    >
                        Обновить
                    </button>
                    <button
                        className="btn btnGhost btnSmall"
                        type="button"
                        disabled={busy || item.set_id === 0}
                        onClick={() => handleFreeze(item)}
                    >
                        {item.frozen ? "Разморозить" : "Заморозить"}
                    </button>
                    <button
                        className="btn btnGhost btnSmall"
                        type="button"
                        disabled={busy}
                        onClick={() => handleRemove(item)}
                    >
                        Убрать
                    </button>
                </div>
            </div>
        );
    };

    if (loading) {
        return <p className="mutedText">Загружаем сохранённые сеты...</p>;
    }

    if (error && items.length === 0) {
        return (
            <div className="alert alertError" role="alert">
                {error}
                <button className="btn btnGhost btnSmall" onClick={load}>
                    Повторить
                </button>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="emptyState">
                <h2>Сохранённых сетов пока нет</h2>
                <p className="mutedText">
                    Откройте «Обзор» и сохраните чужой сет — появится личный снимок,
                    который переживёт удаление источника.
                </p>
                <Link className="btn btnPrimary" to="/explore">
                    Перейти в обзор
                </Link>
            </div>
        );
    }

    const needle = query.trim().toLowerCase();
    const matchQuery = (item) => !needle || item.title.toLowerCase().includes(needle);
    const visibleItems = items.filter(matchQuery);
    const visibleAttention = attention.filter(matchQuery);
    const rest = visibleItems.filter((item) => item.state !== "attention");

    return (
        <div className="savedPanel">
            {error && (
                <div className="alert alertError" role="alert">
                    {error}
                </div>
            )}

            {visibleItems.length === 0 ? (
                <p className="mutedText">По запросу «{query}» снимков не найдено.</p>
            ) : (
                <>
                    {visibleAttention.length > 0 && (
                        <section className="savedSection">
                            <h2 className="savedSectionTitle">
                                Требует внимания{" "}
                                <span className="listMeta">{visibleAttention.length}</span>
                            </h2>
                            <p className="mutedText savedSectionHint">
                                Автор изменил исходный сет, а снимок заморожен. Обновите снимок или
                                оставьте как есть.
                            </p>
                            <div className="savedList">{visibleAttention.map(renderItem)}</div>
                        </section>
                    )}

                    <section className="savedSection">
                        <h2 className="savedSectionTitle">
                            Все снимки <span className="listMeta">{visibleItems.length}</span>
                        </h2>
                        <div className="savedList">{rest.map(renderItem)}</div>
                    </section>
                </>
            )}
        </div>
    );
};

export default SavedSets;
