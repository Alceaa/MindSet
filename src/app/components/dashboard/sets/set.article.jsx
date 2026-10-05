import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { normalizeTitle, prepareMarkdown, stripEscapes } from "../../../markdown/wikilink";
import "../../../css/dashboard/article.scss";

const WIKILINK_PREFIX = "wikilink:";

const SetArticle = ({ content, links }) => {
    const markdown = useMemo(() => prepareMarkdown(content), [content]);
    const targets = useMemo(
        () => new Map(links.map((link) => [normalizeTitle(stripEscapes(link.label)), link])),
        [links]
    );

    const components = useMemo(
        () => ({
            a({ node, href, children, ...rest }) {
                if (typeof href === "string" && href.startsWith(WIKILINK_PREFIX)) {
                    const key = decodeURIComponent(href.slice(WIKILINK_PREFIX.length));
                    const target = targets.get(key);

                    if (!target || target.broken) {
                        const wasResolved = Boolean(target?.resolved_once);

                        return (
                            <span
                                className={
                                    wasResolved ? "articleLinkBroken" : "articleLinkMissing"
                                }
                                title={
                                    wasResolved
                                        ? `Сет «${target.label}» удалён или переименован`
                                        : `Сета «${String(children)}» нет — создайте его`
                                }
                            >
                                {children}
                            </span>
                        );
                    }

                    const to = target.own
                        ? `/sets/${target.target_id}`
                        : `/s/${target.target_slug}`;

                    return (
                        <Link className="articleLink" to={to} title={target.target_title}>
                            {children}
                        </Link>
                    );
                }

                const external = typeof href === "string" && /^https?:\/\//i.test(href);

                return (
                    <a
                        className="articleLink"
                        href={href}
                        {...(external
                            ? { target: "_blank", rel: "noreferrer noopener" }
                            : {})}
                        {...rest}
                    >
                        {children}
                    </a>
                );
            },
        }),
        [targets]
    );

    if (!markdown.trim()) {
        return (
            <p className="articleEmpty mutedText">
                Сет пустой. Нажмите «Редактировать», чтобы добавить содержимое.
            </p>
        );
    }

    return (
        <article className="article">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={components}
                transformLinkUri={(uri) => uri}
            >
                {markdown}
            </ReactMarkdown>
        </article>
    );
};

export default SetArticle;