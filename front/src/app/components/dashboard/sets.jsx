import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import setService from "../../api/set.service";
import collectionService from "../../api/collection.service";
import parseApiError from "../../utils/api.error";
import SetCard from "../common/set.card.jsx";
import SavedSets from "./saved.sets.jsx";
import CollectionPicker from "../collections/collection.picker.jsx";
import CollectionsPanel from "../collections/collections.panel.jsx";
import Pagination from "../common/pagination.jsx";
import { Skeleton } from "../common/skeleton.jsx";
import EmptyState from "../common/empty.state.jsx";
import useCollections from "../../hooks/use.collections";
import { stripMarkdown } from "../../utils/markdown.preview";
import "../../css/dashboard/dashboard.scss";
import "../../css/dashboard/feed.scss";
import "../../css/collections/collections.scss";

const VIEW_KEY = "mindset:sets:view";
const GROUP_KEY = "mindset:sets:group";
const PAGE_SIZE = 50;

const VISIBILITY_FILTERS = [
    { value: "all", label: "Все" },
    { value: "public", label: "Публичные" },
    { value: "unlisted", label: "По ссылке" },
    { value: "private", label: "Личные" },
];

const Sets = () => {
    const [sets, setSets] = useState([]);
    const [total, setTotal] = useState(0);
    const [tombstones, setTombstones] = useState([]);
    const [busyId, setBusyId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadedOnce, setLoadedOnce] = useState(false);
    const [page, setPage] = useState(1);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [debounced, setDebounced] = useState("");
    const [visibility, setVisibility] = useState("all");
    const [grouped, setGrouped] = useState(() => {
        try {
            const stored = window.localStorage.getItem(GROUP_KEY);
            return stored === null ? null : stored === "1";
        } catch {
            return null;
        }
    });
    const { collections, loading: collectionsLoading, reload: reloadCollections } = useCollections();

    // Пока пользователь не выбрал сам, группируем только когда коллекции есть:
    // иначе список без коллекций показывался бы одной большой группой.
    useEffect(() => {
        if (grouped !== null || collectionsLoading) {
            return;
        }
        setGrouped(collections.length > 0);
    }, [grouped, collections, collectionsLoading]);

    // Явный выбор в этой сессии важнее сохранённой настройки: если коллекции удалили,
    // старый режим «по коллекциям» не должен прятать все сеты.
    const [explicitChoice, setExplicitChoice] = useState(false);
    const groupMode =
        explicitChoice && grouped !== null
            ? grouped === true
            : grouped === true && collections.length > 0;
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
        }
    }, [view]);

    useEffect(() => {
        if (grouped === null) {
            return;
        }
        try {
            window.localStorage.setItem(GROUP_KEY, grouped ? "1" : "0");
        } catch {
            return;
        }
    }, [grouped]);

    // Ввод в поиске ждём 300 мс: поиск серверный, лишние запросы ни к чему.
    useEffect(() => {
        const timer = window.setTimeout(() => setDebounced(search.trim()), 300);
        return () => window.clearTimeout(timer);
    }, [search]);

    const loadTombstones = useCallback(async () => {
        try {
            setTombstones(await setService.getSetTombstones());
        } catch {
            setTombstones([]);
        }
    }, []);

    useEffect(() => {
        loadTombstones();
    }, [loadTombstones]);

    // Поиск и фильтр по доступу считает сервер: список приходит страницами,
    // остаток добирается кнопкой «Показать ещё».
    const loadSets = useCallback(
        async (offset = 0) => {
            setLoading(true);
            setError("");

            try {
                const data = await setService.searchSets({
                    limit: PAGE_SIZE,
                    offset,
                    search: debounced || undefined,
                    visibility: visibility === "all" ? undefined : visibility,
                });
                const list = data.sets ?? [];

                setSets(list);
                setTotal(data.total ?? list.length);
            } catch (err) {
                setError(parseApiError(err).message);
            } finally {
                setLoading(false);
                setLoadedOnce(true);
            }
        },
        [debounced, visibility]
    );

    useEffect(() => {
        setPage(1);
        loadSets(0);
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

    const noSetsAtAll = total === 0 && !debounced && visibility === "all";

    // Полностраничная заглушка только на первой загрузке: иначе при вводе в поиске
    // список подменялся бы надписью и поле теряло фокус.
    // Отмечаем и снимаем коллекции у сета: сет может лежать сразу в нескольких.
    const toggleCollection = async (setId, collectionId, inCollection) => {
        try {
            if (inCollection) {
                await collectionService.addSet(setId, collectionId);
            } else {
                await collectionService.removeSet(setId, collectionId);
            }

            const collection = collections.find((item) => item.id === collectionId);
            const applyCollections = (list) => {
                if (!collection) {
                    return list;
                }

                const exists = list.some((item) => item.id === collectionId);
                if (inCollection && !exists) {
                    return [
                        ...list,
                        { id: collection.id, title: collection.title, color: collection.color },
                    ];
                }
                if (!inCollection && exists) {
                    return list.filter((item) => item.id !== collectionId);
                }
                return list;
            };

            setSets((current) =>
                current.map((item) =>
                    item.id === setId
                        ? { ...item, collections: applyCollections(item.collections ?? []) }
                        : item
                )
            );

            await reloadCollections();
        } catch (err) {
            setError(parseApiError(err).message);
        }
    };

    if (loading && !loadedOnce) {
        return (
            <div className="page">
                <Skeleton variant="row" count={6} label="Загружаем сеты…" />
            </div>
        );
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
                <div className="filterBlock">
                    <span className="filterBlockTitle">Доступ</span>
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

                <div className="filterBlock">
                    <span className="filterBlockTitle">Группировка</span>
                    <div className="filterChips" role="group" aria-label="Группировка сетов">
                        <button
                            type="button"
                            className={`filterChip${!groupMode ? " filterChipActive" : ""}`}
                            onClick={() => {
                                setExplicitChoice(true);
                                setGrouped(false);
                            }}
                        >
                            Без групп
                        </button>
                        <button
                            type="button"
                            className={`filterChip${groupMode ? " filterChipActive" : ""}`}
                            onClick={() => {
                                setExplicitChoice(true);
                                setGrouped(true);
                            }}
                        >
                            По коллекциям
                        </button>
                    </div>
                </div>
            </div>

            {groupMode && (
                <CollectionsPanel
                    collections={collections}
                    onChanged={reloadCollections}
                    query={debounced}
                    onToggleCollection={toggleCollection}
                />
            )}

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

            {!groupMode && (
                <section className="stack">
                <div className="setSectionHead">
                    <h2 className="feedSectionTitle">
                        Авторские <span className="listMeta">{total}</span>
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
                {sets.length === 0 ? (
                    <EmptyState
                        icon={noSetsAtAll ? "🗂️" : "🔍"}
                        title={noSetsAtAll ? "Сетов пока нет" : "Сетов не найдено"}
                        hint={
                            noSetsAtAll
                                ? "Создайте первый сет — это заметка, внутри которой можно связывать слова с другими сетами."
                                : "Попробуйте изменить запрос или фильтр."
                        }
                        action={
                            noSetsAtAll ? (
                                <Link className="btn btnPrimary" to="/sets/new">
                                    Создать сет
                                </Link>
                            ) : null
                        }
                    />
                ) : view === "list" ? (
                    <ul className="setList">
                        {sets.map((set) => (
                            <li key={set.id} className="setListRowWrap">
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
                                <CollectionPicker
                                    collections={collections}
                                    selected={(set.collections ?? []).map((item) => item.id)}
                                    onToggle={(collectionId, inCollection) =>
                                        toggleCollection(set.id, collectionId, inCollection)
                                    }
                                    onCreate={async (collectionTitle) => {
                                        const data = await collectionService.create({
                                            title: collectionTitle,
                                            color: "",
                                        });
                                        await reloadCollections();
                                        await toggleCollection(
                                            set.id,
                                            data.collection?.id ?? 0,
                                            true
                                        );
                                    }}
                                />
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="setGrid">
                        {sets.map((set) => (
                            <SetCard
                                key={set.id}
                                set={set}
                                to={`/sets/${set.id}`}
                                likeable={false}
                                showAuthor={false}
                                collections={collections}
                                selected={(set.collections ?? []).map((item) => item.id)}
                                onToggleCollection={(collectionId, inCollection) =>
                                    toggleCollection(set.id, collectionId, inCollection)
                                }
                                onCreateCollection={async (collectionTitle) => {
                                    const data = await collectionService.create({
                                        title: collectionTitle,
                                        color: "",
                                    });
                                    await reloadCollections();
                                    await toggleCollection(set.id, data.collection?.id ?? 0, true);
                                }}
                            />
                        ))}
                    </div>
                )}

                <Pagination
                    page={page}
                    pageSize={PAGE_SIZE}
                    total={total}
                    onChange={(next) => {
                        setPage(next);
                        loadSets((next - 1) * PAGE_SIZE);
                    }}
                />
                </section>
            )}

            <SavedSets
                query={search}
                collections={collections}
                onCollectionsChanged={reloadCollections}
                hidden={groupMode}
            />
        </div>
    );
};

export default Sets;
