import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SNIPPET_GROUPS } from "../../markdown/snippets";
import "../../css/common/snippets.scss";

const PANEL_WIDTH = 420;

const MarkdownSnippets = ({ onInsert }) => {
    const [open, setOpen] = useState(false);
    const [anchor, setAnchor] = useState(null);
    const rootRef = useRef(null);
    const buttonRef = useRef(null);
    const panelRef = useRef(null);

    const place = useCallback(() => {
        const rect = buttonRef.current?.getBoundingClientRect();

        if (!rect) {
            return;
        }

        const width = Math.min(PANEL_WIDTH, window.innerWidth - 24);

        setAnchor({
            top: rect.bottom + 6,
            left: Math.min(Math.max(rect.left, 12), Math.max(12, window.innerWidth - width - 12)),
            maxHeight: Math.max(180, window.innerHeight - rect.bottom - 18),
        });
    }, []);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        place();

        const handleDown = (event) => {
            const target = event.target;
            if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
                return;
            }
            setOpen(false);
        };

        const handleKey = (event) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };

        window.addEventListener("scroll", place, true);
        window.addEventListener("resize", place);
        document.addEventListener("mousedown", handleDown);
        document.addEventListener("keydown", handleKey);

        return () => {
            window.removeEventListener("scroll", place, true);
            window.removeEventListener("resize", place);
            document.removeEventListener("mousedown", handleDown);
            document.removeEventListener("keydown", handleKey);
        };
    }, [open, place]);

    if (!onInsert) {
        return null;
    }

    return (
        <>
            <span className="snippetsMenu" ref={rootRef}>
                <button
                    ref={buttonRef}
                    type="button"
                    className="toolbarSnippets"
                    title="Готовые блоки и шаблоны"
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    onClick={() => setOpen((current) => !current)}
                >
                    Шаблоны
                </button>
            </span>

            {open && anchor
                ? createPortal(
                      <div
                          ref={panelRef}
                          className="snippetsPopover"
                          role="dialog"
                          aria-label="Готовые блоки"
                          style={{
                              top: anchor.top,
                              left: anchor.left,
                              maxHeight: anchor.maxHeight,
                          }}
                      >
                          {SNIPPET_GROUPS.map((group) => (
                              <div className="snippetsGroup" key={group.key}>
                                  <span className="snippetsGroupTitle">{group.title}</span>
                                  <div className="snippetsList">
                                      {group.items.map((item) => (
                                          <button
                                              key={item.key}
                                              type="button"
                                              className="snippetItem"
                                              onClick={() => {
                                                  onInsert(item.markdown);
                                                  setOpen(false);
                                              }}
                                          >
                                              <span className="snippetTitle">{item.title}</span>
                                              <span className="snippetHint">{item.hint}</span>
                                          </button>
                                      ))}
                                  </div>
                              </div>
                          ))}
                      </div>,
                      document.body
                  )
                : null}
        </>
    );
};

export default MarkdownSnippets;
