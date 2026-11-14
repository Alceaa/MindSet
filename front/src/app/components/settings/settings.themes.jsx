import React, { useRef, useState } from "react";
import themeService from "../../api/theme.service";
import parseApiError from "../../utils/api.error";
import { buildThemeVariables } from "../../themes/theme.roles";
import { CUSTOM_THEME_PREFIX } from "../../themes/theme.packages";
import { parseThemeFile, themeFileText, themeFileName } from "../../themes/theme.transfer";
import { Skeleton } from "../common/skeleton.jsx";

const SWATCHES = ["--bg-canvas", "--bg-surface", "--text", "--accent", "--border"];

const swatchColors = (item) => {
    const variables = buildThemeVariables(item.roles ?? {}, item.base);

    return SWATCHES.map((name) => variables[name]);
};

/**
 * «Мои темы»: библиотека сохранённых тем и импорт чужой темы из файла или текста.
 * Каталога и модерации нет — темами делятся напрямую, поэтому обмен идёт здесь.
 */
const ThemesSettings = ({
    themes,
    limit,
    loading,
    selectedId,
    onEdit,
    onApplied,
    onChanged,
    onImport,
}) => {
    const [notice, setNotice] = useState(null);
    const [text, setText] = useState("");
    const [confirming, setConfirming] = useState(0);
    const fileRef = useRef(null);

    const takeParsed = (parsed) => {
        if (!parsed.ok) {
            setNotice({ kind: "error", text: parsed.error });
            return;
        }

        setNotice({
            kind: "success",
            text: "Тема загружена — проверьте цвета и сохраните её в библиотеку",
        });
        setText("");
        onImport({ ...parsed.theme, title: parsed.suggestedTitle });
    };

    const importFromText = () => takeParsed(parseThemeFile(text));

    const importFromFile = (event) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = () => takeParsed(parseThemeFile(String(reader.result ?? "")));
        reader.onerror = () => setNotice({ kind: "error", text: "Не удалось прочитать файл" });
        reader.readAsText(file);

        // Поле очищаем: иначе повторный выбор того же файла не сработает.
        event.target.value = "";
    };

    const download = (item) => {
        const blob = new Blob([themeFileText(item)], { type: "application/json" });
        const link = document.createElement("a");
        const href = URL.createObjectURL(blob);

        link.href = href;
        link.download = themeFileName(item.title, item.key);
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(href);
    };

    const remove = async (item) => {
        setNotice(null);

        try {
            const data = await themeService.remove(item.id);
            setNotice({ kind: "success", text: data?.message || "Тема удалена" });
            setConfirming(0);
            onChanged();
        } catch (err) {
            setNotice({ kind: "error", text: parseApiError(err).message });
        }
    };

    return (
        <div className="card settingsForm">
            <h3 className="settingsSectionLabel">Мои темы</h3>

            {notice && (
                <div
                    className={`alert${notice.kind === "error" ? " alertError" : " alertSuccess"}`}
                    role="status"
                >
                    {notice.text}
                </div>
            )}

            {loading ? (
                <Skeleton variant="row" count={2} label="Загружаем темы…" />
            ) : themes.length === 0 ? (
                <p className="mutedText">
                    Пока ни одной темы. Соберите оформление в конструкторе выше и сохраните его.
                </p>
            ) : (
                <ul className="tokenList">
                    {themes.map((item) => (
                        <li
                            className={`tokenRow${item.id === selectedId ? " tokenRowActive" : ""}`}
                            key={item.id}
                        >
                            <span className="themeRowSwatches" aria-hidden="true">
                                {swatchColors(item).map((color, index) => (
                                    <span
                                        className="themeRowSwatch"
                                        key={SWATCHES[index]}
                                        style={{ backgroundColor: color }}
                                    />
                                ))}
                            </span>

                            <div className="tokenRowMain">
                                <span className="tokenTitle">{item.title}</span>
                                <span className="tokenMeta">
                                    <code>{item.key}</code> · база: {item.base} ·{" "}
                                    {item.mode === "light" ? "светлый режим" : "тёмный режим"}
                                </span>
                                {item.description && (
                                    <span className="mutedText">{item.description}</span>
                                )}
                            </div>

                            <div className="tokenRowActions">
                                <button
                                    className="btn btnGhost btnSmall"
                                    type="button"
                                    onClick={() => onApplied(`${CUSTOM_THEME_PREFIX}${item.key}`)}
                                >
                                    Применить
                                </button>
                                <button
                                    className="btn btnGhost btnSmall"
                                    type="button"
                                    onClick={() => onEdit(item.id)}
                                >
                                    Изменить
                                </button>
                                <button
                                    className="btn btnGhost btnSmall"
                                    type="button"
                                    title="Сохранит тему файлом — им можно поделиться"
                                    onClick={() => download(item)}
                                >
                                    Скачать
                                </button>
                                {confirming === item.id ? (
                                    <>
                                        <button
                                            className="btn btnDanger btnSmall"
                                            type="button"
                                            onClick={() => remove(item)}
                                        >
                                            Удалить
                                        </button>
                                        <button
                                            className="btn btnGhost btnSmall"
                                            type="button"
                                            onClick={() => setConfirming(0)}
                                        >
                                            Отмена
                                        </button>
                                    </>
                                ) : (
                                    <button
                                        className="btn btnGhost btnSmall"
                                        type="button"
                                        onClick={() => setConfirming(item.id)}
                                    >
                                        Удалить
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            <span className="mutedText">
                Сохранено {themes.length} из {limit}.
            </span>

            <div className="themeImport">
                <span className="settingsFieldLabel">Загрузить тему из файла или текста</span>
                <span className="settingsFieldHint">
                    Файл темы MindSet или строка с ролями: тему из чата можно просто вставить
                    текстом. Импорт ничего не применяет — сначала посмотрите её в конструкторе.
                </span>
                <textarea
                    className="input themeImportText"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    rows={3}
                    spellCheck={false}
                    aria-label="Текст темы"
                />
                <div className="settingsActions">
                    <button
                        className="btn btnGhost"
                        type="button"
                        disabled={!text.trim()}
                        onClick={importFromText}
                    >
                        Загрузить из текста
                    </button>
                    <button
                        className="btn btnGhost"
                        type="button"
                        onClick={() => fileRef.current?.click()}
                    >
                        Выбрать файл
                    </button>
                    <input
                        ref={fileRef}
                        className="visuallyHidden"
                        type="file"
                        accept=".json,application/json"
                        onChange={importFromFile}
                        aria-label="Файл темы"
                    />
                </div>
            </div>
        </div>
    );
};

export default ThemesSettings;
