import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Avatar from "@mui/material/Avatar";
import ReactMarkdown from "react-markdown";
import socialService from "../../api/social.service";
import { useAuth } from "../../context/auth.context";
import { prepareMarkdown } from "../../markdown/wikilink";
import { remarkPlugins } from "../../markdown/render";

const initialOf = (login) => (login ? login.trim().charAt(0).toUpperCase() : "?");

const PREVIEW_LIMIT = 400;

const previewComponents = {
    a({ node, href, children, ...rest }) {
        if (typeof href === "string" && href.startsWith("wikilink:")) {
            return <span className="previewWikilink">{children}</span>;
        }
        const external = typeof href === "string" && /^https?:\/\//i.test(href);
        return (
            <a
                href={href}
                {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
                {...rest}
            >
                {children}
            </a>
        );
    },
};

const SetCard = ({
    set,
    to,
    showAuthor = true,
    likeable = true,
    own = false,
    onSave,
    saveLabel = "Сохранить",
    saving = false,
}) => {
    const { isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [liked, setLiked] = useState(Boolean(set.is_liked));
    const [likes, setLikes] = useState(set.likes_count ?? 0);
    const [busy, setBusy] = useState(false);

    const target = to || `/s/${set.slug}`;
    const previewMd = useMemo(() => {
        if (!set.preview) {
            return "";
        }

        // Превью — текстовое: HTML редактора (картинки) не рисуем, только убираем.
        return prepareMarkdown(set.preview)
            .replace(/<[^>]*>/g, " ")
            .trim()
            .slice(0, PREVIEW_LIMIT);
    }, [set.preview]);

    const handleLike = async (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isAuthenticated) {
            navigate("/signin");
            return;
        }
        setBusy(true);
        try {
            const data = liked
                ? await socialService.unlikeSet(set.slug)
                : await socialService.likeSet(set.slug);
            setLiked(data.liked);
            setLikes(data.count);
        } catch {
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className={`setCard${own ? " setCardOwn" : ""}`}>
            <Link className="setCardMain" to={target}>
                <h3 className="setTitle">{set.title}</h3>
                {previewMd ? (
                    <div className="setPreviewRich">
                        <ReactMarkdown
                            remarkPlugins={remarkPlugins}
                            components={previewComponents}
                            transformLinkUri={(uri) => uri}
                        >
                            {previewMd}
                        </ReactMarkdown>
                    </div>
                ) : set.description ? (
                    <p className="setPreview">{set.description}</p>
                ) : null}
            </Link>

            <div className="setMeta">
                <span className="setAuthor">
                    {showAuthor && set.author ? (
                        <>
                            <Avatar
                                src={set.author.avatar || undefined}
                                sx={{ width: 18, height: 18, fontSize: 10 }}
                            >
                                {initialOf(set.author.login)}
                            </Avatar>
                            <Link
                                className="setAuthorName"
                                to={`/u/${set.author.login}`}
                                onClick={(event) => event.stopPropagation()}
                            >
                                {set.author.login}
                            </Link>
                        </>
                    ) : null}
                    <span className="listMeta">изменён {set.last_activity}</span>
                </span>
            </div>

            {(likeable || onSave) && (
                <div className="setActions">
                    {likeable && (
                        <>
                            {!own && (
                                <button
                                    type="button"
                                    className={`likeBtn${liked ? " likeBtnActive" : ""}`}
                                    onClick={handleLike}
                                    disabled={busy}
                                    aria-pressed={liked}
                                    aria-label={liked ? "Убрать лайк" : "Поставить лайк"}
                                >
                                    <span aria-hidden="true">{liked ? "♥" : "♡"}</span> {likes}
                                </button>
                            )}
                            <span className="statChip" title="Комментарии">
                                <span aria-hidden="true">💬</span> {set.comments_count ?? 0}
                            </span>
                        </>
                    )}
                    {onSave && (
                        <button
                            type="button"
                            className="btn btnGhost btnSmall"
                            onClick={(event) => {
                                event.stopPropagation();
                                onSave(set);
                            }}
                            disabled={saving}
                        >
                            {saving ? "Сохраняем…" : saveLabel}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default SetCard;
