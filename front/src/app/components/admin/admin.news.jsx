import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    BlockTypeSelect,
    BoldItalicUnderlineToggles,
    CreateLink,
    InsertImage,
    InsertTable,
    InsertThematicBreak,
    ListsToggle,
    MDXEditor,
    Separator,
    UndoRedo,
    headingsPlugin,
    imagePlugin,
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
import adminService from "../../api/admin.service";
import parseApiError from "../../utils/api.error";
import { uploadImage } from "../../utils/image.upload";
import MarkdownTools from "../common/markdown.tools.jsx";
import { applyMarkdownPaste } from "../../markdown/paste";
import "../../css/dashboard/dashboard.scss";

const EMPTY = { title: "", body: "", is_published: true, is_pinned: false };
const BODY_MAX = 20000;

const imageUploadHandler = async (file) => {
    try {
        return await uploadImage(file);
    } catch (err) {
        window.alert(err?.message || "Не удалось загрузить изображение");
        throw err;
    }
};

const AdminNewsPanel = () => {
    const [items, setItems] = useState([]);
    const [form, setForm] = useState(EMPTY);
    const [editingId, setEditingId] = useState(0);
    const [notice, setNotice] = useState(null);
    const [pending, setPending] = useState(false);
    const hostRef = useRef(null);
    const editorRef = useRef(null);

    // Тот же набор инструментов, что и в настройках профиля, плюс вставка картинок.
    const newsPlugins = useMemo(
        () => [
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            tablePlugin(),
            thematicBreakPlugin(),
            markdownShortcutPlugin(),
            linkPlugin(),
            linkDialogPlugin(),
            imagePlugin({ imageUploadHandler }),
            toolbarPlugin({
                toolbarContents: () => (
                    <>
                        <UndoRedo />
                        <Separator />
                        <BlockTypeSelect />
                        <BoldItalicUnderlineToggles />
                        <ListsToggle />
                        <CreateLink />
                        <InsertImage />
                        <InsertTable />
                        <InsertThematicBreak />
                    </>
                ),
            }),
        ],
        []
    );


    const load = useCallback(async () => {
        try {
            const data = await adminService.listNews({ limit: 50 });
            setItems(data.news || []);
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const submit = async (event) => {
        event.preventDefault();

        if (form.body.length > BODY_MAX) {
            setNotice({
                kind: "error",
                text: `Текст новости слишком длинный: ${form.body.length} из ${BODY_MAX} символов`,
            });
            return;
        }

        setPending(true);
        setNotice(null);

        try {
            const data = editingId
                ? await adminService.updateNews(editingId, form)
                : await adminService.createNews(form);
            setNotice({ kind: "success", text: data.message });
            setForm(EMPTY);
            setEditingId(0);
            await load();
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setPending(false);
        }
    };

    const startEdit = (item) => {
        setEditingId(item.id);
        setForm({
            title: item.title,
            body: item.body,
            is_published: item.is_published,
            is_pinned: item.is_pinned,
        });
        setNotice(null);
    };

    const togglePin = async (item) => {
        setNotice(null);
        try {
            await adminService.updateNews(item.id, {
                title: item.title,
                body: item.body,
                is_published: item.is_published,
                is_pinned: !item.is_pinned,
            });
            await load();
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        }
    };

    const remove = async (item) => {
        if (!window.confirm(`Удалить новость «${item.title}»?`)) {
            return;
        }

        setNotice(null);
        try {
            const data = await adminService.deleteNews(item.id);
            setNotice({ kind: "success", text: data.message });
            if (editingId === item.id) {
                setForm(EMPTY);
                setEditingId(0);
            }
            await load();
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        }
    };

    return (
        <>
            <header className="adminHead">
                <h2 className="adminTitle">Новости</h2>
            </header>

            {notice && (
                <div className={`alert${notice.kind === "error" ? " alertError" : " alertSuccess"}`} role="status">
                    {notice.text}
                </div>
            )}

            <form className="adminEditor" onSubmit={submit}>
                <span className="settingsFieldLabel">
                    {editingId ? "Редактирование новости" : "Новая новость"}
                </span>
                <input
                    className="input"
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    placeholder="Заголовок"
                    maxLength={200}
                    required
                />
                <div className="markdownTools">
                    <MarkdownTools
                        editorRef={editorRef}
                        content={form.body}
                        title={form.title}
                        onImport={(text) => setForm((current) => ({ ...current, body: text }))}
                    />
                </div>
                <div
                    className="mdxEditorHost"
                    ref={hostRef}
                    onPasteCapture={(event) => applyMarkdownPaste(event, editorRef.current)}
                >
                    <MDXEditor
                        ref={editorRef}
                        key={editingId || "new"}
                        className="mdxEditorTheme"
                        markdown={form.body}
                        onChange={(value) => setForm((current) => ({ ...current, body: value }))}
                        plugins={newsPlugins}
                        contentEditableClassName="mdxContent"
                        placeholder="Текст новости: заголовки, списки, ссылки, картинки"
                    />
                </div>
                <label className="mutedText">
                    <input
                        type="checkbox"
                        checked={form.is_published}
                        onChange={(event) => setForm({ ...form, is_published: event.target.checked })}
                    />{" "}
                    опубликовать
                </label>
                <label className="mutedText">
                    <input
                        type="checkbox"
                        checked={form.is_pinned}
                        onChange={(event) => setForm({ ...form, is_pinned: event.target.checked })}
                    />{" "}
                    закрепить в «Обзоре» (показывается первым)
                </label>
                <div className="settingsActions">
                    <button className="btn btnPrimary btnSmall" type="submit" disabled={pending}>
                        {editingId ? "Сохранить" : "Опубликовать"}
                    </button>
                    {editingId > 0 && (
                        <button
                            className="btn btnGhost btnSmall"
                            type="button"
                            onClick={() => {
                                setEditingId(0);
                                setForm(EMPTY);
                            }}
                        >
                            Отмена
                        </button>
                    )}
                </div>
            </form>

            <div className="adminTableWrap">
                <table className="adminTable">
                    <thead>
                        <tr>
                            <th>Заголовок</th>
                            <th>Автор</th>
                            <th>Опубликовано</th>
                            <th>Статус</th>
                            <th>Действия</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item) => (
                            <tr key={item.id}>
                                <td>
                                    {item.title}
                                    {item.is_pinned && <span className="adminBadge">закреплено</span>}
                                </td>
                                <td className="adminTableCellMuted">{item.author_login || "—"}</td>
                                <td className="adminTableCellMuted">{item.published_at}</td>
                                <td>
                                    {item.is_published ? (
                                        <span className="adminBadge adminBadgeSuccess">видна</span>
                                    ) : (
                                        <span className="adminBadge">черновик</span>
                                    )}
                                </td>
                                <td>
                                    <div className="adminRowActions">
                                        <button
                                            className="btn btnSmall"
                                            type="button"
                                            onClick={() => togglePin(item)}
                                        >
                                            {item.is_pinned ? "Открепить" : "Закрепить"}
                                        </button>
                                        <button className="btn btnSmall" type="button" onClick={() => startEdit(item)}>
                                            Изменить
                                        </button>
                                        <button
                                            className="btn btnDanger btnSmall"
                                            type="button"
                                            onClick={() => remove(item)}
                                        >
                                            Удалить
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {!items.length && (
                            <tr>
                                <td colSpan={5} className="adminEmpty">
                                    Новостей пока нет
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </>
    );
};

export default AdminNewsPanel;
