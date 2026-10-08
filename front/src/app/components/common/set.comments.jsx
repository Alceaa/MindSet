import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Avatar from "@mui/material/Avatar";
import socialService from "../../api/social.service";
import parseApiError from "../../utils/api.error";
import { useAuth } from "../../context/auth.context";

const initialOf = (login) => (login ? login.trim().charAt(0).toUpperCase() : "?");

const SetComments = ({ slug }) => {
    const { isAuthenticated, user } = useAuth();
    const navigate = useNavigate();
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [body, setBody] = useState("");
    const [sending, setSending] = useState(false);
    const [busyId, setBusyId] = useState(null);

    const load = useCallback(() => {
        setLoading(true);
        setError("");
        socialService
            .getComments(slug)
            .then((data) => setComments(data.comments ?? []))
            .catch((err) => setError(parseApiError(err).message))
            .finally(() => setLoading(false));
    }, [slug]);

    useEffect(() => {
        load();
    }, [load]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!isAuthenticated) {
            navigate("/signin");
            return;
        }
        const text = body.trim();
        if (!text) {
            return;
        }
        setSending(true);
        setError("");
        try {
            await socialService.createComment(slug, text);
            setBody("");
            await load();
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setSending(false);
        }
    };

    const handleDelete = async (id) => {
        setBusyId(id);
        setError("");
        try {
            await socialService.deleteComment(id);
            await load();
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <section className="commentsSection">
            <h2 className="commentsTitle">Комментарии ({comments.length})</h2>

            {isAuthenticated ? (
                <form className="commentForm" onSubmit={handleSubmit}>
                    <textarea
                        className="commentInput"
                        value={body}
                        onChange={(event) => setBody(event.target.value)}
                        placeholder="Написать комментарий…"
                        maxLength={2000}
                    />
                    <div className="commentActions">
                        <button
                            className="btn btnPrimary btnSmall"
                            type="submit"
                            disabled={sending || !body.trim()}
                        >
                            {sending ? "Отправляем…" : "Отправить"}
                        </button>
                    </div>
                </form>
            ) : (
                <p className="mutedText">
                    <Link className="link" to="/signin">
                        Войдите
                    </Link>
                    , чтобы оставить комментарий.
                </p>
            )}

            {error && <p className="errorText">{error}</p>}

            {loading ? (
                <p className="mutedText">Загружаем комментарии…</p>
            ) : (
                <div className="commentList">
                    {comments.map((comment) => (
                        <div className="comment" key={comment.id}>
                            <div className="commentHead">
                                <span className="commentAuthor">
                                    <Avatar
                                        src={comment.avatar || undefined}
                                        sx={{ width: 24, height: 24, fontSize: 12 }}
                                    >
                                        {initialOf(comment.login)}
                                    </Avatar>
                                    <Link to={`/u/${comment.login}`}>{comment.login}</Link>
                                </span>
                                <span className="commentDate">{comment.date_created}</span>
                            </div>
                            <p className="commentBody">{comment.body}</p>
                            {user && comment.user_id === user.id && (
                                <button
                                    className="commentDelete"
                                    type="button"
                                    onClick={() => handleDelete(comment.id)}
                                    disabled={busyId === comment.id}
                                >
                                    Удалить
                                </button>
                            )}
                        </div>
                    ))}
                    {comments.length === 0 && <p className="mutedText">Комментариев пока нет.</p>}
                </div>
            )}
        </section>
    );
};

export default SetComments;
