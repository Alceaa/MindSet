import { normalizeTitle, prepareMarkdown, stripEscapes } from "./wikilink";

const cases = [
    {
        name: "ссылка в экранированной форме от MDXEditor",
        input: "**\\[\\[Da]]**",
        want: "**[Da](wikilink:da)**",
    },
    {
        name: "экранированные скобки с обеих сторон",
        input: "Смотри \\[\\[План\\]\\] и всё.",
        want: "Смотри [План](wikilink:%D0%BF%D0%BB%D0%B0%D0%BD) и всё.",
    },
    {
        name: "ссылка с подписью",
        input: "Смотри [[План на неделю|план]] и всё.",
        want: "Смотри [план](wikilink:%D0%BF%D0%BB%D0%B0%D0%BD%20%D0%BD%D0%B0%20%D0%BD%D0%B5%D0%B4%D0%B5%D0%BB%D1%8E) и всё.",
    },
    {
        name: "пробелы внутри скобок закодированы сущностями",
        input: "Смотри [[План&#x20;на&#x20;неделю]] и [[Отчёт&#32;за день]].",
        want: "Смотри [План на неделю](wikilink:%D0%BF%D0%BB%D0%B0%D0%BD%20%D0%BD%D0%B0%20%D0%BD%D0%B5%D0%B4%D0%B5%D0%BB%D1%8E) и [Отчёт за день](wikilink:%D0%BE%D1%82%D1%87%D1%91%D1%82%20%D0%B7%D0%B0%20%D0%B4%D0%B5%D0%BD%D1%8C).",
    },
    {
        name: "экранированная пунктуация внутри имени сета попадает в ключ без слешей",
        input: "Смотри \\[\\[Мой\\_сет]] и \\[\\[A \\& B]].",
        want: "Смотри [Мой\\_сет](wikilink:%D0%BC%D0%BE%D0%B9_%D1%81%D0%B5%D1%82) и [A \\& B](wikilink:a%20%26%20b).",
    },
    {
        name: "несколько ссылок в тексте",
        input: "- [[Первое]]\n- [[Второе]]\n\nАбзац со [[Третьим]].",
        want: "- [Первое](wikilink:%D0%BF%D0%B5%D1%80%D0%B2%D0%BE%D0%B5)\n- [Второе](wikilink:%D0%B2%D1%82%D0%BE%D1%80%D0%BE%D0%B5)\n\nАбзац со [Третьим](wikilink:%D1%82%D1%80%D0%B5%D1%82%D1%8C%D0%B8%D0%BC).",
    },
    {
        name: "ссылки внутри кода не превращаются в ссылки",
        input: "```go\nfmt.Println(\"[[Внутри]]\")\n```\n\nИ ещё [[После]] и `[[Тоже нет]]`.",
        want: "```go\nfmt.Println(\"[[Внутри]]\")\n```\n\nИ ещё [После](wikilink:%D0%BF%D0%BE%D1%81%D0%BB%D0%B5) и `[[Тоже нет]]`.",
    },
    {
        name: "незакрытые и пустые скобки остаются текстом",
        input: "[[Незакрытая и [[]] и [ [обычные скобки] ]",
        want: "[[Незакрытая и [[]] и [ [обычные скобки] ]",
    },
    {
        name: "битая сущность не ломает разбор",
        input: "[[&#x110000; битый кодпоинт]] и [[План]]",
        want: "[&#x110000; битый кодпоинт](wikilink:%26%23x110000%3B%20%D0%B1%D0%B8%D1%82%D1%8B%D0%B9%20%D0%BA%D0%BE%D0%B4%D0%BF%D0%BE%D0%B8%D0%BD%D1%82) и [План](wikilink:%D0%BF%D0%BB%D0%B0%D0%BD)",
    },
];

describe("prepareMarkdown", () => {
    cases.forEach((testCase) => {
        it(testCase.name, () => {
            expect(prepareMarkdown(testCase.input)).toBe(testCase.want);
        });
    });

    it("перенос строк CRLF нормализуется", () => {
        expect(prepareMarkdown("[[План]]\r\nдальше")).toBe("[План](wikilink:%D0%BF%D0%BB%D0%B0%D0%BD)\nдальше");
    });
});

describe("stripEscapes", () => {
    it("снимает экранирование пунктуации", () => {
        expect(stripEscapes("Мой\\_сет и A \\& B и \\[скобка\\]")).toBe("Мой_сет и A & B и [скобка]");
    });
});

describe("normalizeTitle", () => {
    it("приводит имя к ключу", () => {
        expect(normalizeTitle("  ПЛАН   на  неделю ")).toBe("план на неделю");
    });
});
