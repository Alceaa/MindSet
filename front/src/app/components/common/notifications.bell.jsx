import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import notificationsService from "../../api/notifications.service";
import parseApiError from "../../utils/api.error";
import { formatRelativeTime } from "../../utils/relative.time";

const linkFor = (item) => {
    switch (item.kind) {
        case "new_follower":
            return item.actor_login ? `/u/${item.actor_login}` : "";
        case "set_like":
        case "set_comment":
            return item.set_slug ? `/s/${item.set_slug}` : "/dashboard?tab=sets";
        case "invite_used":
            return "/admin";
        case "set_removed":
            return "/dashboard?tab=sets";
        default:
            return "";
    }
};

// Ссылка на сам сет: у публичных и «по ссылке» есть адрес, у остальных — внутренняя страница.
const setLinkFor = (item) => (item.set_slug ? `/s/${item.set_slug}` : "");

const NotificationsBell = ({ unread, onUnread }) => {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const rootRef = useRef(null);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        let cancelled = false;
        setLoading(true);
        setError("");

        notificationsService
            .list({ limit: 20 })
            .then((data) => {
                if (cancelled) {
                    return;
                }
                setItems(data.notifications ?? []);
                onUnread(data.unread ?? 0);
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
    }, [open, onUnread]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleDown = (event) => {
            if (!rootRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };
        const handleKey = (event) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };

        document.addEventListener("mousedown", handleDown);
        document.addEventListener("keydown", handleKey);

        return () => {
            document.removeEventListener("mousedown", handleDown);
            document.removeEventListener("keydown", handleKey);
        };
    }, [open]);

    const markRead = useCallback(
        async (item) => {
            if (item.read_at) {
                return;
            }

            try {
                const data = await notificationsService.markRead(item.id);
                onUnread(data.unread ?? 0);
            } catch {
                // Прочитано в другой вкладке — переходу это не мешает.
            }
        },
        [onUnread]
    );

    const linkClick = (item) => (event) => {
        event.stopPropagation();
        markRead(item);
    };

    // Ники и названия сетов кликабельны: ник ведёт в профиль, название — в сам сет.
    const actorNode = (item) =>
        item.actor_login ? (
            <Link
                className="notificationsActor"
                to={`/u/${item.actor_login}`}
                onClick={linkClick(item)}
            >
                {item.actor_login}
            </Link>
        ) : null;

    const setNode = (item) => {
        const to = setLinkFor(item);

        if (!to) {
            return <span className="notificationsSet">«{item.set_title}»</span>;
        }

        return (
            <Link className="notificationsSet" to={to} onClick={linkClick(item)}>
                «{item.set_title}»
            </Link>
        );
    };

    // Формулировки без рода: логин не говорит, кто за ним, поэтому согласуем с «сетом»
    // или «пользователем».
    const describe = (item) => {
        switch (item.kind) {
            case "new_follower":
                return {
                    title: (
                        <>
                            У вас новый подписчик — {actorNode(item)}
                        </>
                    ),
                    hint: "",
                };
            case "set_like":
                return {
                    title: (
                        <>
                            Ваш сет {setNode(item)} понравился пользователю {actorNode(item)}
                        </>
                    ),
                    hint: item.count > 1 ? `всего лайков: ${item.count}` : "",
                };
            case "set_comment":
                return {
                    title: (
                        <>
                            Новый комментарий к сету {setNode(item)} от {actorNode(item)}
                        </>
                    ),
                    hint:
                        item.count > 1
                            ? `всего ${item.count}, последний: ${item.excerpt}`
                            : item.excerpt,
                };
            case "invite_used":
                return {
                    title: (
                        <>
                            По вашей ссылке зарегистрировался новый пользователь —{" "}
                            {actorNode(item)}
                        </>
                    ),
                    hint: "",
                };
            case "set_removed":
                return {
                    title: <>Ваш сет {setNode(item)} удалён администратором</>,
                    hint: "",
                };
            default:
                return { title: <>Уведомление</>, hint: "" };
        }
    };

    const handleSelect = useCallback(
        async (item) => {
            setOpen(false);
            await markRead(item);

            const link = linkFor(item);
            if (link) {
                navigate(link);
            }
        },
        [markRead, navigate]
    );

    const handleReadAll = useCallback(async () => {
        try {
            await notificationsService.markAllRead();
            setItems((current) =>
                current.map((item) => ({ ...item, read_at: item.read_at || "прочитано" }))
            );
            onUnread(0);
        } catch (err) {
            setError(parseApiError(err).message);
        }
    }, [onUnread]);

    return (
        <div className="notifications" ref={rootRef}>
            <button
                type="button"
                className="btn btnGhost btnSmall notificationsTrigger"
                onClick={() => setOpen((current) => !current)}
                aria-expanded={open}
                aria-label={unread > 0 ? `Уведомления: ${unread} новых` : "Уведомления"}
            >
                <span aria-hidden="true">🔔</span>
                {unread > 0 && (
                    <span className="notificationsBadge">{unread > 99 ? "99+" : unread}</span>
                )}
            </button>

            {open && (
                <div className="notificationsPopover" role="dialog" aria-label="Уведомления">
                    <div className="notificationsHead">
                        <span className="notificationsTitle">Уведомления</span>
                        {items.length > 0 && (
                            <button
                                type="button"
                                className="notificationsReadAll"
                                onClick={handleReadAll}
                            >
                                Прочитать все
                            </button>
                        )}
                    </div>

                    {error && <p className="notificationsError">{error}</p>}
                    {loading && <p className="notificationsEmpty mutedText">Загружаем…</p>}
                    {!loading && !error && items.length === 0 && (
                        <p className="notificationsEmpty mutedText">Пока ничего нового.</p>
                    )}

                    <ul className="notificationsList">
                        {items.map((item) => {
                            const text = describe(item);

                            return (
                                <li key={item.id}>
                                    <div
                                        className={`notificationsItem${
                                            item.read_at ? "" : " notificationsItemUnread"
                                        }`}
                                        onClick={() => handleSelect(item)}
                                    >
                                        <span className="notificationsItemTitle">
                                            {text.title}
                                            {item.count > 1 && (
                                                <span className="notificationsCount">
                                                    +{item.count - 1}
                                                </span>
                                            )}
                                        </span>
                                        {text.hint && (
                                            <span className="notificationsItemHint">{text.hint}</span>
                                        )}
                                        <span className="notificationsTime">
                                            {formatRelativeTime(item.created_at)}
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default NotificationsBell;
