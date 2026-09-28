import React, { useCallback, useEffect, useMemo, useState } from "react";
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
    Separator,
    UndoRedo,
    codeBlockPlugin,
    codeMirrorPlugin,
    diffSourcePlugin,
    headingsPlugin,
    linkDialogPlugin,
    linkPlugin,
    listsPlugin,
    markdownShortcutPlugin,
    quotePlugin,
    tablePlugin,
    thematicBreakPlugin,
    toolbarPlugin,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import setService from "../../../api/set.service";
import parseApiError from "../../../utils/api.error";
import LoadingScreen from "../../common/loading.screen.jsx";
import "../../../css/dashboard/dashboard.scss";

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

const useEditorPlugins = () =>
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
                        <InsertTable />
                        <InsertThematicBreak />
                    </DiffSourceToggleWrapper>
                ),
            }),
        ],
        []
    );

const SetEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const plugins = useEditorPlugins();

    const [set, setSet] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [notFound, setNotFound] = useState(false);

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [content, setContent] = useState("");
    const [snapshot, setSnapshot] = useState(null);

    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [actionError, setActionError] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [savedAt, setSavedAt] = useState("");

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

    const loadSet = useCallback(async () => {
        setLoading(true);
        setLoadError("");
        setNotFound(false);

        try {
            const data = await setService.getSet(id);
            applySet(data);
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
    }, [id, applySet]);

    useEffect(() => {
        loadSet();
    }, [loadSet]);

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
            applySet(updated);
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
                    Ctrl+S — сохранить, режим «Markdown» в панели — просмотр исходника
                </div>
                <div className="mdxEditorHost">
                    <MDXEditor
                        key={set.id}
                        className="mdxEditorTheme"
                        contentEditableClassName="mdxContent"
                        markdown={content}
                        onChange={setContent}
                        placeholder="Начните писать: заголовки, списки, таблицы, код и ссылки."
                        plugins={plugins}
                    />
                </div>
            </div>
        </div>
    );
};

export default SetEditor;
