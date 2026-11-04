// Правки в source-режиме MDXEditor не проходят через onChange: редактор публикует их
// в отдельную ячейку markdownSourceEditorValue$, а markdown$ (и, значит, onChange)
// остаётся прежним. Поэтому source-режим отслеживается отдельно, а при возврате в
// обычный режим rich-text пересобирается из набранного черновика.

export const SOURCE_MODES = ["source", "diff"];

/** Режим, в котором текст правится как markdown и не приходит в onChange. */
export const isSourceMode = (mode) => SOURCE_MODES.includes(mode);

/**
 * Нужно ли после выхода из source-режима пересобрать rich-text из черновика.
 * Пересобираем только если в source-режиме текст действительно изменили: иначе
 * лишний setMarkdown сбрасывал бы курсор и историю отмены.
 */
export const shouldReapplySource = ({ previousMode, nextMode, draft, baseline }) => {
    if (nextMode !== "rich-text" || !isSourceMode(previousMode)) {
        return false;
    }

    if (typeof draft !== "string" || typeof baseline !== "string") {
        return false;
    }

    return draft !== baseline;
};
