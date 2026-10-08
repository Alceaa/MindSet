import { buildPickerOptions } from "./picker.options";

const ownSets = [
    { id: 1, title: "Мой сет" },
    { id: 2, title: "Другой сет" },
];

const savedSets = [
    { id: 10, title: "Конспект", source_login: "alice", source_slug: "go", state: "live" },
    {
        id: 11,
        title: "Удалённый",
        source_login: "bob",
        source_slug: "notes",
        state: "source_gone",
    },
    { id: 12, title: "Без адреса", source_login: "", source_slug: "", state: "live" },
];

describe("buildPickerOptions", () => {
    it("объединяет свои сеты и снимки с кросс-ссылкой и бейджем", () => {
        const options = buildPickerOptions({
            allSets: ownSets,
            savedSets,
            currentSetId: null,
            query: "",
        });

        expect(options).toEqual([
            { key: "set-1", title: "Мой сет" },
            { key: "set-2", title: "Другой сет" },
            {
                key: "saved-10",
                title: "Конспект",
                ref: "@alice/go",
                saved: true,
                badge: "⧉ снимок",
            },
            {
                key: "saved-11",
                title: "Удалённый",
                ref: "@bob/notes",
                saved: true,
                badge: "⧉ источник удалён",
            },
        ]);
    });

    it("исключает текущий сет из выдачи", () => {
        const options = buildPickerOptions({
            allSets: ownSets,
            savedSets: [],
            currentSetId: 1,
            query: "",
        });

        expect(options.map((option) => option.key)).toEqual(["set-2"]);
    });

    it("фильтрует по названию и по адресу снимка", () => {
        const byTitle = buildPickerOptions({
            allSets: ownSets,
            savedSets,
            currentSetId: null,
            query: "консп",
        });
        expect(byTitle.map((option) => option.key)).toEqual(["saved-10"]);

        const byRef = buildPickerOptions({
            allSets: [],
            savedSets,
            currentSetId: null,
            query: "@bob",
        });
        expect(byRef.map((option) => option.key)).toEqual(["saved-11"]);
    });

    it("ограничивает список двенадцатью позициями", () => {
        const many = Array.from({ length: 20 }, (_, index) => ({
            id: index + 1,
            title: `Сет ${index + 1}`,
        }));

        const options = buildPickerOptions({
            allSets: many,
            savedSets: [],
            currentSetId: null,
            query: "",
        });

        expect(options).toHaveLength(12);
    });

    it("натуральный порядок: снимок добавляется после своих сетов", () => {
        const options = buildPickerOptions({
            allSets: [],
            savedSets,
            currentSetId: null,
            query: "",
        });

        expect(options).toHaveLength(2);
        expect(options.every((option) => option.saved)).toBe(true);
        expect(options[0].ref).toBe("@alice/go");
    });
});
