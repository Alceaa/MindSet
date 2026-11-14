import { stripEscapes } from "./escapes";

// Блок кода, набранный руками в обычном режиме, доезжает до markdown как текст: MDXEditor
// не превращает ``` в блок, а сериализатор экранирует бэктик в абзаце (правило
// {character: '`', inConstruct: 'phrasing'}). В статье вместо кода видны \`\`\`.
// Здесь такие «фенсы из текста» собираются обратно в настоящий блок кода — ровно так же,
// как если бы его вставили через панель редактора или набрали в source-режиме.
//
// Настоящие фенсы не трогаем: их редактор и так разбирает в блок кода.

// Настоящий фенс: строка целиком из бэктиков (или тильд) с необязательным языком.
const REAL_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*[^`~]*$/;
// Тот же фенс, но набранный текстом: каждый бэктик экранирован.
const TEXT_FENCE = /^ {0,3}((?:\\`){3,})[ \t]*([\w+#.-]*)[ \t]*$/;
// Закрывающая строка настоящего фенса.
const CLOSING_FENCE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

const isRealClosing = (line, marker, min) => {
    const match = CLOSING_FENCE.exec(line);
    return Boolean(match) && match[1][0] === marker && match[1].length >= min;
};

const isTextClosing = (line, min) => {
    const match = TEXT_FENCE.exec(line);
    return Boolean(match) && match[1].length / 2 >= min;
};

/**
 * Тело блока. В обычном режиме каждый Enter — отдельный абзац, а абзацы в markdown
 * разделены пустой строкой: одна пустая строка — это разделитель, лишние — пустые
 * строки внутри кода (два Enter подряд дают три перевода строки).
 */
const collectBody = (lines) => {
    const body = [];
    let blank = 0;

    for (const line of lines) {
        if (!line.trim()) {
            blank += 1;
            continue;
        }

        if (body.length > 0) {
            const empties = Math.max(0, Math.floor((blank - 1) / 2));
            for (let i = 0; i < empties; i += 1) {
                body.push("");
            }
        }

        blank = 0;
        // Внутри блока кода обратный слеш — часть текста, а не экранирование markdown.
        body.push(stripEscapes(line));
    }

    return body;
};

export const normalizeCodeFences = (markdown) => {
    const value = String(markdown ?? "");

    // Быстрый выход: экранированных бэктиков нет — значит и текстовых фенсов нет.
    if (!value.includes("\\`")) {
        return value;
    }

    const lines = value.replace(/\r\n?/g, "\n").split("\n");
    const result = [];
    let changed = false;
    let index = 0;

    while (index < lines.length) {
        const real = REAL_FENCE.exec(lines[index]);

        if (real) {
            const marker = real[1][0];
            result.push(lines[index]);
            index += 1;

            while (index < lines.length && !isRealClosing(lines[index], marker, real[1].length)) {
                result.push(lines[index]);
                index += 1;
            }

            if (index < lines.length) {
                result.push(lines[index]);
                index += 1;
            }

            continue;
        }

        const text = TEXT_FENCE.exec(lines[index]);

        if (!text) {
            result.push(lines[index]);
            index += 1;
            continue;
        }

        let close = index + 1;
        while (close < lines.length && !isTextClosing(lines[close], text[1].length / 2)) {
            close += 1;
        }

        // Незакрытый фенс — это просто текст, оставляем как есть.
        if (close === lines.length) {
            result.push(lines[index]);
            index += 1;
            continue;
        }

        changed = true;
        result.push(`\`\`\`${text[2]}`);
        result.push(...collectBody(lines.slice(index + 1, close)));
        result.push("```");
        index = close + 1;
    }

    return changed ? result.join("\n") : value;
};

export default normalizeCodeFences;
