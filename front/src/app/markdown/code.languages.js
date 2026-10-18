import { CodeMirrorEditor } from "@mdxeditor/editor";

export const CODE_LANGUAGES = {
    "": "Текст",
    console: "Консоль",
    bash: "Bash",
    sh: "Shell",
    powershell: "PowerShell",
    c: "C",
    cpp: "C++",
    css: "CSS",
    diff: "Diff",
    dockerfile: "Dockerfile",
    go: "Go",
    html: "HTML",
    http: "HTTP",
    java: "Java",
    js: "JavaScript",
    json: "JSON",
    jsx: "JSX",
    kotlin: "Kotlin",
    md: "Markdown",
    php: "PHP",
    python: "Python",
    ruby: "Ruby",
    rust: "Rust",
    sql: "SQL",
    toml: "TOML",
    ts: "TypeScript",
    xml: "XML",
    yaml: "YAML",
};

export const codeBlockEditorDescriptors = [
    {
        priority: -1,
        match: () => true,
        Editor: CodeMirrorEditor,
    },
];

export const codeBlockPluginOptions = {
    defaultCodeBlockLanguage: "go",
    codeBlockEditorDescriptors,
};