import React, { useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { normalizeTitle, prepareMarkdown, stripEscapes } from "../../../markdown/wikilink";
import { rehypePlugins, remarkPlugins } from "../../../markdown/render";
import { useAnchorLinks } from "../../../markdown/heading.id.js";
import "../../../css/dashboard/article.scss";

const WIKILINK_PREFIX = "wikilink:";

const SetArticle = ({ content, links, emptyText }) => {
    const markdown = useMemo(() => prepareMarkdown(content), [content]);
    const articleRef = useRef(null);

    useAnchorLinks(articleRef, markdown);
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

                    if (!target) {
                        return (
                            <span
                                className="articleLinkMissing"
                                title={`Сета «${String(children)}» нет — создайте его`}
                            >
                                {children}
                            </span>
                        );
                    }

                    if (target.own && !target.broken) {
                        return (
                            <Link
                                className="articleLink"
                                to={`/sets/${target.target_id}`}
                                title={target.target_title}
                            >
                                {children}
                            </Link>
                        );
                    }

                    const unavailable = target.broken || !target.live_available;

                    if (target.snapshot_id && (unavailable || target.snapshot_own)) {
                        return (
                            <Link
                                className="articleLink articleLinkSnapshot"
                                to={`/snapshots/${target.snapshot_id}`}
                                title={`Снимок сета «${target.snapshot_title || target.target_title}»`}
                            >
                                {children}
                                <span className="snapshotMark">⧉</span>
                            </Link>
                        );
                    }

                    if (unavailable) {
                        return (
                            <span
                                className={
                                    target.resolved_once ? "articleLinkBroken" : "articleLinkMissing"
                                }
                                title={
                                    target.resolved_once
                                        ? `Сет «${target.label}» удалён, переименован или закрыт`
                                        : `Сета «${String(children)}» нет — создайте его`
                                }
                            >
                                {children}
                            </span>
                        );
                    }

                    return (
                        <Link
                            className="articleLink"
                            to={`/s/${target.target_slug}`}
                            title={target.target_title}
                        >
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
                {emptyText || "Сет пустой. Нажмите «Редактировать», чтобы добавить содержимое."}
            </p>
        );
    }

    return (
        <article className="article" ref={articleRef}>
            <ReactMarkdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={components}
                transformLinkUri={(uri) => uri}
            >
                {markdown}
            </ReactMarkdown>
        </article>
    );
};

export default SetArticle;