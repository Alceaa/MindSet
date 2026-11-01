import React, { useMemo } from "react";
import { CODE_TOKEN_CLASSES, CODE_TOKEN_KINDS, highlightCode } from "./highlight";

// Язык приходит классом от редактора: ```go превращается в class="language-go".
export const languageFromClassName = (className) => {
    const match = /language-([\w+#.-]+)/.exec(String(className ?? ""));
    return match ? match[1] : "";
};

const renderTokens = (tokens) =>
    tokens.map((token, index) =>
        token.kind === CODE_TOKEN_KINDS.PLAIN ? (
            token.text
        ) : (
            <span key={`${token.kind}-${index}`} className={CODE_TOKEN_CLASSES[token.kind]}>
                {token.text}
            </span>
        )
    );

/**
 * Блок кода в markdown: разбираем на токены и красим переменными темы (--code-*),
 * поэтому подсветка работает и в тёмной, и в светлой, и в сепии с nord.
 * Код без языка показываем обычным текстом — ровно как он выглядел раньше.
 */
export const CodeBlock = ({ node, children, ...rest }) => {
    const child = Array.isArray(children) ? children[0] : children;
    const isElement = Boolean(child) && typeof child === "object";
    const className = isElement ? child.props?.className ?? "" : "";
    const raw = isElement ? child.props?.children : child;
    const code = typeof raw === "string" ? raw : String(raw ?? "");
    const language = languageFromClassName(className);

    const tokens = useMemo(() => highlightCode(code, language), [code, language]);

    return (
        <pre className="mdCodeBlock" {...rest}>
            <code className={className ? `mdCode ${className}` : "mdCode"}>
                {renderTokens(tokens)}
            </code>
        </pre>
    );
};

export const codeComponents = { pre: CodeBlock };

export default codeComponents;
