import React from "react";
import { Link } from "react-router-dom";

const NotFound = () => (
    <div className="statusPage">
        <div className="statusCard">
            <span className="statusCode">404</span>
            <h1>Страница не найдена</h1>
            <p>Возможно, ссылка устарела или вы перешли по неверному адресу.</p>
            <Link className="btn btnPrimary" to="/">
                На главную
            </Link>
        </div>
    </div>
);

export default NotFound;
