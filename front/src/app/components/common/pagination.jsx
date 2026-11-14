import React from "react";

/**
 * Постраничный вывод: «назад / страницы / вперёд» и общее число записей.
 * Список сетов длинный, поэтому листать страницами удобнее, чем догружать по кнопке.
 */
const Pagination = ({ page, pageSize, total, onChange, label = "сетов" }) => {
    const pages = Math.max(1, Math.ceil(total / pageSize));

    if (total <= pageSize) {
        return <p className="paginationTotal mutedText">Всего {total} {label}</p>;
    }

    // Показываем окно вокруг текущей страницы, чтобы не плодить сотни кнопок.
    const window = [];
    const start = Math.max(1, Math.min(page - 2, pages - 4));
    const end = Math.min(pages, start + 4);

    if (start > 1) {
        window.push(1);
        if (start > 2) {
            window.push("…");
        }
    }
    for (let index = start; index <= end; index += 1) {
        window.push(index);
    }
    if (end < pages) {
        if (end < pages - 1) {
            window.push("…");
        }
        window.push(pages);
    }

    return (
        <nav className="pagination" aria-label="Постраничный вывод">
            <button
                type="button"
                className="paginationBtn"
                onClick={() => onChange(page - 1)}
                disabled={page <= 1}
            >
                Назад
            </button>

            {window.map((item, index) =>
                item === "…" ? (
                    <span key={`gap-${index}`} className="paginationBtn" aria-hidden="true">
                        …
                    </span>
                ) : (
                    <button
                        key={item}
                        type="button"
                        className={`paginationBtn${item === page ? " paginationBtnActive" : ""}`}
                        onClick={() => onChange(item)}
                        aria-current={item === page ? "page" : undefined}
                    >
                        {item}
                    </button>
                )
            )}

            <button
                type="button"
                className="paginationBtn"
                onClick={() => onChange(page + 1)}
                disabled={page >= pages}
            >
                Вперёд
            </button>

            <span className="paginationTotal mutedText">
                Всего {total} {label}, страница {page} из {pages}
            </span>
        </nav>
    );
};

export default Pagination;
