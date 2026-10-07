import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import setService from "../../../api/set.service";
import parseApiError from "../../../utils/api.error";
import LoadingScreen from "../../common/loading.screen.jsx";
import SetArticle from "./set.article.jsx";
import useReaderSettings, {
    READER_DEFAULTS,
} from "../../../hooks/use.reader.settings";
import "../../../css/dashboard/reader.scss";
import "../../../css/dashboard/article.scss";

const PublicSet = () => {
    const { slug } = useParams();
    const [set, setSet] = useState(null);
    const [links, setLinks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

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
                if (cancelled) {
                    return;
                }
                const parsed = parseApiError(err);
                setError(parsed.message);
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [slug]);

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

    return (
        <div className="publicPage">
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
                        {set.author && <span>автор {set.author.login}</span>}
                        <span>создан {set.date_created}</span>
                        <span>изменён {set.last_activity}</span>
                    </div>
                </header>
                <SetArticle content={set.content} links={links} emptyText="В этом сете пока нет содержимого." />
            </article>
        </div>
    );
};

export default PublicSet;
