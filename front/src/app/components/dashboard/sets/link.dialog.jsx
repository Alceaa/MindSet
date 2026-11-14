import React, { useEffect, useRef, useState } from "react";

// Адрес причёсываем сами: без схемы подставляем https, а «/путь», «#якорь» и «mailto:…»
// оставляем как есть — это рабочие относительные и служебные ссылки.
const normalizeHref = (value) => {
    // Пробелы и скобки внутри адреса ломают markdown-ссылку: подставляем коды.
    const href = String(value ?? "")
        .trim()
        .replace(/\s+/g, "%20")
        .replace(/\(/g, "%28")
        .replace(/\)/g, "%29");

    if (!href || href.startsWith("/") || href.startsWith("#") || href.startsWith("//")) {
        return href;
    }

    return /^[a-z][a-z0-9+.-]*:/i.test(href) ? href : `https://${href}`;
};

/**
 * Свой диалог ссылки. У MDXEditor подсказка висела у выделения и закрывалась при прокрутке
 * страницы, поэтому адрес и текст спрашиваем обычным окном. Компонент самостоятельный —
 * годится и для других редакторов (например, для новостей в админке).
 */
const LinkDialog = ({ initial, onApply, onClose }) => {
    const [href, setHref] = useState(initial?.href ?? "");
    const [text, setText] = useState(initial?.text ?? "");
    const hrefRef = useRef(null);

    useEffect(() => {
        hrefRef.current?.focus();
        hrefRef.current?.select();
    }, []);

    useEffect(() => {
        const handleKey = (event) => {
            if (event.key === "Escape") {
                onClose();
            }
        };

        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [onClose]);

    const address = normalizeHref(href);

    const submit = (event) => {
        event.preventDefault();

        if (!address) {
            return;
        }

        onApply({ href: address, text: text.trim() });
    };

    return (
        <div className="confirmOverlay" role="presentation" onClick={onClose}>
            <form
                className="confirmDialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="linkDialogTitle"
                onClick={(event) => event.stopPropagation()}
                onSubmit={submit}
            >
                <h2 className="confirmTitle" id="linkDialogTitle">
                    Ссылка
                </h2>
                <p className="mutedText">
                    Без схемы добавим https:// — можно вставить адрес как есть. На сеты ссылайтесь
                    кнопкой «[[ ]] ссылка»: статья перепишет её в заголовок.
                </p>

                <label className="settingsField">
                    <span className="settingsFieldLabel">Адрес</span>
                    <input
                        ref={hrefRef}
                        className="input"
                        value={href}
                        onChange={(event) => setHref(event.target.value)}
                        placeholder="example.com/page"
                        spellCheck={false}
                        aria-label="Адрес ссылки"
                    />
                </label>

                <label className="settingsField">
                    <span className="settingsFieldLabel">Текст (необязательно)</span>
                    <input
                        className="input"
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        placeholder="Что увидит читатель"
                        aria-label="Текст ссылки"
                    />
                </label>

                <div className="confirmActions">
                    <button className="btn btnPrimary" type="submit" disabled={!address}>
                        Вставить ссылку
                    </button>
                    <button className="btn btnGhost" type="button" onClick={onClose}>
                        Отмена
                    </button>
                </div>
            </form>
        </div>
    );
};

export default LinkDialog;
