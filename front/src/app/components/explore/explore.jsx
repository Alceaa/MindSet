import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import setService from "../../api/set.service";
import socialService from "../../api/social.service";
import parseApiError from "../../utils/api.error";
import { useAuth } from "../../context/auth.context";
import SetCard from "../common/set.card.jsx";
import MarkdownContent from "../common/markdown.content.jsx";
import { Skeleton } from "../common/skeleton.jsx";
import EmptyState from "../common/empty.state.jsx";
import { useToast } from "../common/toast.jsx";
import { formatNewsDate } from "../../utils/news.date";
import "../../css/dashboard/dashboard.scss";
import "../../css/dashboard/feed.scss";

const renderAnnouncement = (item) => (
    <article className="announcement" key={item.id}>
        {item.is_pinned && <span className="badge badgePinned">закреплено</span>}
        <h3 className="announcementTitle">{item.title}</h3>
        <MarkdownContent className="announcementBody" content={item.body} />
        <span className="announcementDate">{formatNewsDate(item.date_posted)}</span>
    </article>
);

const Explore = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const { push } = useToast();
    const [feed, setFeed] = useState({ announcements: [], following: [], popular: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [savingId, setSavingId] = useState(null);
    const [newsScrollable, setNewsScrollable] = useState(false);
    const newsListRef = useRef(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError("");
        socialService
            .getFeed()
            .then((data) => {
                if (!cancelled) {
                    setFeed({
                        announcements: data.announcements ?? [],
                        following: data.following ?? [],
                        popular: data.popular ?? [],
                    });
                }
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

    useEffect(() => {
        const node = newsListRef.current;
        if (!node) {
            return undefined;
        }

        const measure = () => setNewsScrollable(node.scrollHeight > node.clientHeight + 2);
        measure();
        window.addEventListener("resize", measure);

        return () => window.removeEventListener("resize", measure);
    }, [feed.announcements]);

    const handleSave = useCallback(
        async (set) => {
            if (!isAuthenticated) {
                navigate("/signin");
                return;
            }
            setSavingId(set.id);
            try {
                await setService.saveExternalSet(set.slug);
                push(`Сет «${set.title}» сохранён в вашу библиотеку`, "success");
            } catch (err) {
                push(parseApiError(err).message, "error");
            } finally {
                setSavingId(null);
            }
        },
        [isAuthenticated, navigate, push]
    );

    const isOwn = (set) =>
        Boolean(set.author) && Boolean(user) && set.author.login === user.login;

    const renderCard = (set) => (
        <SetCard
            key={set.id}
            set={set}
            own={isOwn(set)}
            onSave={isOwn(set) ? undefined : handleSave}
            saving={savingId === set.id}
        />
    );

    return (
        <section className="explore feed">
            <header className="exploreHead">
                <h1 className="exploreTitle">Обзор</h1>
                <p className="mutedText">
                    Новости проекта и свежие сеты сообщества. Ищите через 🔍 в шапке.
                </p>
            </header>

            {error && (
                <div className="alert alertError" role="alert">
                    {error}
                </div>
            )}
            {loading && (
                <div className="feedSkeleton">
                    <Skeleton variant="row" count={3} label="Загружаем новости…" />
                    <Skeleton variant="card" count={3} label="Загружаем ленту…" />
                </div>
            )}

            {!loading && !error && (
                <>
                    {feed.announcements.length > 0 && (
                        <section className="feedSection">
                            <div className="feedSectionHead">
                                <h2 className="feedSectionTitle">Новости проекта</h2>
                                <Link className="feedMore" to="/news">
                                    Все новости →
                                </Link>
                            </div>
                            <div
                                className={`newsScroller${
                                    newsScrollable ? " newsScrollerScrollable" : ""
                                }`}
                                ref={newsListRef}
                            >
                                {feed.announcements.map(renderAnnouncement)}
                            </div>
                        </section>
                    )}

                    <section className="feedSection">
                        <h2 className="feedSectionTitle">
                            От подписок{" "}
                            <span className="listMeta">{feed.following.length}</span>
                        </h2>
                        {feed.following.length > 0 ? (
                            <div className="setGrid">{feed.following.map(renderCard)}</div>
                        ) : (
                            <EmptyState
                                variant="inline"
                                title={
                                    isAuthenticated
                                        ? "Подпишитесь на авторов — их новые сеты появятся здесь."
                                        : "Войдите и подпишитесь на авторов, чтобы следить за их новыми сетами."
                                }
                            />
                        )}
                    </section>

                    <section className="feedSection">
                        <h2 className="feedSectionTitle">Популярные за неделю</h2>
                        {feed.popular.length > 0 ? (
                            <div className="setGrid">{feed.popular.map(renderCard)}</div>
                        ) : (
                            <EmptyState
                                variant="inline"
                                title="Пока нет популярных сетов за последнюю неделю."
                            />
                        )}
                    </section>
                </>
            )}
        </section>
    );
};

export default Explore;

