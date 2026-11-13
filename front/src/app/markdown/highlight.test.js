import { CODE_TOKEN_KINDS, highlightCode, normalizeLanguage, rulesFor } from "./highlight";

const joinTokens = (code, language) =>
    highlightCode(code, language)
        .map((token) => token.text)
        .join("");

const textsOfKind = (code, language, kind) =>
    highlightCode(code, language)
        .filter((token) => token.kind === kind)
        .map((token) => token.text);

describe("highlightCode", () => {
    it("ничего не теряет и не добавляет: токены склеиваются в исходный текст", () => {
        const samples = {
            js: 'const a = 1; // привет\nfunction f(x) { return `a ${x}`; }',
            go: 'package main\n\nfunc main() {\n\tfmt.Println("привет", 42)\n}\n',
            python: 'def f(a):\n    """док-строка"""\n    return a * 2  # два\n',
            shell: "#!/bin/bash\necho \"привет\" # комментарий\n",
            sql: "select id from sets where title like 'a%'; -- хвост\n",
            json: '{"a": [1, 2.5, true, null]}',
            yaml: "title: сет\nlist:\n  - один # комментарий\n",
            markup: '<div class="card" data-x=\'1\'><!-- коммент -->текст</div>',
            http: "GET /api/sets HTTP/1.1\nAccept: application/json\n",
            dockerfile: "FROM golang:1.22 AS build\nRUN go build -o /app .\n",
            md: "# Заголовок\n\nпросто текст",
            diff: "-старая строка\n+новая строка",
            незнакомый: "какой-то текст без подсветки",
        };

        for (const [language, code] of Object.entries(samples)) {
            expect(joinTokens(code, language)).toBe(code);
        }
    });

    it("разбирает javascript: ключевые слова, строки, числа, комментарии", () => {
        const code = 'const x = 0x1f + 1_000;\n// строка ниже\nlet s = "if";';

        expect(textsOfKind(code, "js", CODE_TOKEN_KINDS.KEYWORD)).toEqual(["const", "let"]);
        expect(textsOfKind(code, "js", CODE_TOKEN_KINDS.NUMBER)).toEqual(["0x1f", "1_000"]);
        expect(textsOfKind(code, "js", CODE_TOKEN_KINDS.COMMENT)).toEqual(["// строка ниже"]);
        expect(textsOfKind(code, "js", CODE_TOKEN_KINDS.STRING)).toEqual(['"if"']);
    });

    it("внутри строк и комментариев ключевые слова не подсвечивает", () => {
        const code = '// return null\n"class extends"';

        expect(textsOfKind(code, "js", CODE_TOKEN_KINDS.KEYWORD)).toEqual([]);
    });

    it("разбирает go: ключевое слово и строка", () => {
        const code = 'func main() {\n\tfmt.Println("привет")\n}';

        expect(textsOfKind(code, "go", CODE_TOKEN_KINDS.KEYWORD)).toEqual(["func"]);
        expect(textsOfKind(code, "go", CODE_TOKEN_KINDS.STRING)).toEqual(['"привет"']);
    });

    it("док-строку python считает одной строкой", () => {
        const code = '"""первая\nвторая"""';

        expect(textsOfKind(code, "python", CODE_TOKEN_KINDS.STRING)).toEqual([code]);
    });

    it("в sql ключевые слова не зависят от регистра", () => {
        const code = "SELECT id FROM sets -- выборка";

        expect(textsOfKind(code, "sql", CODE_TOKEN_KINDS.KEYWORD)).toEqual(["SELECT", "FROM"]);
        expect(textsOfKind(code, "sql", CODE_TOKEN_KINDS.COMMENT)).toEqual(["-- выборка"]);
    });

    it("в разметке подсвечивает теги, атрибуты и их значения", () => {
        const code = '<a href="https://example.com">ссылка</a>';

        expect(textsOfKind(code, "html", CODE_TOKEN_KINDS.KEYWORD)).toEqual(["a", "href", "a"]);
        expect(textsOfKind(code, "html", CODE_TOKEN_KINDS.STRING)).toEqual([
            '"https://example.com"',
        ]);
        expect(textsOfKind(code, "html", CODE_TOKEN_KINDS.COMMENT)).toEqual([]);
    });

    it("в разметке вырезает комментарии", () => {
        expect(textsOfKind("<p>a</p><!-- скрыто -->", "html", CODE_TOKEN_KINDS.COMMENT)).toEqual([
            "<!-- скрыто -->",
        ]);
    });

    it("незнакомый язык отдаёт одним куском текста", () => {
        expect(highlightCode("любой текст", "какой-то-язык")).toEqual([
            { text: "любой текст", kind: CODE_TOKEN_KINDS.PLAIN },
        ]);
    });

    it("пустой текст — пустой список токенов", () => {
        expect(highlightCode("", "go")).toEqual([]);
        expect(highlightCode(null, "go")).toEqual([]);
    });

    it("незакрытую строку подсвечивает до конца блока", () => {
        expect(highlightCode('let s = "не закрыл', "js")).toEqual([
            { text: "let", kind: CODE_TOKEN_KINDS.KEYWORD },
            { text: " s = ", kind: CODE_TOKEN_KINDS.PLAIN },
            { text: '"не закрыл', kind: CODE_TOKEN_KINDS.STRING },
        ]);
    });
});

describe("normalizeLanguage", () => {
    it("приводит синонимы к одному имени", () => {
        expect(normalizeLanguage("JavaScript")).toBe("js");
        expect(normalizeLanguage(" tsx ")).toBe("js");
        expect(normalizeLanguage("golang")).toBe("go");
        expect(normalizeLanguage("bash")).toBe("shell");
        expect(normalizeLanguage("yml")).toBe("yaml");
        expect(normalizeLanguage("html")).toBe("markup");
    });

    it("незнакомый язык — пустое имя", () => {
        expect(normalizeLanguage("brainfuck")).toBe("");
        expect(normalizeLanguage(undefined)).toBe("");
        expect(rulesFor("brainfuck")).toBeNull();
    });
});
