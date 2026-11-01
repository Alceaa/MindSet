/**
 * Подсветка кода в блоках markdown — без внешних зависимостей.
 *
 * Разбираем текст на токены (комментарий, строка, число, ключевое слово),
 * а цвета берём из переменных темы (--code-*), поэтому подсветка сама
 * подстраивается под светлую, сепию, nord и контраст.
 *
 * Разбор намеренно простой и предсказуемый: незнакомый язык отдаём одним
 * куском текста, а не пытаемся угадать. Важное свойство: склеенные токены
 * всегда равны исходному тексту, поэтому подсветка ничего не теряет.
 */
export const CODE_TOKEN_KINDS = {
    PLAIN: "plain",
    COMMENT: "comment",
    STRING: "string",
    NUMBER: "number",
    KEYWORD: "keyword",
};

// Классы для рендера: цвета заданы в base.scss через переменные темы.
export const CODE_TOKEN_CLASSES = {
    [CODE_TOKEN_KINDS.COMMENT]: "mdCodeComment",
    [CODE_TOKEN_KINDS.STRING]: "mdCodeString",
    [CODE_TOKEN_KINDS.NUMBER]: "mdCodeNumber",
    [CODE_TOKEN_KINDS.KEYWORD]: "mdCodeKeyword",
};

const CORE_C = [
    "if",
    "else",
    "for",
    "while",
    "do",
    "switch",
    "case",
    "default",
    "break",
    "continue",
    "return",
    "new",
    "delete",
    "try",
    "catch",
    "finally",
    "throw",
    "class",
    "this",
    "super",
    "static",
    "const",
    "void",
    "true",
    "false",
    "null",
    "undefined",
];

const JS_KEYWORDS = [
    ...CORE_C,
    "let",
    "var",
    "function",
    "typeof",
    "instanceof",
    "in",
    "of",
    "async",
    "await",
    "yield",
    "import",
    "export",
    "from",
    "as",
    "extends",
    "implements",
    "interface",
    "enum",
    "public",
    "private",
    "protected",
    "readonly",
    "abstract",
    "declare",
    "namespace",
    "type",
    "keyof",
    "infer",
    "any",
    "unknown",
    "never",
    "string",
    "number",
    "boolean",
    "object",
    "symbol",
    "bigint",
    "console",
    "document",
    "window",
];

const GO_KEYWORDS = [
    "break",
    "case",
    "chan",
    "const",
    "continue",
    "default",
    "defer",
    "else",
    "fallthrough",
    "for",
    "func",
    "go",
    "goto",
    "if",
    "import",
    "interface",
    "map",
    "package",
    "range",
    "return",
    "select",
    "struct",
    "switch",
    "type",
    "var",
    "nil",
    "true",
    "false",
    "iota",
    "string",
    "bool",
    "byte",
    "rune",
    "int",
    "int8",
    "int16",
    "int32",
    "int64",
    "uint",
    "uint8",
    "uint16",
    "uint32",
    "uint64",
    "float32",
    "float64",
    "error",
    "make",
    "new",
    "len",
    "cap",
    "append",
    "copy",
    "delete",
    "close",
    "panic",
    "recover",
    "print",
    "println",
];

const PYTHON_KEYWORDS = [
    "and",
    "as",
    "assert",
    "async",
    "await",
    "break",
    "class",
    "continue",
    "def",
    "del",
    "elif",
    "else",
    "except",
    "finally",
    "for",
    "from",
    "global",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "nonlocal",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "try",
    "while",
    "with",
    "yield",
    "True",
    "False",
    "None",
    "self",
    "print",
    "len",
    "range",
    "str",
    "int",
    "float",
    "dict",
    "list",
    "set",
    "tuple",
    "super",
];

const SHELL_KEYWORDS = [
    "if",
    "then",
    "else",
    "elif",
    "fi",
    "for",
    "while",
    "until",
    "do",
    "done",
    "case",
    "esac",
    "function",
    "in",
    "select",
    "time",
    "return",
    "export",
    "local",
    "readonly",
    "declare",
    "unset",
    "set",
    "source",
    "echo",
    "printf",
    "exit",
    "cd",
    "pwd",
    "ls",
    "cp",
    "mv",
    "rm",
    "mkdir",
    "cat",
    "grep",
    "sed",
    "awk",
    "curl",
    "git",
    "docker",
    "npm",
    "yarn",
    "go",
    "sudo",
    "chmod",
    "apt",
    "brew",
];

const SQL_KEYWORDS = [
    "select",
    "from",
    "where",
    "insert",
    "into",
    "values",
    "update",
    "set",
    "delete",
    "create",
    "table",
    "alter",
    "drop",
    "index",
    "view",
    "join",
    "left",
    "right",
    "inner",
    "outer",
    "full",
    "on",
    "group",
    "by",
    "order",
    "having",
    "limit",
    "offset",
    "union",
    "all",
    "distinct",
    "as",
    "and",
    "or",
    "not",
    "null",
    "is",
    "in",
    "between",
    "like",
    "ilike",
    "case",
    "when",
    "then",
    "else",
    "end",
    "primary",
    "key",
    "foreign",
    "references",
    "default",
    "unique",
    "constraint",
    "begin",
    "commit",
    "rollback",
    "transaction",
    "with",
    "returning",
    "cascade",
    "exists",
    "count",
    "sum",
    "avg",
    "min",
    "max",
    "coalesce",
    "cast",
];

const C_KEYWORDS = [
    ...CORE_C,
    "goto",
    "sizeof",
    "typedef",
    "struct",
    "union",
    "enum",
    "extern",
    "register",
    "inline",
    "volatile",
    "unsigned",
    "signed",
    "short",
    "long",
    "int",
    "char",
    "float",
    "double",
    "bool",
    "include",
    "define",
    "ifdef",
    "ifndef",
    "endif",
    "pragma",
    "public",
    "private",
    "protected",
    "virtual",
    "override",
    "template",
    "typename",
    "namespace",
    "using",
    "nullptr",
    "auto",
    "constexpr",
    "mutable",
    "operator",
    "friend",
];

const JAVA_KEYWORDS = [
    ...CORE_C,
    "abstract",
    "assert",
    "boolean",
    "byte",
    "char",
    "double",
    "extends",
    "final",
    "float",
    "implements",
    "import",
    "instanceof",
    "int",
    "interface",
    "long",
    "native",
    "package",
    "private",
    "protected",
    "public",
    "short",
    "strictfp",
    "synchronized",
    "throws",
    "transient",
    "var",
    "volatile",
];

const KOTLIN_KEYWORDS = [
    "abstract",
    "actual",
    "annotation",
    "as",
    "break",
    "by",
    "catch",
    "class",
    "companion",
    "const",
    "constructor",
    "continue",
    "data",
    "do",
    "else",
    "enum",
    "expect",
    "external",
    "final",
    "finally",
    "for",
    "fun",
    "get",
    "if",
    "import",
    "in",
    "init",
    "interface",
    "internal",
    "is",
    "lateinit",
    "null",
    "object",
    "open",
    "operator",
    "out",
    "override",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "sealed",
    "set",
    "super",
    "suspend",
    "this",
    "throw",
    "true",
    "false",
    "try",
    "typealias",
    "val",
    "var",
    "when",
    "while",
];

const RUST_KEYWORDS = [
    "as",
    "async",
    "await",
    "break",
    "const",
    "continue",
    "crate",
    "dyn",
    "else",
    "enum",
    "extern",
    "false",
    "fn",
    "for",
    "if",
    "impl",
    "in",
    "let",
    "loop",
    "match",
    "mod",
    "move",
    "mut",
    "pub",
    "ref",
    "return",
    "self",
    "Self",
    "static",
    "struct",
    "super",
    "trait",
    "true",
    "type",
    "unsafe",
    "use",
    "where",
    "while",
    "String",
    "Vec",
    "Option",
    "Result",
    "Some",
    "None",
    "Ok",
    "Err",
];

const RUBY_KEYWORDS = [
    "alias",
    "and",
    "begin",
    "break",
    "case",
    "class",
    "def",
    "do",
    "else",
    "elsif",
    "end",
    "ensure",
    "false",
    "for",
    "if",
    "in",
    "module",
    "next",
    "nil",
    "not",
    "or",
    "redo",
    "rescue",
    "retry",
    "return",
    "self",
    "super",
    "then",
    "true",
    "undef",
    "unless",
    "until",
    "when",
    "while",
    "yield",
    "puts",
    "require",
    "attr_accessor",
];

const PHP_KEYWORDS = [
    "abstract",
    "and",
    "array",
    "as",
    "break",
    "callable",
    "case",
    "catch",
    "class",
    "clone",
    "const",
    "continue",
    "declare",
    "default",
    "do",
    "echo",
    "else",
    "elseif",
    "empty",
    "enum",
    "extends",
    "final",
    "finally",
    "fn",
    "for",
    "foreach",
    "function",
    "global",
    "if",
    "implements",
    "include",
    "instanceof",
    "interface",
    "isset",
    "list",
    "match",
    "namespace",
    "new",
    "or",
    "print",
    "private",
    "protected",
    "public",
    "readonly",
    "require",
    "return",
    "static",
    "switch",
    "throw",
    "trait",
    "try",
    "unset",
    "use",
    "var",
    "while",
    "xor",
    "yield",
    "true",
    "false",
    "null",
];

const JSON_KEYWORDS = ["true", "false", "null"];

const YAML_KEYWORDS = ["true", "false", "null", "yes", "no", "on", "off"];

const TOML_KEYWORDS = ["true", "false"];

const CSS_KEYWORDS = [
    "media",
    "import",
    "supports",
    "keyframes",
    "font-face",
    "charset",
    "page",
    "layer",
    "container",
    "property",
    "from",
    "to",
    "important",
    "and",
    "not",
    "only",
];

const HTTP_KEYWORDS = [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "HEAD",
    "OPTIONS",
    "TRACE",
    "HTTP",
    "HTTPS",
];

const DOCKER_KEYWORDS = [
    "from",
    "run",
    "cmd",
    "entrypoint",
    "copy",
    "add",
    "env",
    "arg",
    "workdir",
    "expose",
    "volume",
    "user",
    "label",
    "healthcheck",
    "shell",
    "onbuild",
    "stopsignal",
    "as",
];

const asSet = (list, caseInsensitive) =>
    new Set(caseInsensitive ? list.map((item) => item.toLowerCase()) : list);

// Правила разбора по языкам. Ключи — уже приведённые имена (см. LANGUAGE_ALIASES).
const LANGUAGE_RULES = {
    js: {
        lineComments: ["//"],
        blockComments: [["/*", "*/"]],
        strings: ['"', "'", "`"],
        keywords: asSet(JS_KEYWORDS),
    },
    json: { lineComments: ["//"], strings: ['"'], keywords: asSet(JSON_KEYWORDS) },
    go: {
        lineComments: ["//"],
        blockComments: [["/*", "*/"]],
        strings: ['"', "'", "`"],
        keywords: asSet(GO_KEYWORDS),
    },
    python: {
        lineComments: ["#"],
        strings: ['"""', "'''", '"', "'"],
        keywords: asSet(PYTHON_KEYWORDS),
    },
    shell: { lineComments: ["#"], strings: ['"', "'"], keywords: asSet(SHELL_KEYWORDS) },
    sql: {
        lineComments: ["--"],
        blockComments: [["/*", "*/"]],
        strings: ["'", '"'],
        keywords: asSet(SQL_KEYWORDS, true),
        caseInsensitive: true,
    },
    css: {
        blockComments: [["/*", "*/"]],
        strings: ['"', "'"],
        keywords: asSet(CSS_KEYWORDS),
    },
    yaml: { lineComments: ["#"], strings: ['"', "'"], keywords: asSet(YAML_KEYWORDS) },
    toml: { lineComments: ["#"], strings: ['"', "'"], keywords: asSet(TOML_KEYWORDS) },
    c: {
        lineComments: ["//"],
        blockComments: [["/*", "*/"]],
        strings: ['"', "'"],
        keywords: asSet(C_KEYWORDS),
    },
    java: {
        lineComments: ["//"],
        blockComments: [["/*", "*/"]],
        strings: ['"', "'"],
        keywords: asSet(JAVA_KEYWORDS),
    },
    kotlin: {
        lineComments: ["//"],
        blockComments: [["/*", "*/"]],
        strings: ['"', "'"],
        keywords: asSet(KOTLIN_KEYWORDS),
    },
    rust: {
        lineComments: ["//"],
        blockComments: [["/*", "*/"]],
        strings: ['"', "'"],
        keywords: asSet(RUST_KEYWORDS),
    },
    ruby: { lineComments: ["#"], strings: ['"', "'"], keywords: asSet(RUBY_KEYWORDS) },
    php: {
        lineComments: ["//", "#"],
        blockComments: [["/*", "*/"]],
        strings: ['"', "'"],
        keywords: asSet(PHP_KEYWORDS),
    },
    http: { lineComments: ["#"], strings: [], keywords: asSet(HTTP_KEYWORDS) },
    dockerfile: {
        lineComments: ["#"],
        strings: ['"', "'"],
        keywords: asSet(DOCKER_KEYWORDS, true),
        caseInsensitive: true,
    },
    markup: { mode: "markup" },
};

// Как языки называют в ограждениях ```lang.
const LANGUAGE_ALIASES = {
    js: "js",
    javascript: "js",
    node: "js",
    jsx: "js",
    mjs: "js",
    cjs: "js",
    ts: "js",
    tsx: "js",
    typescript: "js",
    json: "json",
    jsonc: "json",
    go: "go",
    golang: "go",
    py: "python",
    python: "python",
    python3: "python",
    sh: "shell",
    shell: "shell",
    bash: "shell",
    zsh: "shell",
    console: "shell",
    powershell: "shell",
    ps1: "shell",
    sql: "sql",
    postgres: "sql",
    postgresql: "sql",
    plpgsql: "sql",
    css: "css",
    scss: "css",
    sass: "css",
    less: "css",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    ini: "toml",
    c: "c",
    h: "c",
    cpp: "c",
    "c++": "c",
    cc: "c",
    hpp: "c",
    java: "java",
    kotlin: "kotlin",
    kt: "kotlin",
    rust: "rust",
    rs: "rust",
    ruby: "ruby",
    rb: "ruby",
    php: "php",
    http: "http",
    dockerfile: "dockerfile",
    docker: "dockerfile",
    html: "markup",
    xml: "markup",
    svg: "markup",
    vue: "markup",
    markup: "markup",
};

export const normalizeLanguage = (language) => {
    const key = String(language ?? "").trim().toLowerCase();
    return LANGUAGE_ALIASES[key] ?? "";
};

export const rulesFor = (language) => LANGUAGE_RULES[normalizeLanguage(language)] ?? null;

const NUMBER_PATTERN =
    /^(?:0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*(?:\.[\d_]+)?(?:[eE][+-]?\d+)?)/;

const WORD_PATTERN = /^[A-Za-z_$][\w$]*/;

const isWordChar = (char) => typeof char === "string" && /[\w$]/.test(char);

const pushToken = (tokens, kind, text) => {
    if (text) {
        tokens.push({ text, kind });
    }
};

// Возвращает позицию сразу за закрывающей кавычкой или -1, если строка не начинается.
const matchString = (code, index, quotes) => {
    for (const quote of quotes) {
        if (!code.startsWith(quote, index)) {
            continue;
        }

        let cursor = index + quote.length;

        while (cursor < code.length) {
            if (code[cursor] === "\\") {
                cursor += 2;
                continue;
            }
            if (code.startsWith(quote, cursor)) {
                return cursor + quote.length;
            }
            cursor += 1;
        }

        // Незакрытая строка — подсвечиваем до конца блока, как делают редакторы.
        return code.length;
    }

    return -1;
};

// Общий разбор: комментарии, строки, числа и ключевые слова.
const tokenizeGeneric = (code, rules) => {
    const tokens = [];
    let plain = "";
    let index = 0;

    const flush = () => {
        pushToken(tokens, CODE_TOKEN_KINDS.PLAIN, plain);
        plain = "";
    };
    const push = (kind, text) => {
        flush();
        pushToken(tokens, kind, text);
    };

    while (index < code.length) {
        let matched = false;

        for (const [open, close] of rules.blockComments ?? []) {
            if (!code.startsWith(open, index)) {
                continue;
            }
            const end = code.indexOf(close, index + open.length);
            const stop = end === -1 ? code.length : end + close.length;
            push(CODE_TOKEN_KINDS.COMMENT, code.slice(index, stop));
            index = stop;
            matched = true;
            break;
        }
        if (matched) {
            continue;
        }

        for (const prefix of rules.lineComments ?? []) {
            if (!code.startsWith(prefix, index)) {
                continue;
            }
            const end = code.indexOf("\n", index);
            const stop = end === -1 ? code.length : end;
            push(CODE_TOKEN_KINDS.COMMENT, code.slice(index, stop));
            index = stop;
            matched = true;
            break;
        }
        if (matched) {
            continue;
        }

        const stringEnd = matchString(code, index, rules.strings ?? []);
        if (stringEnd > -1) {
            push(CODE_TOKEN_KINDS.STRING, code.slice(index, stringEnd));
            index = stringEnd;
            continue;
        }

        if (/[0-9]/.test(code[index]) && !isWordChar(code[index - 1])) {
            const number = NUMBER_PATTERN.exec(code.slice(index));
            if (number) {
                push(CODE_TOKEN_KINDS.NUMBER, number[0]);
                index += number[0].length;
                continue;
            }
        }

        const word = WORD_PATTERN.exec(code.slice(index));
        if (word) {
            const value = word[0];
            const key = rules.caseInsensitive ? value.toLowerCase() : value;
            if (rules.keywords?.has(key)) {
                push(CODE_TOKEN_KINDS.KEYWORD, value);
            } else {
                plain += value;
            }
            index += value.length;
            continue;
        }

        plain += code[index];
        index += 1;
    }

    flush();
    return tokens;
};

// Разметка: имена тегов и атрибутов — ключевые слова, значения атрибутов — строки.
const tokenizeTag = (text) => {
    const tokens = [];
    const parts = text.split(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g);

    parts.forEach((part, partIndex) => {
        if (!part) {
            return;
        }

        if (partIndex % 2 === 1) {
            pushToken(tokens, CODE_TOKEN_KINDS.STRING, part);
            return;
        }

        const names = /[A-Za-z_][\w:.-]*/g;
        let last = 0;
        let match = names.exec(part);

        while (match) {
            pushToken(tokens, CODE_TOKEN_KINDS.PLAIN, part.slice(last, match.index));
            pushToken(tokens, CODE_TOKEN_KINDS.KEYWORD, match[0]);
            last = match.index + match[0].length;
            match = names.exec(part);
        }

        pushToken(tokens, CODE_TOKEN_KINDS.PLAIN, part.slice(last));
    });

    return tokens;
};

const tokenizeMarkup = (code) => {
    const tokens = [];
    let plain = "";
    let index = 0;

    const flush = () => {
        pushToken(tokens, CODE_TOKEN_KINDS.PLAIN, plain);
        plain = "";
    };

    while (index < code.length) {
        if (code.startsWith("<!--", index)) {
            const end = code.indexOf("-->", index + 4);
            const stop = end === -1 ? code.length : end + 3;
            flush();
            pushToken(tokens, CODE_TOKEN_KINDS.COMMENT, code.slice(index, stop));
            index = stop;
            continue;
        }

        if (code[index] === "<") {
            const end = code.indexOf(">", index);
            const stop = end === -1 ? code.length : end + 1;
            flush();
            tokens.push(...tokenizeTag(code.slice(index, stop)));
            index = stop;
            continue;
        }

        plain += code[index];
        index += 1;
    }

    flush();
    return tokens;
};

/**
 * Разбирает код на токены. Незнакомый язык (или язык не указан) — один кусок
 * обычного текста, поэтому подсветка никогда не портит вид.
 */
export const highlightCode = (code, language) => {
    const text = String(code ?? "");
    if (!text) {
        return [];
    }

    const rules = rulesFor(language);
    if (!rules) {
        return [{ text, kind: CODE_TOKEN_KINDS.PLAIN }];
    }

    return rules.mode === "markup" ? tokenizeMarkup(text) : tokenizeGeneric(text, rules);
};

export default highlightCode;
