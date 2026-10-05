import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
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
import SetArticle from "./set.article.jsx";
import SetSidebar from "./set.sidebar.jsx";
import WikilinkPicker from "./wikilink.picker.jsx";
import ReaderSettings from "./reader.settings.jsx";
import useReaderSettings from "../../../hooks/use.reader.settings";
import "../../../css/dashboard/dashboard.scss";
import "../../../css/dashboard/workspace.scss";
import "../../../css/dashboard/reader.scss";

const EDITOR_ID = "mindset-set-editor";

export const VISIBILITY_OPTIONS = [
    { value: "private", label: "Личный", hint: "Виден только вам" },
    { value: "unlisted", label: "По ссылке", hint: "Доступен тем, у кого есть адрес" },
    { value: "public", label: "Публичный", hint: "Виден всем и попадает в общий список" },
];

export const visibilityLabel = (value) =>
    VISIBILITY_OPTIONS.find((option) => option.value === value)?.label ?? "";

export const shareUrl = (slug) => `${window.location.origin}/s/${slug}`;

export const copyShareLink = async (slug, current, setCopied) => {
    const url = shareUrl(slug);
    try {
        await navigator.clipboard.writeText(url);
    } catch {
        setCopied(false);
        return;
    }
    setCopied(!current);
    window.setTimeout(() => setCopied(false), 2000);
};

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

const WIKILINK_TAIL = /^([^[\]\n]*)(\]\])?/;

const findWikilinkRange = (text, caret) => {
    const before = text.slice(0, caret);
    const start = before.lastIndexOf("[[");

    if (start === -1 || /[[\]]/.test(before.slice(start + 2))) {
        return null;
    }

    const tail = WIKILINK_TAIL.exec(text.slice(caret));
    const body = tail?.[1] ?? "";
    const closing = tail?.[2] ?? "";

    return {
        start,
        end: caret + body.length + closing.length,
        label: before.slice(start + 2) + body,
    };
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
    const suppressTrigger = useRef(0);
    const realmRef = useRef(null);

    const [set, setSet] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [notFound, setNotFound] = useState(false);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [visibility, setVisibility] = useState(VISIBILITY_OPTIONS[0].value);
    const [setCopied, setSetCopied] = useState(false);
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
    const [mode, setMode] = useState("read");
    const [searchParams, setSearchParams] = useSearchParams();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        try {
            return window.localStorage.getItem("mindset:sidebar:collapsed") === "1";
        } catch {
            return false;
        }
    });

    const toggleSidebar = useCallback(() => {
        setSidebarCollapsed((current) => {
            const next = !current;
            try {
                window.localStorage.setItem("mindset:sidebar:collapsed", next ? "1" : "0");
            } catch {
                return next;
            }
            return next;
        });
    }, []);

    const { settings: readerView, update: updateReaderView, reset: resetReaderView } =
        useReaderSettings();

    useEffect(() => {
        if (searchParams.get("mode") === "edit") {
            setMode("edit");
        }
    }, [searchParams]);

    const switchMode = useCallback(
        (next) => {
            setMode(next);
            setSearchParams(next === "edit" ? { mode: "edit" } : {}, { replace: true });
        },
        [setSearchParams]
    );

    const [picker, setPicker] = useState(null);
    const [pickerError, setPickerError] = useState("");
    const [pickerIndex, setPickerIndex] = useState(0);

    const applySet = useCallback((data) => {
        const normalized = {
            title: data.title ?? "",
            description: data.description ?? "",
            visibility: data.visibility ?? VISIBILITY_OPTIONS[0].value,
            content: data.content ?? "",
        };
        setSet(data);
        setTitle(normalized.title);
        setDescription(normalized.description);
        setVisibility(normalized.visibility);
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
            snapshot.visibility !== visibility ||
            snapshot.content !== content
        );
    }, [snapshot, title, description, visibility, content]);

    const handleSave = useCallback(async () => {
        if (!set || saving || !dirty) {
            return;
        }

        setSaving(true);
        setActionError("");
        setFieldErrors({});

        try {
            const updated = await setService.updateSet(set.id, {
                title,
                description,
                visibility,
                content,
            });
            applySet(updated.set);
            setLinks(updated.links ?? []);
            setSavedAt(
                new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
            );
            switchMode("read");
        } catch (error) {
            const parsed = parseApiError(error);
            setActionError(parsed.message);
            setFieldErrors(parsed.fieldErrors);
        } finally {
            setSaving(false);
        }
    }, [set, saving, dirty, title, description, visibility, content, applySet, switchMode]);

    const handleLeave = useCallback(() => {
        if (dirty) {
            const leave = window.confirm(
                "Есть несохранённые изменения. Выйти к статье без сохранения?"
            );
            if (!leave) {
                return;
            }
        }
        setActionError("");
        switchMode("read");
    }, [dirty, switchMode]);

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
                return;
            }
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
                event.preventDefault();
                if (mode === "edit") {
                    handleLeave();
                } else {
                    setActionError("");
                    switchMode("edit");
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleSave, mode, handleLeave, switchMode]);

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

            if (!editor) {
                setPickerError("Редактор ещё не готов, попробуйте ещё раз");
                return;
            }

            if (
                typeof lexical?.$getSelection !== "function" ||
                typeof lexical?.$isRangeSelection !== "function" ||
                typeof lexical?.$isTextNode !== "function"
            ) {
                setPickerError("Не удалось вставить ссылку: API редактора недоступен");
                return;
            }

            const instruction = withAlias ? `[[${value}|]]` : `[[${value}]]`;
            let placed = false;

            editor.update(() => {
                const selection = lexical.$getSelection();
                if (!lexical.$isRangeSelection(selection)) {
                    return;
                }

                const anchorNode = selection.anchor.getNode();
                if (!lexical.$isTextNode(anchorNode)) {
                    return;
                }

                const text = anchorNode.getTextContent();
                const range = findWikilinkRange(text, selection.anchor.offset);

                if (!range) {
                    selection.insertText(instruction);
                    placed = true;
                    return;
                }

                anchorNode.setTextContent(
                    text.slice(0, range.start) + instruction + text.slice(range.end)
                );

                const caret = range.start + (withAlias ? instruction.length - 2 : instruction.length);
                anchorNode.select(caret, caret);
                placed = true;
            });

            if (!placed) {
                setPickerError("Не удалось вставить ссылку: поставьте курсор в текст сета");
                return;
            }

            suppressTrigger.current = performance.now() + 300;
            editor.focus();
            setPicker(null);
            setPickerError("");
        },
        [realm]
    );

    useEffect(() => {
        realmRef.current = realm;
    }, [realm]);

    const openPicker = useCallback(() => {
        const editor = realmRef.current?.getValue(rootEditor$);

        setPickerError("");

        if (
            editor &&
            typeof lexical?.$getSelection === "function" &&
            typeof lexical?.$isRangeSelection === "function"
        ) {
            editor.update(() => {
                const selection = lexical.$getSelection();
                if (lexical.$isRangeSelection(selection)) {
                    selection.insertText("[[");
                }
            });
        }

        if (editor) {
            editor.focus();
        }

        setPicker({ query: "", left: 16, top: 64 });
    }, []);

    const pickerOptions = useMemo(() => {
        const needle = (picker?.query ?? "").trim().toLowerCase();
        return allSets
            .filter((item) => item.id !== set?.id)
            .filter((item) => !needle || item.title.toLowerCase().includes(needle))
            .slice(0, 12)
            .map((item) => ({ title: item.title }));
    }, [picker, allSets, set]);

    const handlePick = useCallback(
        (option, withAlias) => {
            insertWikilink(option.title, withAlias);
        },
        [insertWikilink]
    );

    const detectTrigger = useCallback(() => {
        const host = hostRef.current;
        const selection = window.getSelection();

        if (
            !host ||
            !selection ||
            selection.rangeCount === 0 ||
            !selection.isCollapsed ||
            performance.now() < suppressTrigger.current
        ) {
            return;
        }

        const node = selection.anchorNode;
        const editable = host.querySelector('[contenteditable="true"]');

        if (!node || !editable || !editable.contains(node)) {
            return;
        }

        const range = findWikilinkRange(node.textContent ?? "", selection.anchorOffset);

        if (!range) {
            setPicker(null);
            return;
        }

        const rect = selection.getRangeAt(0).getBoundingClientRect();
        const hostRect = host.getBoundingClientRect();
        const hasCaret = rect.top !== 0 || rect.left !== 0;

        setPicker({
            query: range.label,
            left: Math.min(Math.max(rect.left - hostRect.left, 8), Math.max(hostRect.width - 330, 8)),
            top: (hasCaret ? rect.bottom - hostRect.top : 64) + 6,
        });
    }, []);

    useEffect(() => {
        if (mode !== "edit") {
            return undefined;
        }

        const attach = () => {
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

            const handleMouseUp = (event) => {
                if (event.target.closest?.(".wikilinkPicker")) {
                    return;
                }
                detectTrigger();
            };

            host.addEventListener("keyup", handleKeyUp);
            host.addEventListener("mouseup", handleMouseUp);

            return () => {
                host.removeEventListener("keyup", handleKeyUp);
                host.removeEventListener("mouseup", handleMouseUp);
            };
        };

        let detach = attach();

        const observer = new MutationObserver(() => {
            detach?.();
            detach = attach();
        });

        if (hostRef.current) {
            observer.observe(hostRef.current, { childList: true, subtree: true });
        }

        return () => {
            observer.disconnect();
            detach?.();
        };
    }, [detectTrigger, mode, loading]);

    useEffect(() => {
        if (!picker) {
            return undefined;
        }

        const handleMouseDown = (event) => {
            if (!event.target.closest?.(".wikilinkPicker")) {
                setPicker(null);
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
                event.stopPropagation();
                setPickerIndex((current) => {
                    const next = event.key === "ArrowDown" ? current + 1 : current - 1;
                    return Math.min(Math.max(next, 0), Math.max(pickerOptions.length - 1, 0));
                });
                return;
            }
            if (event.key === "Enter" || event.key === "Tab") {
                event.preventDefault();
                event.stopPropagation();
                const option = pickerOptions[pickerIndex];
                if (option) {
                    handlePick(option, event.shiftKey);
                } else {
                    setPicker(null);
                }
                return;
            }
            if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setPicker(null);
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
        <div className="setWorkspace">
            <SetSidebar
                sets={allSets}
                currentId={id}
                collapsed={sidebarCollapsed}
                onToggle={toggleSidebar}
            />

            <div className="setMain">
                <div className="setToolbar">
                    {mode === "read" ? (
                        <>
                            <ReaderSettings
                                settings={readerView}
                                onChange={updateReaderView}
                                onReset={resetReaderView}
                            />
                            <button
                                className="btn btnPrimary"
                                onClick={() => switchMode("edit")}
                                title="Ctrl+E"
                            >
                                Редактировать
                            </button>
                            <button
                                className="btn btnDanger"
                                onClick={handleDelete}
                                disabled={removing}
                            >
                                {removing ? "Удаляем..." : "Удалить"}
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                className="btn btnPrimary"
                                onClick={handleSave}
                                disabled={!dirty || saving}
                            >
                                {saving ? "Сохраняем..." : "Сохранить"}
                            </button>
                            <button className="btn btnGhost" onClick={handleLeave} title="Ctrl+E">
                                К статье
                            </button>
                            <button
                                className="btn btnDanger"
                                onClick={handleDelete}
                                disabled={removing}
                            >
                                {removing ? "Удаляем..." : "Удалить"}
                            </button>
                        </>
                    )}
                </div>

                {actionError && (
                    <div className="alert alertError" role="alert">
                        {actionError}
                    </div>
                )}

                {mode === "read" ? (
                    <div
                        className="articleCard"
                        data-reader-theme={readerView.theme}
                        data-reader-width={readerView.width}
                        data-reader-font={readerView.font}
                        data-reader-scale={readerView.scale}
                    >
                        <header className="articleHead">
                            <h1 className="articleTitle">{title || "Без названия"}</h1>
                            <div className="articleMeta">
                                <span>Создан {set.date_created}</span>
                                <span>изменён {set.last_activity}</span>
                                <span className={`badge badgeVisibility badgeVisibility_${visibility}`}>
                                    {visibilityLabel(visibility)}
                                </span>
                                {links.length > 0 && (
                                    <span className="badge">Связей: {links.length}</span>
                                )}
                                {dirty && <span className="badge badgeWarning">не сохранено</span>}
                                {!dirty && savedAt && (
                                    <span className="badge badgeSuccess">сохранено в {savedAt}</span>
                                )}
                            </div>
                        </header>
                        <SetArticle content={content} links={links} />
                    </div>
                ) : (
                    <div className="editorCard">
                        <div className="editorFields">
                            <label className="field">
                                <span className="fieldLabel">Название</span>
                                <input
                                    className={`input${fieldErrors.title ? " inputInvalid" : ""}`}
                                    type="text"
                                    value={title}
                                    onChange={(event) => setTitle(event.target.value)}
                                    maxLength={100}
                                />
                                {fieldErrors.title && (
                                    <span className="fieldError">{fieldErrors.title}</span>
                                )}
                            </label>

                            <label className="field fieldLast">
                                <span className="fieldLabel">
                                    Описание <span className="mutedText">(не обязательно)</span>
                                </span>
                                <input
                                    className={`input${
                                        fieldErrors.description ? " inputInvalid" : ""
                                    }`}
                                    type="text"
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value)}
                                    maxLength={250}
                                />
                                {fieldErrors.description && (
                                    <span className="fieldError">{fieldErrors.description}</span>
                                )}
                            </label>
                            <fieldset className="visibilityField">
                                <legend className="fieldLabel">Доступ</legend>
                                <div className="visibilityOptions">
                                    {VISIBILITY_OPTIONS.map((option) => (
                                        <label
                                            key={option.value}
                                            className={`visibilityOption${
                                                visibility === option.value
                                                    ? " visibilityOptionActive"
                                                    : ""
                                            }`}
                                        >
                                            <input
                                                type="radio"
                                                name="visibility"
                                                value={option.value}
                                                checked={visibility === option.value}
                                                onChange={() => setVisibility(option.value)}
                                            />
                                            <span className="visibilityOptionText">
                                                <span className="visibilityOptionLabel">
                                                    {option.label}
                                                </span>
                                                <span className="visibilityOptionHint">
                                                    {option.hint}
                                                </span>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                                {set.slug && visibility !== "private" && (
                                    <div className="visibilityShare">
                                        <span className="mutedText">Адрес страницы:</span>
                                        <code className="visibilitySlug">
                                            {`${window.location.origin}/s/${set.slug}`}
                                        </code>
                                        <button
                                            type="button"
                                            className="btn btnGhost btnSmall"
                                            onClick={() => copyShareLink(set.slug, setCopied, setSetCopied)}
                                        >
                                            {setCopied ? "Скопировано" : "Копировать"}
                                        </button>
                                    </div>
                                )}
                            </fieldset>
                        </div>
                        <div className="editorHint">
                            Ctrl+S — сохранить, Ctrl+E — вернуться к статье. Ссылка на другой сет:
                            наберите [[ — откроется подсказка со списком сетов (или кнопка
                            «[[ ]] ссылка»). Enter — вставить, Shift+Enter — с подписью, ↑↓ —
                            выбрать.
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
                                    }}
                                />
                            )}
                        </div>
                    </div>
                )}

                {mode === "read" && backlinks.length > 0 && (
                    <div className="card backlinksCard">
                        <h2 className="cardTitle">Обратные ссылки</h2>
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
                    </div>
                )}
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
