import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Avatar from "@mui/material/Avatar";
import {
    BlockTypeSelect,
    BoldItalicUnderlineToggles,
    CreateLink,
    ListsToggle,
    MDXEditor,
    Separator,
    UndoRedo,
    headingsPlugin,
    linkDialogPlugin,
    linkPlugin,
    listsPlugin,
    markdownShortcutPlugin,
    quotePlugin,
    thematicBreakPlugin,
    toolbarPlugin,
} from "@mdxeditor/editor";
import "@mdxeditor/editor/style.css";
import userService from "../../api/user.service";
import setService from "../../api/set.service";
import parseApiError from "../../utils/api.error";
import { useAuth } from "../../context/auth.context";
import "../../css/dashboard/dashboard.scss";
import "../../css/dashboard/profile.scss";

const BIO_MAX = 500;

const initialOf = (login) => (login ? login.trim().charAt(0).toUpperCase() : "?");

const ProfileSettingsPanel = () => {
    const { user, updateUser } = useAuth();
    const [bio, setBio] = useState(user?.bio ?? "");
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState("");
    const [removeAvatar, setRemoveAvatar] = useState(false);
    const [saving, setSaving] = useState(false);
    const [notice, setNotice] = useState(null);
    const [mySets, setMySets] = useState([]);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [linkQuery, setLinkQuery] = useState("");
    const fileInputRef = useRef(null);
    const editorRef = useRef(null);

    useEffect(() => {
        setBio(user?.bio ?? "");
    }, [user]);

    useEffect(() => {
        let active = true;
        setService
            .getSets()
            .then((items) => {
                if (active) {
                    setMySets(items);
                }
            })
            .catch(() => {
                if (active) {
                    setMySets([]);
                }
            });
        return () => {
            active = false;
        };
    }, []);

    const filteredSets = useMemo(() => {
        const needle = linkQuery.trim().toLowerCase();
        if (!needle) {
            return mySets;
        }
        return mySets.filter((item) => item.title.toLowerCase().includes(needle));
    }, [mySets, linkQuery]);

    const bioPlugins = useMemo(
        () => [
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            thematicBreakPlugin(),
            markdownShortcutPlugin(),
            linkPlugin(),
            linkDialogPlugin(),
            toolbarPlugin({
                toolbarContents: () => (
                    <>
                        <UndoRedo />
                        <Separator />
                        <BlockTypeSelect />
                        <BoldItalicUnderlineToggles />
                        <ListsToggle />
                        <CreateLink />
                    </>
                ),
            }),
        ],
        []
    );

    const insertSetLink = (title) => {
        const snippet = `[[${title}]]`;
        const editor = editorRef.current;
        if (editor && typeof editor.insertMarkdown === "function") {
            editor.insertMarkdown(snippet);
        } else {
            setBio((current) => `${current}${current ? " " : ""}${snippet}`);
        }
        setPickerOpen(false);
    };

    useEffect(() => {
        if (!file) {
            setPreviewUrl("");
            return undefined;
        }
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);

    const handleFileChange = (event) => {
        const selected = event.target.files?.[0] ?? null;
        setFile(selected);
        if (selected) {
            setRemoveAvatar(false);
        }
    };

    const handleRemoveAvatar = () => {
        setFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        setRemoveAvatar(true);
    };

    const handleSave = async (event) => {
        event.preventDefault();
        setSaving(true);
        setNotice(null);

        try {
            if (file) {
                const uploaded = await userService.uploadAvatar(file);
                updateUser(uploaded.user);
            }

            const updated = await userService.updateMe({
                bio,
                remove_avatar: Boolean(removeAvatar && !file),
            });
            updateUser(updated.user);

            setFile(null);
            setRemoveAvatar(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = "";
            }
            setNotice({ kind: "success", text: "Профиль сохранён" });
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        } finally {
            setSaving(false);
        }
    };

    const avatarPreview = previewUrl || (!removeAvatar ? user?.avatar : "") || undefined;

    return (
        <section className="settingsPanel">
            <header className="settingsPanelHead">
                <h2 className="settingsPanelTitle">Профиль</h2>
                <p className="mutedText">
                    Публичную страницу видят все:{" "}
                    <Link to={`/u/${user?.login ?? ""}`}>/{user?.login}</Link>
                </p>
            </header>

            {notice && (
                <div className={`alert${notice.kind === "error" ? " alertError" : ""}`} role="status">
                    {notice.text}
                </div>
            )}

            <form className="card" onSubmit={handleSave}>
                <div className="profileAvatarRow">
                    <Avatar src={avatarPreview} sx={{ width: 80, height: 80, fontSize: 32 }}>
                        {initialOf(user?.login)}
                    </Avatar>
                    <div className="profileAvatarActions">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/gif,image/webp"
                            onChange={handleFileChange}
                            hidden
                        />
                        <button
                            className="btn btnGhost btnSmall"
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            Загрузить аватар
                        </button>
                        {(user?.avatar || previewUrl) && (
                            <button className="btn btnGhost btnSmall" type="button" onClick={handleRemoveAvatar}>
                                Удалить аватар
                            </button>
                        )}
                        <span className="listMeta">PNG, JPEG, GIF или WebP, до 2 МБ</span>
                    </div>
                </div>

                <div className="profileField" style={{ marginTop: "var(--gap)" }}>
                    <div className="bioFieldHead">
                        <span className="profileFieldLabel">Биография</span>
                        <button
                            type="button"
                            className="btn btnGhost btnSmall"
                            onClick={() => setPickerOpen((open) => !open)}
                        >
                            🔗 Ссылка на сет
                        </button>
                    </div>
                    {pickerOpen && (
                        <div className="bioLinkPicker">
                            <input
                                className="input bioLinkSearch"
                                type="search"
                                value={linkQuery}
                                onChange={(event) => setLinkQuery(event.target.value)}
                                placeholder="Найти сет по названию…"
                                autoFocus
                            />
                            {filteredSets.length === 0 ? (
                                <span className="mutedText">Ничего не найдено</span>
                            ) : (
                                <ul className="bioLinkList">
                                    {filteredSets.map((item) => (
                                        <li key={item.id}>
                                            <button
                                                type="button"
                                                className="bioLinkOption"
                                                onClick={() => insertSetLink(item.title)}
                                            >
                                                {item.title}
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                    <div className="bioEditorWrap">
                        <div className="mdxEditorHost">
                            <MDXEditor
                                ref={editorRef}
                                markdown={bio}
                                onChange={(value) => setBio(value)}
                                plugins={bioPlugins}
                                contentEditableClassName="mdxContent"
                                placeholder="Расскажите о себе и своих сетах"
                            />
                        </div>
                    </div>
                    <span className="profileCounter">
                        {bio.length} / {BIO_MAX}
                    </span>
                </div>

                <div className="profileActions" style={{ marginTop: "var(--gap)", marginLeft: 0 }}>
                    <button className="btn btnPrimary" type="submit" disabled={saving}>
                        {saving ? "Сохраняем..." : "Сохранить"}
                    </button>
                </div>
            </form>
        </section>
    );
};

export default ProfileSettingsPanel;
