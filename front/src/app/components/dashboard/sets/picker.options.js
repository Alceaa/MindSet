import { parseBoardQuery } from "../../../markdown/wikilink";

const SAVED_BADGES = {
    source_gone: "⧉ источник удалён",
    hidden: "⧉ источник закрыт",
    suppressed: "⧉ доступ отозван",
};

const savedBadge = (state) => SAVED_BADGES[state] ?? "⧉ снимок";

// Ограничение на каждую группу своё: иначе при сотнях сетов доски и снимки
// в список вообще не попадают.
const LIMIT_PER_GROUP = 12;

const matches = (option, needle) => {
    if (!needle) {
        return true;
    }
    if (option.title.toLowerCase().includes(needle)) {
        return true;
    }
    return Boolean(option.ref && option.ref.toLowerCase().includes(needle));
};

const pick = (options, needle) => options.filter((option) => matches(option, needle)).slice(0, LIMIT_PER_GROUP);

export const buildPickerOptions = ({ allSets, savedSets, boards, currentSetId, query }) => {
    const { board: boardQuery, needle: rawNeedle } = parseBoardQuery(query);
    const needle = rawNeedle.toLowerCase();

    const ownOptions = [];

    for (const item of allSets ?? []) {
        if (item.id === currentSetId) {
            continue;
        }
        ownOptions.push({ key: `set-${item.id}`, title: item.title });
    }

    const savedOptions = [];
    const seenRefs = new Set();

    for (const item of savedSets ?? []) {
        if (!item.source_login || !item.source_slug) {
            continue;
        }

        const ref = `@${item.source_login}/${item.source_slug}`;
        if (seenRefs.has(ref)) {
            continue;
        }
        seenRefs.add(ref);

        savedOptions.push({
            key: `saved-${item.id}`,
            title: item.title,
            ref,
            saved: true,
            badge: savedBadge(item.state),
        });
    }

    // Доски — третий тип вложения: в текст попадает [[board:Название]].
    const boardOptions = (boards ?? []).map((item) => ({
        key: `board-${item.id}`,
        title: item.title,
        board: true,
        badge: "▦ доска",
    }));

    // Если пользователь набрал [[board:, он спрашивает именно доску — остальное не мешает.
    if (boardQuery) {
        return pick(boardOptions, needle);
    }

    return [
        ...pick(ownOptions, needle),
        ...pick(savedOptions, needle),
        ...pick(boardOptions, needle),
    ];
};

export default buildPickerOptions;
