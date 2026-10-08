import React, { useEffect, useRef, useState } from "react";
import { READER_GROUPS } from "../../../hooks/use.reader.settings";

const ReaderSettings = ({ settings, onChange, onReset }) => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleDown = (event) => {
            if (!rootRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleDown);
        return () => document.removeEventListener("mousedown", handleDown);
    }, [open]);

    return (
        <div className="readerSettings" ref={rootRef}>
            <button
                type="button"
                className={`btn btnGhost btnSmall${open ? " btnActive" : ""}`}
                onClick={() => setOpen((current) => !current)}
                title="Вид статьи"
            >
                Aa
            </button>

            {open && (
                <div className="readerPopover">
                    {READER_GROUPS.map((group) => (
                        <div className="readerRow" key={group.key}>
                            <span className="readerRowLabel">{group.label}</span>
                            <div className="readerChoices">
                                {group.options.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        className={`readerChoice${
                                            settings[group.key] === option.value
                                                ? " readerChoiceActive"
                                                : ""
                                        }`}
                                        onClick={() => onChange(group.key, option.value)}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}

                    <button type="button" className="readerReset" onClick={onReset}>
                        Сбросить вид
                    </button>
                </div>
            )}
        </div>
    );
};

export default ReaderSettings;