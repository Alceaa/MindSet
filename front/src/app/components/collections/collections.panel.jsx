import React, { useState } from "react";
import { Link } from "react-router-dom";
import collectionService from "../../api/collection.service";
import setService from "../../api/set.service";
import parseApiError from "../../utils/api.error";
import { stripMarkdown } from "../../utils/markdown.preview";
import CollectionPicker from "./collection.picker.jsx";
import { COLLECTION_COLORS } from "./collection.colors.js";

// Выбор цвета при создании: цветные образцы, чтобы сразу видеть, что выбираешь.
const ColorChoices = ({ value, onChange, disabled, label }) => (
    <span className="collectionColors collectionColorsOpen" role="group" aria-label={label}>
        {COLLECTION_COLORS.map((item) => (
            <button
                key={item.value}
                type="button"
                className={`collectionColorChoice${
                    value === item.value ? " collectionColorChoiceActive" : ""
                }`}
                onClick={() => onChange(item.value)}
                disabled={disabled}
                title={item.label}
                aria-label={item.label}
                aria-pressed={value === item.value}
            >
                <span
                    className={`collectionDot collectionDot-${item.value || "default"}`}
                    aria-hidden="true"
                />
            </button>
        ))}
    </span>
);

/**
 * Панель коллекций: создание, переименование, цвет, порядок, удаление и содержимое.
 * Коллекция раскрывается списком своих сетов (со скроллом), чтобы не засорять страницу.
 */
const CollectionsPanel = ({ collections, onChanged, query = "", onToggleCollection }) => {
    const [title, setTitle] = useState("");
    const [color, setColor] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [expanded, setExpanded] = useState(null);
    const [colorOpen, setColorOpen] = useState(null);
    const [contents, setContents] = useState({});
    const [loadingSets, setLoadingSets] = useState(false);

    const needle = query.trim().toLowerCase();
    const sorted = [...collections]
        .sort((a, b) => a.position - b.position || a.id - b.id)
        .filter((item) => !needle || item.title.toLowerCase().includes(needle));

    const run = async (action) => {
        setBusy(true);
        setError("");
        try {
            await action();
            setContents({});
            await onChanged?.();
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setBusy(false);
        }
    };

    const create = () => {
        const next = title.trim();
        if (!next) {
            return;
        }
        run(async () => {
            await collectionService.create({ title: next, color });
            setTitle("");
            setColor("");
        });
    };

    const rename = (collection) => {
        const next = window.prompt("Название коллекции", collection.title);
        if (!next?.trim() || next.trim() === collection.title) {
            return;
        }
        run(() =>
            collectionService.update(collection.id, {
                title: next.trim(),
                color: collection.color,
                position: collection.position,
            })
        );
    };

    const recolor = (collection, nextColor) =>
        run(() =>
            collectionService.update(collection.id, {
                title: collection.title,
                color: nextColor,
                position: collection.position,
            })
        );

    const move = (collection, delta) => {
        const index = sorted.findIndex((item) => item.id === collection.id);
        const target = index + delta;
        if (index < 0 || target < 0 || target >= sorted.length) {
            return;
        }

        const reordered = [...sorted];
        [reordered[index], reordered[target]] = [reordered[target], reordered[index]];

        run(async () => {
            for (let position = 0; position < reordered.length; position += 1) {
                const item = reordered[position];
                await collectionService.update(item.id, {
                    title: item.title,
                    color: item.color,
                    position: position + 1,
                });
            }
        });
    };

    const remove = (collection) => {
        const confirmed = window.confirm(
            `Удалить коллекцию «${collection.title}»? Сеты останутся — они просто станут без коллекции.`
        );
        if (!confirmed) {
            return;
        }
        run(() => collectionService.remove(collection.id));
    };

    // Раскрытие коллекции: содержимое подгружаем один раз и держим в кэше.
    const toggle = async (collection) => {
        setColorOpen(null);

        if (expanded === collection.id) {
            setExpanded(null);
            return;
        }

        setExpanded(collection.id);
        if (contents[collection.id]) {
            return;
        }

        setLoadingSets(true);
        setError("");
        try {
            const own = await setService.searchSets({ collection_id: collection.id, limit: 0 });

            setContents((current) => ({
                ...current,
                [collection.id]: { own: own.sets ?? [] },
            }));
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setLoadingSets(false);
        }
    };

    return (
        <section className="card collectionsManager">
            <h3 className="settingsSectionLabel">Коллекции</h3>

            {error && (
                <div className="alert alertError" role="alert">
                    {error}
                </div>
            )}

            <div className="collectionsCreate">
                <input
                    className="input"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            create();
                        }
                    }}
                    placeholder="Название новой коллекции"
                    aria-label="Название новой коллекции"
                />
                <ColorChoices value={color} onChange={setColor} label="Цвет новой коллекции" />
                <button
                    className="btn btnPrimary"
                    type="button"
                    disabled={busy || !title.trim()}
                    onClick={create}
                >
                    Создать
                </button>
            </div>

            {sorted.length === 0 ? (
                <p className="mutedText">Коллекций пока нет — создайте первую.</p>
            ) : (
                <ul className="collectionsList">
                    {sorted.map((collection, index) => {
                        const isOpen = expanded === collection.id;
                        const content = contents[collection.id];
                        const total = collection.sets_count + collection.saved_count;

                        return (
                            <li key={collection.id} className="collectionsRow">
                                <div className="collectionsRowHead">
                                    <button
                                        type="button"
                                        className="collectionsToggle"
                                        onClick={() => toggle(collection)}
                                        aria-expanded={isOpen}
                                    >
                                        <span className="collectionsToggleArrow" aria-hidden="true">
                                            {isOpen ? "▾" : "▸"}
                                        </span>
                                        <span
                                            className={`collectionDot collectionDot-${collection.color || "default"}`}
                                            aria-hidden="true"
                                        />
                                        <span className="collectionsName">{collection.title}</span>
                                        <span className="listMeta">{total}</span>
                                    </button>

                                    <button
                                        type="button"
                                        className="collectionColorToggle"
                                        onClick={() =>
                                            setColorOpen((current) =>
                                                current === collection.id ? null : collection.id
                                            )
                                        }
                                        title="Цвет метки"
                                        aria-label={`Цвет коллекции ${collection.title}`}
                                    >
                                        <span
                                            className={`collectionDot collectionDot-${collection.color || "default"}`}
                                            aria-hidden="true"
                                        />
                                    </button>

                                    <button
                                        type="button"
                                        className="btn btnGhost btnSmall"
                                        onClick={() => rename(collection)}
                                        disabled={busy}
                                        title="Переименовать"
                                    >
                                        ✎
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btnGhost btnSmall"
                                        onClick={() => move(collection, -1)}
                                        disabled={busy || index === 0}
                                        title="Выше"
                                    >
                                        ↑
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btnGhost btnSmall"
                                        onClick={() => move(collection, 1)}
                                        disabled={busy || index === sorted.length - 1}
                                        title="Ниже"
                                    >
                                        ↓
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btnGhost btnSmall"
                                        onClick={() => remove(collection)}
                                        disabled={busy}
                                    >
                                        Удалить
                                    </button>
                                </div>

                                <span
                                    className={`collectionColors${
                                        colorOpen === collection.id ? " collectionColorsOpen" : ""
                                    }`}
                                    role="group"
                                    aria-label={`Цвет коллекции ${collection.title}`}
                                >
                                    {COLLECTION_COLORS.map((item) => (
                                        <button
                                            key={item.value}
                                            type="button"
                                            className={`collectionColorChoice${
                                                collection.color === item.value
                                                    ? " collectionColorChoiceActive"
                                                    : ""
                                            }`}
                                            onClick={() => recolor(collection, item.value)}
                                            disabled={busy}
                                            title={item.label}
                                            aria-label={item.label}
                                        >
                                            <span
                                                className={`collectionDot collectionDot-${item.value || "default"}`}
                                                aria-hidden="true"
                                            />
                                        </button>
                                    ))}
                                </span>

                                {isOpen && (
                                    <ul className="collectionsSets">
                                        {loadingSets && !content && (
                                            <li className="mutedText">Загружаем сеты…</li>
                                        )}
                                        {content?.own.map((set) => (
                                            <li key={set.id} className="setListRowWrap">
                                                <Link className="setListRow" to={`/sets/${set.id}`}>
                                                    <span className="setListMain">
                                                        <span className="setListTitle">
                                                            {set.title}
                                                        </span>
                                                        <span className="setListPreview">
                                                            {stripMarkdown(
                                                                set.preview || set.description || ""
                                                            )}
                                                        </span>
                                                    </span>
                                                    <span className="setListMeta">
                                                        изменён {set.last_activity}
                                                    </span>
                                                </Link>
                                                {onToggleCollection && (
                                                    <CollectionPicker
                                                        collections={collections}
                                                        selected={(set.collections ?? []).map(
                                                            (item) => item.id
                                                        )}
                                                        onToggle={(collectionId, inCollection) =>
                                                            onToggleCollection(
                                                                set.id,
                                                                collectionId,
                                                                inCollection
                                                            )
                                                        }
                                                    />
                                                )}
                                            </li>
                                        ))}
                                        {content && content.own.length === 0 && (
                                            <li className="mutedText">
                                                Здесь пока пусто — отметьте коллекцию у сета.
                                            </li>
                                        )}
                                    </ul>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
};

export default CollectionsPanel;
