import React, { useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { prepareMarkdown } from "../../markdown/wikilink";
import { rehypePlugins } from "../../markdown/render";

const WIKILINK_PREFIX = "wikilink:";

// Ссылка на сет ([[Название]]) осмысленна только на странице сета: там она превращается
// в переход, а в остальных местах (лента, новости) показываем просто текст.
export const markdownComponents = {
    a({ node, href, children, ...rest }) {
        if (typeof href === "string" && href.startsWith(WIKILINK_PREFIX)) {
            return <span className="markdownWikilink">{children}</span>;
        }

        const external = typeof href === "string" && /^https?:\/\//i.test(href);

        return (
            <a
                className="markdownLink"
                href={href}
                {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                {...rest}
            >
                {children}
            </a>
        );
    },
};

const MarkdownContent = ({ content, className, components, emptyText }) => {
    const markdown = useMemo(() => prepareMarkdown(content ?? ""), [content]);

    if (!markdown.trim()) {
        return emptyText ? <p className={className}>{emptyText}</p> : null;
    }

    return (
        <div className={className}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={rehypePlugins}
                components={components ?? markdownComponents}
                transformLinkUri={(uri) => uri}
            >
                {markdown}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownContent;
