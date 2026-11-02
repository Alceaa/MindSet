import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import boardService from "../../api/board.service";
import useAppTheme from "../../hooks/use.app.theme";
import parseApiError from "../../utils/api.error";
import "../../css/boards/boards.scss";

const Canvas = React.lazy(() => import("./board.canvas.jsx"));

// Пауза после последней правки, прежде чем сравнивать сцену с сохранённой.
// Правки идут потоком (каждое движение мышью — новое событие), поэтому сначала
// ждём тишину, и только потом решаем, есть ли что сохранять.
const CHECK_DELAY = 800;

// Черновик держим в localStorage: если вкладка закроется до сохранения, работа не пропадёт.
const draftKey = (id) => `mindset:board:${id}`;

// Состояние, которое не нужно хранить: курсоры, открытые меню, перетаскивание.
const VOLATILE_APP_STATE = [
    "collaborators",
    "cursorButton",
    "draggingElement",
    "editingElement",
    "editingLinearElement",
    "editingTextElement",
    "elementsToUpdate",
    "focusedElement",
    "hoveredElement",
    "openDialog",
    "openMenu",
    "openPopup",
    "resizingElement",
    "selectionElement",
    "showHyperlinkPopup",
    "startBoundElement",
    "suggestedBindings",
    "activeTool",
    "contextMenu",
    "isResizing",
    "isRotating",
    "newElement",
    "pasteDialog",
    "pendingImageElementId",
    "shouldCacheIgnoreZoom",
    "snapLines",
];

const cleanAppState = (appState) => {
    const clean = {};

    Object.entries(appState ?? {}).forEach(([key, value]) => {
        if (VOLATILE_APP_STATE.includes(key)) {
            return;
        }
        // Функции и DOM-узлы в jsonb не переживут сериализацию.
        if (typeof value === "function" || (value && typeof value === "object" && value.nodeType)) {
            return;
        }
        clean[key] = value;
    });

    return clean;
};

// Пустой набор картинок держим одним объектом: иначе сравнение «изменилось ли»
// ломается на новой ссылке и сохранение уходит на каждое движение мышью.
const EMPTY_FILES = {};

// Вид холста (прокрутка, зум, выделение) в сцену не входит: такие правки
// сохранять отдельно не нужно, они уедут вместе со следующей настоящей.
const VIEW_ONLY_APP_STATE = [
    "scrollX",
    "scrollY",
    "zoom",
    "offsetTop",
    "offsetLeft",
    "width",
    "height",
    "viewModeEnabled",
    "zenModeEnabled",
    "selectedElementIds",
    "selectedGroupIds",
    "editingGroupId",
];

const contentKey = (clean) => {
    const content = {};

    Object.keys(clean).forEach((key) => {
        if (!VIEW_ONLY_APP_STATE.includes(key)) {
            content[key] = clean[key];
        }
    });

    return JSON.stringify(content);
};

// Отпечаток сцены: содержимое, а не ссылки на объекты. Считаем его только после
// паузы в правках, поэтому разбор JSON рисованию не мешает.
const sceneSignature = (payload) =>
    JSON.stringify({
        elements: payload.elements,
        files: Object.keys(payload.files ?? {}).sort(),
        appState: contentKey(payload.appState),
    });

const sceneFromBoard = (board) => {
    const doc = board?.doc ?? {};

    return {
        elements: Array.isArray(doc.elements) ? doc.elements : [],
        appState: doc.appState ?? {},
        files: doc.files ?? {},
    };
};

const BoardEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { theme } = useAppTheme();

    const [board, setBoard] = useState(null);
    const [scene, setScene] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const [restored, setRestored] = useState(false);
    const [title, setTitle] = useState("");

    const apiRef = useRef(null);
    const pendingRef = useRef(null);
    const timerRef = useRef(null);
    // Что уже сохранено: правки вида (панорама, зум) не должны вызывать новые сохранения.
    const savedRef = useRef({ signature: "" });

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        setError("");

        boardService
            .get(id)
            .then((data) => {
                if (cancelled) {
                    return;
                }

                setBoard(data);
                setTitle(data.title);

                const fromServer = sceneFromBoard(data);
                const draft = window.localStorage.getItem(draftKey(id));

                if (draft) {
                    try {
                        const parsed = JSON.parse(draft);
                        if (Array.isArray(parsed.elements) && parsed.elements.length > 0) {
                            setScene({ ...fromServer, ...parsed });
                            setRestored(true);
                            return;
                        }
                    } catch {
                        window.localStorage.removeItem(draftKey(id));
                    }
                }

                setScene(fromServer);
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
    }, [id]);

    const flush = useCallback(async () => {
        const pending = pendingRef.current;
        if (!pending || !board) {
            return;
        }

        pendingRef.current = null;
        setStatus("Сохраняем…");

        try {
            await boardService.saveDoc(board.id, pending);
            savedRef.current = { signature: sceneSignature(pending) };
            window.localStorage.removeItem(draftKey(board.id));
            setRestored(false);
            setStatus(
                `Сохранено ${new Date().toLocaleTimeString("ru-RU", {
                    hour: "2-digit",
                    minute: "2-digit",
                })}`
            );
            setError("");
        } catch (err) {
            // Черновик остаётся в localStorage: работа не потеряется, пока не сохранится.
            window.localStorage.setItem(draftKey(board.id), JSON.stringify(pending));
            setStatus("");
            setError(parseApiError(err).message);
        }
    }, [board]);

    // Проверяем содержимое, когда правки прекратились: Excalidraw зовёт onChange
    // на каждое движение мышью и на каждое изменение вида, поэтому сравнивать
    // ссылки бессмысленно — сравниваем саму сцену, и только один раз после паузы.
    const checkDirty = useCallback(() => {
        const pending = pendingRef.current;
        if (!pending) {
            return;
        }

        if (sceneSignature(pending) === savedRef.current.signature) {
            return;
        }

        setStatus("Есть несохранённые правки");
        flush();
    }, [flush]);

    const handleChange = useCallback(
        (elements, appState, files) => {
            if (!board) {
                return;
            }

            pendingRef.current = {
                type: "excalidraw",
                version: 2,
                source: "mindset",
                elements,
                appState: cleanAppState(appState),
                files: files ?? EMPTY_FILES,
            };

            if (timerRef.current) {
                window.clearTimeout(timerRef.current);
            }
            timerRef.current = window.setTimeout(() => {
                checkDirty();
            }, CHECK_DELAY);
        },
        [board, checkDirty]
    );

    // Уход со страницы не должен терять правки: дописываем сцену сразу.
    useEffect(
        () => () => {
            if (timerRef.current) {
                window.clearTimeout(timerRef.current);
            }
            flush();
        },
        [flush]
    );

    const rename = useCallback(async () => {
        if (!board || title.trim() === "" || title === board.title) {
            return;
        }

        try {
            const updated = await boardService.update(board.id, {
                title: title.trim(),
                visibility: board.visibility,
            });
            setBoard(updated);
            setTitle(updated.title);
            setError("");
        } catch (err) {
            setError(parseApiError(err).message);
            setTitle(board.title);
        }
    }, [board, title]);

    const changeVisibility = useCallback(
        async (visibility) => {
            if (!board) {
                return;
            }

            try {
                const updated = await boardService.update(board.id, {
                    title: board.title,
                    visibility,
                });
                setBoard(updated);
                setError("");
            } catch (err) {
                setError(parseApiError(err).message);
            }
        },
        [board]
    );

    const remove = useCallback(async () => {
        if (!board || !window.confirm("Удалить доску? Сцена тоже пропадёт.")) {
            return;
        }

        try {
            await boardService.remove(board.id);
            window.localStorage.removeItem(draftKey(board.id));
            navigate("/boards");
        } catch (err) {
            setError(parseApiError(err).message);
        }
    }, [board, navigate]);

    // Выгрузка картинки: движок умеет и PNG, и SVG, нам остаётся отдать файл.
    const exportScene = useCallback(
        async (format) => {
            const api = apiRef.current;
            if (!api) {
                return;
            }

            const elements = api.getSceneElements();
            const appState = cleanAppState(api.getAppState());
            const files = api.getFiles();
            const name = (board?.title || "доска").replace(/[\\/:*?"<>|]/g, "-");

            try {
                const canvasModule = await import("./board.canvas.jsx");
                const blob =
                    format === "svg"
                        ? new Blob(
                              [(await canvasModule.exportToSvg({ elements, appState, files })).outerHTML],
                              { type: "image/svg+xml" }
                          )
                        : await canvasModule.exportToBlob({
                              elements,
                              appState,
                              files,
                              mimeType: "image/png",
                          });

                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `${name}.${format}`;
                link.click();
                URL.revokeObjectURL(url);
            } catch {
                setError("Не удалось выгрузить картинку");
            }
        },
        [board]
    );

    const initialData = useMemo(() => {
        if (!scene) {
            return null;
        }

        return {
            elements: scene.elements,
            appState: { ...scene.appState, collaborators: [] },
            files: scene.files,
            scrollToContent: true,
        };
    }, [scene]);

    if (loading) {
        return <div className="page boardsPage mutedText">Загружаем доску…</div>;
    }

    if (!board || !initialData) {
        return (
            <div className="page boardsPage">
                <p className="errorText">{error || "Доска не найдена"}</p>
                <Link className="btn btnGhost" to="/boards">
                    К списку досок
                </Link>
            </div>
        );
    }

    return (
        <div className="page boardsPage">
            <div className="boardToolbar">
                <Link className="boardBack" to="/boards">
                    ← Доски
                </Link>

                <input
                    className="input boardTitleInput"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    onBlur={rename}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.currentTarget.blur();
                        }
                    }}
                    maxLength={80}
                    aria-label="Название доски"
                />

                <select
                    className="input boardVisibility"
                    value={board.visibility}
                    onChange={(event) => changeVisibility(event.target.value)}
                    aria-label="Видимость доски"
                >
                    <option value="private">Личная</option>
                    <option value="unlisted">По ссылке</option>
                    <option value="public">Публичная</option>
                </select>

                <span className="boardStatus mutedText">
                    {restored ? "Восстановлен черновик" : status}
                </span>

                <div className="boardActions">
                    <button type="button" className="btn btnGhost" onClick={() => exportScene("png")}>
                        PNG
                    </button>
                    <button type="button" className="btn btnGhost" onClick={() => exportScene("svg")}>
                        SVG
                    </button>
                    <button type="button" className="btn btnDanger" onClick={remove}>
                        Удалить
                    </button>
                </div>
            </div>

            {error ? <p className="alertError boardAlert">{error}</p> : null}

            <div className="boardCanvas">
                <React.Suspense fallback={<div className="boardLoading mutedText">Загружаем холст…</div>}>
                    <Canvas
                        initialData={initialData}
                        theme={theme === "nord" || theme === "contrast" || theme === "dark" ? "dark" : "light"}
                        langCode="ru-RU"
                        onChange={handleChange}
                        excalidrawAPI={(api) => {
                            apiRef.current = api;
                        }}
                    />
                </React.Suspense>
            </div>
        </div>
    );
};

export default BoardEditor;
