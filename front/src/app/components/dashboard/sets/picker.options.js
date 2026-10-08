const SAVED_BADGES = {
    source_gone: "⧉ источник удалён",
    hidden: "⧉ источник закрыт",
    suppressed: "⧉ доступ отозван",
};

const savedBadge = (state) => SAVED_BADGES[state] ?? "⧉ снимок";

export const buildPickerOptions = ({ allSets, savedSets, currentSetId, query }) => {
    const needle = String(query ?? "").trim().toLowerCase();
    const options = [];

    for (const item of allSets ?? []) {
        if (item.id === currentSetId) {
            continue;
        }
        options.push({ key: `set-${item.id}`, title: item.title });
    }

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

        options.push({
            key: `saved-${item.id}`,
            title: item.title,
            ref,
            saved: true,
            badge: savedBadge(item.state),
        });
    }

    return options
        .filter((option) => {
            if (!needle) {
                return true;
            }
            if (option.title.toLowerCase().includes(needle)) {
                return true;
            }
            return Boolean(option.ref && option.ref.toLowerCase().includes(needle));
        })
        .slice(0, 12);
};

export default buildPickerOptions;
