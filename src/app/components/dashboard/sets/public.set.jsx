import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import setService from "../../../api/set.service";
import socialService from "../../../api/social.service";
import parseApiError from "../../../utils/api.error";
import { useAuth } from "../../../context/auth.context";
import LoadingScreen from "../../common/loading.screen.jsx";
import SetArticle from "./set.article.jsx";
import SetComments from "../../common/set.comments.jsx";
import useReaderSettings, {
    READER_DEFAULTS,
} from "../../../hooks/use.reader.settings";
import "../../../css/dashboard/reader.scss";
import "../../../css/dashboard/article.scss";
import "../../../css/dashboard/feed.scss";

const PublicSet = () => {
    const { slug } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, user } = useAuth();
    const [set, setSet] = useState(null);
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [liked, setLiked] = useState(false);
    const [likes, setLikes] = useState(0);
    const [likeBusy, setLikeBusy] = useState(false);

    const { settings } = useReaderSettings();
    const readerView = useMemo(() => ({ ...READER_DEFAULTS, ...settings }), [settings]);

    useEffect(() => {
        let cancelled = false;

        setLoading(true);
        setError("");
        setSet(null);
        setLinks([]);

        setService
            .getPublicSet(slug)
            .then((data) => {
                if (!cancelled) {
                    setSet(data.set);
                    setLinks(data.links ?? []);
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

        socialService
            .getLikes(slug)
            .then((data) => {
                if (!cancelled) {
                    setLiked(data.liked);
                    setLikes(data.count);
                }
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [slug]);

    const handleLike = async () => {
        if (!isAuthenticated) {
            navigate("/signin");
            return;
        }
        setLikeBusy(true);
        try {
            const data = liked
                ? await socialService.unlikeSet(slug)
                : await socialService.likeSet(slug);
            setLiked(data.liked);
            setLikes(data.count);
        } catch {
        } finally {
            setLikeBusy(false);
        }
    };

    if (loading) {
        return <LoadingScreen label="Загружаем страницу..." />;
    }

    if (error || !set) {
        return (
            <div className="publicPage">
                <div className="publicMessage">
                    <h1 className="publicMessageTitle">Страница недоступна</h1>
                    <p className="mutedText">
                        {error || "Возможно, автор сделал этот сет приватным или удалил его."}
                    </p>
                    <Link className="btn btnGhost" to="/dashboard">
                        На главную
                    </Link>
                </div>
            </div>
        );
    }

    const isOwn =
        Boolean(set.author) && Boolean(user) && set.author.login === user.login;

    return (
        <div className="publicPage">
            <div className="readerShell">
                <div className="readerBar">
                    <Link className="readerBack" to="/explore">
                        ← Обзор
                    </Link>
                    {!isOwn && (
                        <button
                            type="button"
                            className={`likeBtn${liked ? " likeBtnActive" : ""}`}
                            onClick={handleLike}
                            disabled={likeBusy}
                            aria-pressed={liked}
                        >
                            <span aria-hidden="true">{liked ? "♥" : "♡"}</span> {likes}
                        </button>
                    )}
                </div>

                <article
                    className="articleCard"
                    data-reader-theme={readerView.theme}
                    data-reader-width={readerView.width}
                    data-reader-font={readerView.font}
                    data-reader-scale={readerView.scale}
                >
                    <header className="articleHead">
                        <h1 className="articleTitle">{set.title}</h1>
                        <div className="articleMeta">
                            {set.author && (
                                <span>
                                    автор{" "}
                                    <Link to={`/u/${set.author.login}`}>{set.author.login}</Link>
                                </span>
                            )}
                            <span>создан {set.date_created}</span>
                            <span>изменён {set.last_activity}</span>
                        </div>
                    </header>
                    <SetArticle
                        content={set.content}
                        links={links}
                        emptyText="В этом сете пока нет содержимого."
                    />
                </article>

                <SetComments slug={slug} />
            </div>
        </div>
    );
};

export default PublicSet;
