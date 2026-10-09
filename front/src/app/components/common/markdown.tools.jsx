import React, { useRef } from "react";

const safeFileName = (value) =>
    String(value ?? "")
        .replace(/[\\/:*?"<>|\n\r\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80) || "document";

const MarkdownTools = ({ editorRef, content, onImport, title }) => {
    const inputRef = useRef(null);

    const handleFile = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";

        if (!file) {
            return;
        }

        const text = await file.text();
        editorRef.current?.setMarkdown(text);
        onImport?.(text);
    };

    const handleExport = () => {
        const markdown = editorRef.current?.getMarkdown() ?? content ?? "";
        const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = `${safeFileName(title)}.md`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <>
            {onImport && (
                <button
                    type="button"
                    className="btn btnGhost btnSmall"
                    onClick={() => inputRef.current?.click()}
                >
                    Импорт .md
                </button>
            )}
            <button
                type="button"
                className="btn btnGhost btnSmall"
                onClick={handleExport}
            >
                Скачать .md
            </button>
            <input
                ref={inputRef}
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
                className="markdownFileInput"
                onChange={handleFile}
            />
        </>
    );
};

export default MarkdownTools;