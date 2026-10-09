import React, { useMemo, useRef } from "react";
import ReactMarkdown from "react-markdown";
import { prepareMarkdown } from "../../markdown/wikilink";
import { rehypePlugins, remarkPlugins } from "../../markdown/render";
import { useAnchorLinks } from "../../markdown/heading.id.js";

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
    const contentRef = useRef(null);

    useAnchorLinks(contentRef, markdown);

    if (!markdown.trim()) {
        return emptyText ? <p className={className}>{emptyText}</p> : null;
    }

    return (
        <div className={className} ref={contentRef}>
            <ReactMarkdown
                remarkPlugins={remarkPlugins}
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
