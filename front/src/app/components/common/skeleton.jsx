import React from "react";
import "../../css/common/skeleton.scss";

const SHAPES = {
    text: ["full", "short"],
    card: ["title", "full", "short"],
    row: ["title", "short"],
    article: ["title", "full", "full", "short"],
};

const shapeFor = (variant) => SHAPES[variant] ?? SHAPES.text;

export const Skeleton = ({ variant = "text", count = 1, className = "", label = "Загружаем…" }) => {
    const classes = ["skeleton", `skeleton-${variant}`, className].filter(Boolean).join(" ");
    const items = Array.from({ length: count }, (_, index) => index);

    return (
        <div className={classes} role="status" aria-label={label}>
            <div className="skeletonBody" aria-hidden="true">
                {items.map((index) => (
                    <div className="skeletonItem" key={index}>
                        {shapeFor(variant).map((size, lineIndex) => (
                            <span
                                className={`skeletonLine skeletonLine-${size}`}
                                key={lineIndex}
                            />
                        ))}
                    </div>
                ))}
            </div>
        </div>
    );
};

export const SkeletonWorkspace = ({ label = "Загружаем сет…" }) => (
    <div className="skeletonWorkspace">
        <aside className="skeletonSidebar" aria-hidden="true">
            <span className="skeletonLine skeletonLine-title" />
            <span className="skeletonLine" />
            <span className="skeletonLine skeletonLine-short" />
            <span className="skeletonLine" />
            <span className="skeletonLine skeletonLine-short" />
            <span className="skeletonLine" />
        </aside>
        <div className="skeletonMain">
            <Skeleton variant="article" label={label} />
        </div>
    </div>
);

export default Skeleton;
