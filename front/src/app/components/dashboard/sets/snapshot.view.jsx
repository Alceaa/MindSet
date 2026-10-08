import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import setService from "../../../api/set.service";
import parseApiError from "../../../utils/api.error";
import { useAuth } from "../../../context/auth.context";
import LoadingScreen from "../../common/loading.screen.jsx";
import SetArticle from "./set.article.jsx";
import useReaderSettings, {
    READER_DEFAULTS,
} from "../../../hooks/use.reader.settings";
import "../../../css/dashboard/reader.scss";
import "../../../css/dashboard/article.scss";

const STATE_NOTICES = {
    source_gone: "Исходный сет удалён автором — показана сохранённая копия.",
    hidden: "Автор закрыл доступ к исходному сету. Тело снимка скрыто.",
    suppressed: "Автор отозвал доступ к этому снимку.",
    attention: "Автор изменил исходный сет после сохранения снимка.",
};

const BODY_WITHHELD_STATES = new Set(["hidden", "suppressed"]);

const stateLabel = (state) => {
    switch (state) {
        case "live":
            return "Актуален";
        case "frozen":
            return "Заморожен";
        case "attention":
            return "Требует внимания";
        case "source_gone":
            return "Источник удалён";
        case "hidden":
            return "Источник закрыт";
        case "suppressed":
            return "Доступ отозван";
        default:
            return state;
    }
};

const badgeClassFor = (state) => {
    if (state === "attention" || state === "hidden" || state === "suppressed") {
        return "badge badgeWarning";
    }
    if (state === "live") {
        return "badge badgeSuccess";
    }
    return "badge";
};

const SnapshotView = () => {
    const { id } = useParams();
    const { isAuthenticated } = useAuth();
    const [snapshot, setSnapshot] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const { settings } = useReaderSettings();
    const readerView = useMemo(() => ({ ...READER_DEFAULTS, ...settings }), [settings]);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            setLoading(true);
            setError("");
            setSnapshot(null);

            try {
                const data = await setService.getPublicSnapshot(id);
                if (!cancelled) {
                    setSnapshot(data.snapshot);
                }
            } catch (err) {
                if (err?.response?.status === 404 && isAuthenticated) {
                    try {
                        const own = await setService.getSavedSet(id);
                        if (!cancelled) {
                            setSnapshot(own.saved_item);
                        }
                    } catch (ownErr) {
                        if (!cancelled) {
                            setError(parseApiError(ownErr).message);
                        }
                    }
                } else if (!cancelled) {
                    setError(parseApiError(err).message);
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };
    }, [id, isAuthenticated]);

    if (loading) {
        return <LoadingScreen label="Загружаем снимок..." />;
    }

    if (error || !snapshot) {
        return (
            <div className="publicPage">
                <div className="publicMessage">
                    <h1 className="publicMessageTitle">Снимок недоступен</h1>
                    <p className="mutedText">
                        {error || "Возможно, автор отозвал доступ к этой копии."}
                    </p>
                    <Link className="btn btnGhost" to="/explore">
                        В обзор
                    </Link>
                </div>
            </div>
        );
    }

    const notice = STATE_NOTICES[snapshot.state];

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
                    <div className="articleMeta">
                        <span className="badge">снимок</span>
                        <span className={badgeClassFor(snapshot.state)}>
                            {stateLabel(snapshot.state)}
                        </span>
                    </div>
                    <h1 className="articleTitle">{snapshot.title}</h1>
                    <div className="articleMeta">
                        <span>
                            автор <Link to={`/u/${snapshot.source_login}`}>@{snapshot.source_login}</Link>
                        </span>
                        <span>сохранён {snapshot.date_saved}</span>
                        <span>обновлён {snapshot.last_update}</span>
                        {snapshot.live_last_activity && (
                            <span>изменён {snapshot.live_last_activity}</span>
                        )}
                    </div>
                </header>
                {notice && (
                    <div className="alert" role="status">
                        {notice}
                    </div>
                )}
                {snapshot.content ? (
                    <SetArticle content={snapshot.content} links={[]} />
                ) : (
                    <p className="mutedText">
                        {BODY_WITHHELD_STATES.has(snapshot.state)
                            ? "Тело снимка скрыто."
                            : "В этом снимке пока нет содержимого."}
                    </p>
                )}
            </article>
        </div>
    );
};

export default SnapshotView;
