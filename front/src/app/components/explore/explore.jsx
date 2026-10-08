import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import setService from "../../api/set.service";
import socialService from "../../api/social.service";
import parseApiError from "../../utils/api.error";
import { useAuth } from "../../context/auth.context";
import SetCard from "../common/set.card.jsx";
import MarkdownContent from "../common/markdown.content.jsx";
import "../../css/dashboard/dashboard.scss";
import "../../css/dashboard/feed.scss";

const Explore = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const [feed, setFeed] = useState({ announcements: [], following: [], popular: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState(null);
    const [savingId, setSavingId] = useState(null);

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

    const handleSave = useCallback(
        async (set) => {
            if (!isAuthenticated) {
                navigate("/signin");
                return;
            }
            setSavingId(set.id);
            setNotice(null);
            try {
                await setService.saveExternalSet(set.slug);
                setNotice({ kind: "success", text: `Сет «${set.title}» сохранён в вашу библиотеку` });
            } catch (err) {
                setNotice({ kind: "error", text: parseApiError(err).message });
            } finally {
                setSavingId(null);
            }
        },
        [isAuthenticated, navigate]
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

            {notice && (
                <div
                    className={`alert${notice.kind === "error" ? " alertError" : " alertSuccess"}`}
                    role="status"
                >
                    {notice.text}
                </div>
            )}
            {error && (
                <div className="alert alertError" role="alert">
                    {error}
                </div>
            )}
            {loading && <p className="mutedText">Загружаем ленту…</p>}

            {!loading && !error && (
                <>
                    {feed.announcements.length > 0 && (
                        <section className="feedSection">
                            <h2 className="feedSectionTitle">Новости проекта</h2>
                            {feed.announcements.map((item) => (
                                <article className="announcement" key={item.id}>
                                    <h3 className="announcementTitle">{item.title}</h3>
                                    <MarkdownContent className="announcementBody" content={item.body} />
                                    <span className="announcementDate">{item.date_posted}</span>
                                </article>
                            ))}
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
                            <p className="feedEmpty">
                                {isAuthenticated
                                    ? "Подпишитесь на авторов — их новые сеты появятся здесь."
                                    : "Войдите и подпишитесь на авторов, чтобы следить за их новыми сетами."}
                            </p>
                        )}
                    </section>

                    <section className="feedSection">
                        <h2 className="feedSectionTitle">Популярные за неделю</h2>
                        {feed.popular.length > 0 ? (
                            <div className="setGrid">{feed.popular.map(renderCard)}</div>
                        ) : (
                            <p className="feedEmpty">Пока нет популярных сетов за последнюю неделю.</p>
                        )}
                    </section>
                </>
            )}
        </section>
    );
};

export default Explore;

