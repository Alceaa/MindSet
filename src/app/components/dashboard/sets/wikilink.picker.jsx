import React, { useEffect } from "react";

const WikilinkPicker = ({ query, options, activeIndex, position, error, onPick, onClose }) => {
    useEffect(() => {
        document.querySelector(".wikilinkOptionActive")?.scrollIntoView({ block: "nearest" });
    }, [activeIndex, options.length]);

    const style = {
        left: `${position?.left ?? 12}px`,
        top: `${position?.top ?? 52}px`,
    };

    const trimmed = (query ?? "").trim();

    return (
        <div className="wikilinkPicker" style={style} onMouseDown={(event) => event.stopPropagation()}>
            <div className="wikilinkHeader">
                <span className="wikilinkQuery">
                    [[{query}
                    {trimmed ? <span className="wikilinkCursor" /> : null}
                </span>
                <button className="btn btnGhost btnSmall" onClick={onClose} type="button">
                    Esc
                </button>
            </div>

            {error && <div className="alert alertError wikilinkAlert">{error}</div>}

            {options.length === 0 ? (
                <p className="wikilinkEmpty mutedText">
                    {trimmed
                        ? `Сета «${trimmed}» нет — ссылка не создастся`
                        : "Ничего не найдено"}
                </p>
            ) : (
                <ul className="wikilinkList">
                    {options.map((option, index) => (
                        <li key={option.key ?? option.title}>
                            <button
                                type="button"
                                className={`wikilinkOption${
                                    index === activeIndex ? " wikilinkOptionActive" : ""
                                }`}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    onPick(option, false);
                                }}
                            >
                                <span className="wikilinkOptionTitle">{option.title}</span>
                                {option.badge ? (
                                    <span className="wikilinkOptionBadge">{option.badge}</span>
                                ) : null}
                            </button>
                        </li>
                    ))}
                </ul>
            )}

            <p className="wikilinkHint">
                ↑↓ — выбор, Enter — вставить, Shift+Enter — с подписью, Esc — закрыть
            </p>
        </div>
    );
};

export default WikilinkPicker;
