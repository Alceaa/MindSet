import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import setService from "../../../api/set.service";
import parseApiError from "../../../utils/api.error";
import "../../../css/dashboard/dashboard.scss";

const DESCRIPTION_LIMIT = 250;

const CreateSet = () => {
    const navigate = useNavigate();

    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [fieldErrors, setFieldErrors] = useState({});
    const [error, setError] = useState("");
    const [pending, setPending] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError("");
        setFieldErrors({});
        setPending(true);

        try {
            const created = await setService.createSet({
                title: title,
                description: description,
                content: "",
            });
            navigate(`/sets/${created.set.id}`, { replace: true });
        } catch (err) {
            const parsed = parseApiError(err);
            setError(parsed.message);
            setFieldErrors(parsed.fieldErrors);
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="page">
            <div className="pageHead">
                <div>
                    <h1 className="pageTitle">Новый сет</h1>
                    <p className="pageSubtitle">Название и короткое описание заметки</p>
                </div>
                <Link className="btn btnGhost" to="/dashboard?tab=sets">
                    Отмена
                </Link>
            </div>

            <div className="card formCardInline">
                {error && (
                    <div className="alert alertError" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                    <label className="field">
                        <span className="fieldLabel">Название</span>
                        <input
                            className={`input${fieldErrors.title ? " inputInvalid" : ""}`}
                            name="title"
                            type="text"
                            value={title}
                            onChange={(event) => setTitle(event.target.value)}
                            placeholder="Например: Go — конкурентность"
                            maxLength={100}
                            autoFocus
                            required
                        />
                        {fieldErrors.title && <span className="fieldError">{fieldErrors.title}</span>}
                    </label>

                    <label className="field">
                        <span className="fieldLabel">
                            Описание <span className="mutedText">(не обязательно)</span>
                        </span>
                        <textarea
                            className={`input textarea${fieldErrors.description ? " inputInvalid" : ""}`}
                            name="description"
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            rows={4}
                            maxLength={DESCRIPTION_LIMIT}
                            placeholder="О чём этот сет"
                        />
                        <span className="fieldHint">
                            {description.length} / {DESCRIPTION_LIMIT}
                        </span>
                        {fieldErrors.description && (
                            <span className="fieldError">{fieldErrors.description}</span>
                        )}
                    </label>

                    <div className="formActions">
                        <button className="btn btnPrimary" type="submit" disabled={pending}>
                            {pending ? "Создаём..." : "Создать сет"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateSet;
