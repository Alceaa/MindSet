import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import newsService from "../../api/news.service";
import parseApiError from "../../utils/api.error";
import MarkdownContent from "../common/markdown.content.jsx";
import { formatNewsDate } from "../../utils/news.date";
import "../../css/dashboard/dashboard.scss";
import "../../css/dashboard/feed.scss";

const PAGE_SIZE = 10;

const NewsList = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [hasMore, setHasMore] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        setError("");

        newsService
            .list({ limit: PAGE_SIZE, offset: 0 })
            .then((data) => {
                if (cancelled) {
                    return;
                }
                const page = data.news ?? [];
                setItems(page);
                setHasMore(page.length === PAGE_SIZE);
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(parseApiError(err).message);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const loadMore = useCallback(async () => {
        setLoadingMore(true);
        setError("");

        try {
            const data = await newsService.list({ limit: PAGE_SIZE, offset: items.length });
            const page = data.news ?? [];
            setItems((current) => [...current, ...page]);
            setHasMore(page.length === PAGE_SIZE);
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setLoadingMore(false);
        }
    }, [items.length]);

    return (
        <section className="newsPage">
            <header className="pageHead">
                <div>
                    <h1 className="pageTitle">Новости проекта</h1>
                    <p className="pageSubtitle">Что нового в MindSet</p>
                </div>
                <Link className="btn btnGhost btnSmall" to="/explore">
                    ← Обзор
                </Link>
            </header>

            {error && (
                <div className="alert alertError" role="alert">
                    {error}
                </div>
            )}

            {loading && <p className="mutedText">Загружаем новости…</p>}

            {!loading && !error && items.length === 0 && (
                <p className="mutedText">Новостей пока нет.</p>
            )}

            <div className="newsList">
                {items.map((item) => (
                    <article className="announcement" key={item.id}>
                        {item.is_pinned && <span className="badge badgePinned">закреплено</span>}
                        <h2 className="announcementTitle">{item.title}</h2>
                        <MarkdownContent className="announcementBody" content={item.body} />
                        <span className="announcementDate">{formatNewsDate(item.published_at)}</span>
                    </article>
                ))}
            </div>

            {hasMore && (
                <button
                    type="button"
                    className="btn btnGhost newsMore"
                    onClick={loadMore}
                    disabled={loadingMore}
                >
                    {loadingMore ? "Загружаем…" : "Показать ещё"}
                </button>
            )}
        </section>
    );
};

export default NewsList;
