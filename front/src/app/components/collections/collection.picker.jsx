import React, { useEffect, useRef, useState } from "react";

/**
 * Метка коллекций у сета: показывает, в каких полках он лежит, и позволяет
 * отметить/снять любую из них — сет может быть сразу в нескольких коллекциях.
 * Внутри карточки-ссылки гасим переход, чтобы клик по метке не открывал сет.
 */
const CollectionPicker = ({ collections, selected = [], onToggle, onCreate, busy }) => {
    const [open, setOpen] = useState(false);
    const [menuPos, setMenuPos] = useState(null);
    const rootRef = useRef(null);
    const buttonRef = useRef(null);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleDown = (event) => {
            if (!rootRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };
        const handleKey = (event) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };
        const close = () => setOpen(false);

        document.addEventListener("mousedown", handleDown);
        document.addEventListener("keydown", handleKey);
        // Меню висит поверх страницы, поэтому при прокрутке его закрываем.
        window.addEventListener("scroll", close, true);
        window.addEventListener("resize", close);

        return () => {
            document.removeEventListener("mousedown", handleDown);
            document.removeEventListener("keydown", handleKey);
            window.removeEventListener("scroll", close, true);
            window.removeEventListener("resize", close);
        };
    }, [open]);

    // Меню рисуем фиксированно: иначе его обрезают контейнеры со скроллом.
    const openMenu = () => {
        const rect = buttonRef.current?.getBoundingClientRect();
        if (!rect) {
            return;
        }

        const width = Math.min(320, window.innerWidth - 24);
        const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
        setMenuPos({ top: rect.bottom + 6, left });
        setOpen(true);
    };

    const chosen = collections.filter((item) => selected.includes(item.id));
    const chipLabel =
        chosen.length === 0
            ? "+ В коллекцию"
            : chosen.length === 1
              ? chosen[0].title
              : `${chosen[0].title} +${chosen.length - 1}`;

    const toggle = async (collectionId, inCollection) => {
        setOpen(false);
        await onToggle?.(collectionId, inCollection);
    };

    const createAndAdd = async () => {
        setOpen(false);
        const title = window.prompt("Название коллекции");
        if (!title?.trim()) {
            return;
        }
        await onCreate?.(title.trim());
    };

    const stop = (event) => {
        event.preventDefault();
        event.stopPropagation();
    };

    return (
        <span className="collectionPicker" ref={rootRef}>
            <button
                ref={buttonRef}
                type="button"
                className={`collectionChip${chosen.length > 0 ? " collectionChipActive" : ""}`}
                disabled={busy}
                onClick={(event) => {
                    stop(event);
                    if (open) {
                        setOpen(false);
                        return;
                    }
                    openMenu();
                }}
                title={
                    chosen.length > 0
                        ? `Коллекции: ${chosen.map((item) => item.title).join(", ")}`
                        : "Положить в коллекцию"
                }
            >
                {chosen.length > 0 && (
                    <span
                        className={`collectionDot collectionDot-${chosen[0].color || "default"}`}
                        aria-hidden="true"
                    />
                )}
                <span className="collectionChipLabel">{chipLabel}</span>
            </button>

            {open && menuPos && (
                <span
                    className="collectionMenu"
                    style={{ position: "fixed", top: menuPos.top, left: menuPos.left }}
                    onClick={stop}
                >
                    {collections.map((item) => {
                        const inCollection = selected.includes(item.id);

                        return (
                            <button
                                key={item.id}
                                type="button"
                                className={`collectionMenuItem${
                                    inCollection ? " collectionMenuItemActive" : ""
                                }`}
                                onClick={() => toggle(item.id, !inCollection)}
                            >
                                <span className="collectionCheck" aria-hidden="true">
                                    {inCollection ? "✓" : ""}
                                </span>
                                <span
                                    className={`collectionDot collectionDot-${item.color || "default"}`}
                                    aria-hidden="true"
                                />
                                <span className="collectionMenuTitle">{item.title}</span>
                                <span className="listMeta">
                                    {item.sets_count + item.saved_count}
                                </span>
                            </button>
                        );
                    })}

                    <button
                        type="button"
                        className="collectionMenuItem collectionMenuCreate"
                        onClick={createAndAdd}
                    >
                        Новая коллекция…
                    </button>
                </span>
            )}
        </span>
    );
};

export default CollectionPicker;
