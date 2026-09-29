import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    BlockTypeSelect,
    BoldItalicUnderlineToggles,
    CodeToggle,
    CreateLink,
    DiffSourceToggleWrapper,
    InsertTable,
    InsertThematicBreak,
    ListsToggle,
    MDXEditor,
    RemoteMDXEditorRealmProvider,
    Separator,
    UndoRedo,
    codeBlockPlugin,
    codeMirrorPlugin,
    diffSourcePlugin,
    headingsPlugin,
    lexical,
    linkDialogPlugin,
    linkPlugin,
    listsPlugin,
    markdownShortcutPlugin,
    quotePlugin,
    remoteRealmPlugin,
    rootEditor$,
    tablePlugin,
    thematicBreakPlugin,
    toolbarPlugin,
    useRemoteMDXEditorRealm,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import setService from "../../../api/set.service";
import parseApiError from "../../../utils/api.error";
import LoadingScreen from "../../common/loading.screen.jsx";
import WikilinkPicker from "./wikilink.picker.jsx";
import "../../../css/dashboard/dashboard.scss";

const EDITOR_ID = "mindset-set-editor";

const CODE_LANGUAGES = {
    "": "Текст",
    bash: "Bash",
    css: "CSS",
    go: "Go",
    html: "HTML",
    js: "JavaScript",
    json: "JSON",
    jsx: "JSX",
    md: "Markdown",
    sql: "SQL",
    ts: "TypeScript",
};

const useEditorPlugins = (onOpenPicker) =>
    useMemo(
        () => [
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            markdownShortcutPlugin(),
            linkPlugin(),
            linkDialogPlugin(),
            tablePlugin(),
            codeBlockPlugin({ defaultCodeBlockLanguage: "go" }),
            codeMirrorPlugin({ codeBlockLanguages: CODE_LANGUAGES }),
            diffSourcePlugin({ viewMode: "rich-text" }),
            toolbarPlugin({
                toolbarContents: () => (
                    <DiffSourceToggleWrapper>
                        <UndoRedo />
                        <Separator />
                        <BlockTypeSelect />
                        <BoldItalicUnderlineToggles />
                        <CodeToggle />
                        <ListsToggle />
                        <CreateLink />
                        <button
                            type="button"
                            className="toolbarWikilink"
                            title="Вставить ссылку на сет (или наберите [[ в тексте)"
                            onClick={onOpenPicker}
                        >
                            [[ ]] ссылка
                        </button>
                        <InsertTable />
                        <InsertThematicBreak />
                    </DiffSourceToggleWrapper>
                ),
            }),
            remoteRealmPlugin({ editorId: EDITOR_ID }),
        ],
        [onOpenPicker]
    );

const SetEditorInner = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const realm = useRemoteMDXEditorRealm(EDITOR_ID);

    const hostRef = useRef(null);
    const pendingLink = useRef(null);

    const [set, setSet] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [notFound, setNotFound] = useState(false);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [content, setContent] = useState("");
    const [snapshot, setSnapshot] = useState(null);

    const [links, setLinks] = useState([]);
    const [backlinks, setBacklinks] = useState([]);
    const [allSets, setAllSets] = useState([]);

    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [actionError, setActionError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [savedAt, setSavedAt] = useState("");

    const [picker, setPicker] = useState(null);
    const [pickerError, setPickerError] = useState("");
    const [pickerIndex, setPickerIndex] = useState(0);

    const applySet = useCallback((data) => {
        const normalized = {
            title: data.title ?? "",
            description: data.description ?? "",
            content: data.content ?? "",
        };
        setSet(data);
        setTitle(normalized.title);
        setDescription(normalized.description);
        setContent(normalized.content);
        setSnapshot(normalized);
    }, []);

    const applyRelations = useCallback((data) => {
        setLinks(data.links ?? []);
        setBacklinks(data.backlinks ?? []);
    }, []);

    const loadSet = useCallback(async () => {
        setLoading(true);
        setLoadError("");
        setNotFound(false);

        try {
            const data = await setService.getSet(id);
            applySet(data.set);
            applyRelations(data);
        } catch (error) {
            const parsed = parseApiError(error);
            if (parsed.status === 404) {
                setNotFound(true);
            } else {
                setLoadError(parsed.message);
            }
        } finally {
            setLoading(false);
        }
    }, [id, applySet, applyRelations]);

    useEffect(() => {
        loadSet();
    }, [loadSet]);

    useEffect(() => {
        let active = true;

        setService
            .getSets()
            .then((items) => {
                if (active) {
                    setAllSets(items.map((item) => ({ id: item.id, title: item.title })));
                }
            })
            .catch(() => {
                if (active) {
                    setAllSets([]);
                }
            });

        return () => {
            active = false;
        };
    }, []);

    const dirty = useMemo(() => {
        if (!snapshot) {
            return false;
        }
        return (
            snapshot.title !== title ||
            snapshot.description !== description ||
            snapshot.content !== content
        );
    }, [snapshot, title, description, content]);

    const handleSave = useCallback(async () => {
        if (!set || saving || !dirty) {
            return;
        }

        setSaving(true);
        setActionError("");
        setFieldErrors({});

        try {
            const updated = await setService.updateSet(set.id, { title, description, content });
            applySet(updated.set);
            setLinks(updated.links ?? []);
            setSavedAt(
                new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
            );
        } catch (error) {
            const parsed = parseApiError(error);
            setActionError(parsed.message);
            setFieldErrors(parsed.fieldErrors);
        } finally {
            setSaving(false);
        }
    }, [set, saving, dirty, title, description, content, applySet]);

    const handleDelete = useCallback(async () => {
        if (!set || removing) {
            return;
        }

        if (!window.confirm(`Удалить сет «${set.title}»? Это действие необратимо.`)) {
            return;
        }

        setRemoving(true);
        setActionError("");

        try {
            await setService.deleteSet(set.id);
            navigate("/dashboard?tab=sets", { replace: true });
        } catch (error) {
            setActionError(parseApiError(error).message);
            setRemoving(false);
        }
    }, [set, removing, navigate]);

    useEffect(() => {
        const handleKeyDown = (event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                handleSave();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleSave]);

    useEffect(() => {
        if (!dirty) {
            return undefined;
        }

        const handleBeforeUnload = (event) => {
            event.preventDefault();
            event.returnValue = "";
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [dirty]);

    const insertWikilink = useCallback(
        (value, withAlias) => {
            const editor = realm?.getValue(rootEditor$);
            const pending = pendingLink.current;

            if (!editor) {
                setPickerError("Редактор ещё не готов, попробуйте ещё раз");
                return;
            }

            if (
                typeof lexical?.$getSelection !== "function" ||
                typeof lexical?.$isRangeSelection !== "function"
            ) {
                setPickerError("Не удалось вставить ссылку: API редактора недоступен");
                return;
            }

            editor.update(() => {
                const selection = lexical.$getSelection();
                if (!lexical.$isRangeSelection(selection)) {
                    return;
                }

                for (let index = 0; index < (pending?.back ?? 0); index += 1) {
                    selection.deleteCharacter(true);
                }

                for (let index = 0; index < (pending?.forward ?? 0); index += 1) {
                    selection.deleteCharacter(false);
                }

                selection.insertText(`[[${value}${withAlias ? "|" : ""}]]`);
            });

            editor.focus();
            setPicker(null);
            setPickerError("");
            pendingLink.current = null;
        },
        [realm]
    );

    const openPicker = useCallback(() => {
        setPickerError("");
        setPicker({ query: "", left: 16, top: 64 });
    }, []);

    const pickerOptions = useMemo(() => {
        const needle = (picker?.query ?? "").trim().toLowerCase();
        return allSets
            .filter((item) => !needle || item.title.toLowerCase().includes(needle))
            .slice(0, 12)
            .map((item) => ({ title: item.title }));
    }, [picker, allSets]);

    const handlePick = useCallback(
        (option, withAlias) => {
            insertWikilink(option.title, withAlias);
        },
        [insertWikilink]
    );

    const detectTrigger = useCallback(() => {
        const host = hostRef.current;
        const selection = window.getSelection();

        if (!host || !selection || selection.rangeCount === 0 || !selection.isCollapsed) {
            return;
        }

        const node = selection.anchorNode;
        const editable = host.querySelector('[contenteditable="true"]');

        if (!node || !editable || !editable.contains(node)) {
            return;
        }

        const text = node.textContent ?? "";
        const caret = selection.anchorOffset;
        const before = text.slice(0, caret);

        const openIndex = before.lastIndexOf("[[");
        let back = 0;
        let forward = 0;
        let label = null;

        if (before.endsWith("]]")) {
            const closeIndex = before.length - 2;
            const inner = before.slice(openIndex + 2, closeIndex);
            if (openIndex !== -1 && !inner.includes("]") && !inner.includes("[")) {
                back = caret - openIndex;
                label = inner;
            }
        } else if (openIndex !== -1 && !before.slice(openIndex + 2).includes("]")) {
            const after = text.slice(caret);
            const match = /^([^[\]\n]*)(\]\])?/.exec(after);
            const tail = match?.[1] ?? "";
            const closing = match?.[2] ?? "";
            back = caret - openIndex;
            forward = tail.length + closing.length;
            label = before.slice(openIndex + 2) + tail;
        }

        if (label === null) {
            setPicker(null);
            pendingLink.current = null;
            return;
        }

        pendingLink.current = { back, forward };

        const rect = selection.getRangeAt(0).getBoundingClientRect();
        const hostRect = host.getBoundingClientRect();
        const hasCaret = rect.top !== 0 || rect.left !== 0;

        setPicker({
            query: label,
            left: Math.min(Math.max(rect.left - hostRect.left, 8), Math.max(hostRect.width - 330, 8)),
            top: (hasCaret ? rect.bottom - hostRect.top : 64) + 6,
        });
    }, []);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) {
            return undefined;
        }

        const handleKeyUp = (event) => {
            if (["ArrowUp", "ArrowDown", "Enter", "Tab", "Escape"].includes(event.key)) {
                return;
            }
            detectTrigger();
        };

        host.addEventListener("keyup", handleKeyUp);
        host.addEventListener("mouseup", detectTrigger);

        return () => {
            host.removeEventListener("keyup", handleKeyUp);
            host.removeEventListener("mouseup", detectTrigger);
        };
    }, [detectTrigger, loading]);

    useEffect(() => {
        if (!picker) {
            return undefined;
        }

        const handleMouseDown = (event) => {
            if (!event.target.closest?.(".wikilinkPicker")) {
                setPicker(null);
                pendingLink.current = null;
            }
        };

        document.addEventListener("mousedown", handleMouseDown);
        return () => document.removeEventListener("mousedown", handleMouseDown);
    }, [picker]);

    useEffect(() => {
        setPickerIndex(0);
    }, [picker?.query]);

    useEffect(() => {
        if (!picker) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setPickerIndex((current) => {
                    const next = event.key === "ArrowDown" ? current + 1 : current - 1;
                    return Math.min(Math.max(next, 0), Math.max(pickerOptions.length - 1, 0));
                });
                return;
            }
            if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                const option = pickerOptions[pickerIndex];
                if (option) {
                    handlePick(option, event.shiftKey);
                } else {
                    setPicker(null);
                    pendingLink.current = null;
                }
                return;
            }
            if (event.key === "Escape") {
                event.preventDefault();
                setPicker(null);
                pendingLink.current = null;
            }
        };

        window.addEventListener("keydown", handleKeyDown, true);
        return () => window.removeEventListener("keydown", handleKeyDown, true);
    }, [picker, pickerOptions, pickerIndex, handlePick]);

    const plugins = useEditorPlugins(openPicker);

    if (loading) {
        return <LoadingScreen label="Загружаем сет..." />;
    }

    if (notFound) {
        return (
            <div className="emptyState">
                <h2>Сет не найден</h2>
                <p className="mutedText">
                    Возможно, он удалён или принадлежит другому пользователю.
                </p>
                <Link className="btn btnPrimary" to="/dashboard?tab=sets">
                    К списку сетов
                </Link>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="alert alertError" role="alert">
                {loadError}
                <button className="btn btnGhost btnSmall" onClick={loadSet}>
                    Повторить
                </button>
            </div>
        );
    }

    return (
        <div className="page">
            <div className="pageHead">
                <div className="editorHead">
                    <Link className="link" to="/dashboard?tab=sets">
                        Все сеты
                    </Link>
                    <h1 className="pageTitle">{title || "Без названия"}</h1>
                    <p className="pageSubtitle">
                        Создан {set.date_created} · изменён {set.last_activity}
                        {links.length > 0 && <span className="badge">Связей: {links.length}</span>}
                        {dirty && <span className="badge badgeWarning">не сохранено</span>}
                        {!dirty && savedAt && (
                            <span className="badge badgeSuccess">сохранено в {savedAt}</span>
                        )}
                    </p>
                </div>

                <div className="formActions">
                    <button
                        className="btn btnPrimary"
                        onClick={handleSave}
                        disabled={!dirty || saving}
                    >
                        {saving ? "Сохраняем..." : "Сохранить"}
                    </button>
                    <button className="btn btnDanger" onClick={handleDelete} disabled={removing}>
                        {removing ? "Удаляем..." : "Удалить"}
                    </button>
                </div>
            </div>

            {actionError && (
                <div className="alert alertError" role="alert">
                    {actionError}
                </div>
            )}

            <div className="card">
                <label className="field">
                    <span className="fieldLabel">Название</span>
                    <input
                        className={`input${fieldErrors.title ? " inputInvalid" : ""}`}
                        type="text"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        maxLength={100}
                    />
                    {fieldErrors.title && <span className="fieldError">{fieldErrors.title}</span>}
                </label>

                <label className="field fieldLast">
                    <span className="fieldLabel">
                        Описание <span className="mutedText">(не обязательно)</span>
                    </span>
                    <input
                        className={`input${fieldErrors.description ? " inputInvalid" : ""}`}
                        type="text"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        maxLength={250}
                    />
                    {fieldErrors.description && (
                        <span className="fieldError">{fieldErrors.description}</span>
                    )}
                </label>
            </div>

            <div className="editorCard">
                <div className="editorHint">
                    Ctrl+S — сохранить. Ссылка на другой сет: наберите [[ — откроется подсказка
                    со списком сетов (или кнопка «[[ ]] ссылка»). Enter — вставить, Shift+Enter —
                    с подписью, ↑↓ — выбрать.
                </div>
                <div className="mdxEditorHost" ref={hostRef}>
                    <MDXEditor
                        key={set.id}
                        className="mdxEditorTheme"
                        contentEditableClassName="mdxContent"
                        markdown={content}
                        onChange={setContent}
                        placeholder=""
                        plugins={plugins}
                    />
                    {picker && (
                        <WikilinkPicker
                            query={picker.query}
                            options={pickerOptions}
                            activeIndex={pickerIndex}
                            position={picker}
                            error={pickerError}
                            onPick={handlePick}
                            onClose={() => {
                                setPicker(null);
                                pendingLink.current = null;
                            }}
                        />
                    )}
                </div>
            </div>

            <div className="card linksCard">
                <div className="linksColumn">
                    <h2 className="cardTitle">Ссылки из сета</h2>
                    <ul className="plainList">
                        {links.map((link) => (
                            <li key={`${link.label}-${link.alias}`}>
                                <span className="linkRow">
                                    {link.one_sided && (
                                        <span
                                            className="oneSidedMark"
                                            title="Односторонняя связь: этот сет ссылается, а на него — нет"
                                        >
                                            →
                                        </span>
                                    )}
                                    <Link className="link" to={`/sets/${link.target_id}`}>
                                        {link.alias || link.target_title}
                                    </Link>
                                </span>
                                {link.alias && (
                                    <span className="listMeta">{link.target_title}</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="linksColumn">
                    <h2 className="cardTitle">Обратные ссылки</h2>
                    {backlinks.length === 0 ? (
                        <p className="mutedText">На этот сет пока никто не ссылается.</p>
                    ) : (
                        <ul className="plainList">
                            {backlinks.map((item) => (
                                <li key={item.id}>
                                    <span className="linkRow">
                                        {item.one_sided && (
                                            <span
                                                className="oneSidedMark"
                                                title="Односторонняя связь: тот сет ссылается сюда, а этот — нет"
                                            >
                                                ←
                                            </span>
                                        )}
                                        <Link className="link" to={`/sets/${item.id}`}>
                                            {item.title}
                                        </Link>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </div>
    );
};

const SetEditor = () => (
    <RemoteMDXEditorRealmProvider>
        <SetEditorInner />
    </RemoteMDXEditorRealmProvider>
);

export default SetEditor;
