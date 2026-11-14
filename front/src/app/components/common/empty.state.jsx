import React from "react";

const EmptyState = ({ variant = "block", icon, title, hint, action, className = "" }) => {
    const extra = className ? ` ${className}` : "";

    if (variant === "inline") {
        return <p className={`emptyStateInline mutedText${extra}`}>{title}</p>;
    }

    return (
        <div className={`emptyState${extra}`}>
            {icon && (
                <span className="emptyStateIcon" aria-hidden="true">
                    {icon}
                </span>
            )}
            {title && <h2>{title}</h2>}
            {hint && <p className="mutedText">{hint}</p>}
            {action}
        </div>
    );
};

export default EmptyState;
