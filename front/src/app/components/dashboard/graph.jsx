import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import setService from "../../api/set.service";
import parseApiError from "../../utils/api.error";
import "../../css/dashboard/graph.scss";

const WIDTH = 960;
const HEIGHT = 600;
const REPULSION = 5200;
const SPRING = 0.025;
const SPRING_LENGTH = 140;
const CENTER_PULL = 0.014;
const DAMPING = 0.85;
const ITERATIONS = 340;

const NODE_PADDING = 12;
const HOVER_GROWTH = 1.18;
const DRAG_GROWTH = 1.3;
const HOVER_PASSES = 26;
const DRAG_PASSES = 4;
const SETTLE_PASSES = 12;
const LERP = 0.28;

const MIN_SCALE = 0.35;
const MAX_SCALE = 3;

const setKey = (id) => `s${id}`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function buildNodes(graph) {
    return graph.nodes.map((node) => {
        const own = node.own !== false;
        const frozen = Boolean(node.frozen);
        const deleted = Boolean(node.deleted);
        const daysLeft = Number.isFinite(node.days_left) ? node.days_left : 0;
        const shares = `Связей: ${node.links} · Обратных: ${node.backlinks}`;

        let hint;
        if (own) {
            hint = `${shares} · Изменён: ${node.updated}`;
        } else if (deleted) {
            hint = `Сет @${node.login} удалён. Сохранённая копия хранится ещё ${daysLeft} дн., затем будет удалена. Откроется снимок.`;
        } else if (frozen) {
            hint = `Замороженный снимок @${node.login} · ${shares}`;
        } else {
            hint = `Внешний сет @${node.login} · ${shares}`;
        }

        return {
            key: setKey(node.id),
            id: node.id,
            title: node.title,
            own,
            frozen,
            deleted,
            daysLeft,
            slug: node.slug ?? "",
            login: node.login ?? "",
            snapshotId: node.snapshot_id ?? 0,
            radius: 10 + Math.min(node.links + node.backlinks, 8) * 1.8,
            hint,
        };
    });
}

function buildEdges(graph, nodes) {
    const existing = new Set(nodes.map((node) => node.key));

    return graph.edges
        .filter((edge) => existing.has(setKey(edge.from)) && existing.has(setKey(edge.to)))
        .map((edge) => ({
            key: `${edge.from}-${edge.to}`,
            from: setKey(edge.from),
            to: setKey(edge.to),
            oneSided: edge.one_sided,
        }));
}

function collisionRadius(node, growth = 1) {
    const labelWidth = Math.min(node.title.length, 22) * 6.6;
    return (node.radius + Math.max(labelWidth / 2, 16) + NODE_PADDING) * growth;
}

function layout(nodes, edges) {
    const positions = new Map();
    const velocity = new Map();
    const orbit = Math.min(WIDTH, HEIGHT) * 0.36;

    nodes.forEach((node, index) => {
        const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2;
        positions.set(node.key, {
            x: WIDTH / 2 + Math.cos(angle) * orbit,
            y: HEIGHT / 2 + Math.sin(angle) * orbit,
        });
        velocity.set(node.key, { x: 0, y: 0 });
    });

    for (let step = 0; step < ITERATIONS; step += 1) {
        const forces = new Map();
        nodes.forEach((node) => forces.set(node.key, { x: 0, y: 0 }));

        for (let i = 0; i < nodes.length; i += 1) {
            for (let j = i + 1; j < nodes.length; j += 1) {
                const first = positions.get(nodes[i].key);
                const second = positions.get(nodes[j].key);

                let dx = first.x - second.x;
                let dy = first.y - second.y;
                let distance = Math.hypot(dx, dy);

                if (distance < 0.01) {
                    dx = (i - j) * 0.5 + 0.5;
                    dy = 0.5;
                    distance = Math.hypot(dx, dy);
                }

                const force = REPULSION / (distance * distance);
                const fx = (dx / distance) * force;
                const fy = (dy / distance) * force;

                forces.get(nodes[i].key).x += fx;
                forces.get(nodes[i].key).y += fy;
                forces.get(nodes[j].key).x -= fx;
                forces.get(nodes[j].key).y -= fy;
            }
        }

        edges.forEach((edge) => {
            const first = positions.get(edge.from);
            const second = positions.get(edge.to);
            if (!first || !second) {
                return;
            }

            const dx = second.x - first.x;
            const dy = second.y - first.y;
            const distance = Math.max(Math.hypot(dx, dy), 0.01);
            const force = (distance - SPRING_LENGTH) * SPRING;
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;

            forces.get(edge.from).x += fx;
            forces.get(edge.from).y += fy;
            forces.get(edge.to).x -= fx;
            forces.get(edge.to).y -= fy;
        });

        nodes.forEach((node) => {
            const position = positions.get(node.key);
            const force = forces.get(node.key);
            const speed = velocity.get(node.key);

            force.x += (WIDTH / 2 - position.x) * CENTER_PULL;
            force.y += (HEIGHT / 2 - position.y) * CENTER_PULL;

            speed.x = (speed.x + force.x) * DAMPING;
            speed.y = (speed.y + force.y) * DAMPING;

            position.x = clamp(position.x + speed.x, 60, WIDTH - 60);
            position.y = clamp(position.y + speed.y, 50, HEIGHT - 50);
        });
    }

    const result = {};
    nodes.forEach((node) => {
        result[node.key] = positions.get(node.key);
    });
    return result;
}

function resolveCollisions(positions, nodes, options) {
    const working = new Map();
    nodes.forEach((node) => {
        const position = positions[node.key];
        working.set(node.key, { x: position.x, y: position.y });
    });

    for (let pass = 0; pass < options.passes; pass += 1) {
        for (let i = 0; i < nodes.length; i += 1) {
            for (let j = i + 1; j < nodes.length; j += 1) {
                const firstNode = nodes[i];
                const secondNode = nodes[j];
                const first = working.get(firstNode.key);
                const second = working.get(secondNode.key);

                let dx = second.x - first.x;
                let dy = second.y - first.y;
                let distance = Math.hypot(dx, dy);

                if (distance < 0.01) {
                    dx = 0.5;
                    dy = 0.5;
                    distance = Math.hypot(dx, dy);
                }

                const minDistance = options.radius(firstNode) + options.radius(secondNode);
                if (distance >= minDistance) {
                    continue;
                }

                const shift = (minDistance - distance) / 2;
                const ux = dx / distance;
                const uy = dy / distance;

                first.x -= ux * shift;
                first.y -= uy * shift;
                second.x += ux * shift;
                second.y += uy * shift;
            }
        }

        nodes.forEach((node) => {
            const position = working.get(node.key);
            const anchor = options.anchor[node.key] ?? position;

            position.x += (anchor.x - position.x) * 0.05;
            position.y += (anchor.y - position.y) * 0.05;
            position.x = clamp(position.x, 60, WIDTH - 60);
            position.y = clamp(position.y, 50, HEIGHT - 50);
        });
    }

    return working;
}

const Graph = () => {
    const navigate = useNavigate();
    const svgRef = useRef(null);
    const panning = useRef(null);
    const dragged = useRef(false);
    const draggingRef = useRef(null);
    const restRef = useRef({});
    const displayRef = useRef({});
    const frameRef = useRef(0);

    const [graph, setGraph] = useState({ nodes: [], edges: [] });
    const [positions, setPositions] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [activeKey, setActiveKey] = useState(null);
    const [dragging, setDragging] = useState(null);
    const [view, setView] = useState({ scale: 1, x: 0, y: 0 });

    const nodes = useMemo(() => buildNodes(graph), [graph]);
    const edges = useMemo(() => buildEdges(graph, nodes), [graph, nodes]);

    const neighbors = useMemo(() => {
        const map = new Map();
        edges.forEach((edge) => {
            if (!map.has(edge.from)) {
                map.set(edge.from, new Set());
            }
            if (!map.has(edge.to)) {
                map.set(edge.to, new Set());
            }
            map.get(edge.from).add(edge.to);
            map.get(edge.to).add(edge.from);
        });
        return map;
    }, [edges]);

    const settle = useCallback((next) => {
        displayRef.current = next;
        setPositions(next);
    }, []);

    const animateTo = useCallback((targets, snapKeys = []) => {
        cancelAnimationFrame(frameRef.current);

        const step = () => {
            const current = displayRef.current;
            const next = {};
            let finished = true;

            targets.forEach((to, key) => {
                const from = current[key] ?? to;
                const snap = snapKeys.includes(key);

                const x = snap ? to.x : from.x + (to.x - from.x) * LERP;
                const y = snap ? to.y : from.y + (to.y - from.y) * LERP;

                if (!snap && (Math.abs(to.x - x) > 0.4 || Math.abs(to.y - y) > 0.4)) {
                    finished = false;
                }

                next[key] = { x, y };
            });

            displayRef.current = next;
            setPositions(next);

            if (!finished) {
                frameRef.current = requestAnimationFrame(step);
            }
        };

        frameRef.current = requestAnimationFrame(step);
    }, []);

    useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

    const relax = useCallback(
        (pinnedKey) => {
            const targets = resolveCollisions(restRef.current, nodes, {
                passes: pinnedKey ? HOVER_PASSES : SETTLE_PASSES,
                anchor: restRef.current,
                radius: (node) => collisionRadius(node, node.key === pinnedKey ? HOVER_GROWTH : 1),
            });

            if (pinnedKey && targets.has(pinnedKey)) {
                targets.set(pinnedKey, { ...restRef.current[pinnedKey] });
            }

            animateTo(targets);
        },
        [nodes, animateTo]
    );

    const applyData = useCallback(
        (data) => {
            const loadedNodes = buildNodes(data);
            const loadedEdges = buildEdges(data, loadedNodes);

            const base = layout(loadedNodes, loadedEdges);
            const settled = resolveCollisions(base, loadedNodes, {
                passes: SETTLE_PASSES,
                anchor: base,
                radius: (node) => collisionRadius(node),
            });

            const snapshot = {};
            settled.forEach((position, key) => {
                snapshot[key] = { x: position.x, y: position.y };
            });

            restRef.current = snapshot;
            settle(snapshot);
            setGraph(data);
            setView({ scale: 1, x: 0, y: 0 });
        },
        [settle]
    );

    const load = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            applyData(await setService.getGraph());
        } catch (err) {
            setError(parseApiError(err).message);
        } finally {
            setLoading(false);
        }
    }, [applyData]);

    const resetView = useCallback(() => {
        setView({ scale: 1, x: 0, y: 0 });
        animateTo(new Map(Object.entries(restRef.current)));
    }, [animateTo]);

    useEffect(() => {
        load();
    }, [load]);

    useEffect(() => {
        if (nodes.length === 0 || draggingRef.current) {
            return;
        }
        relax(activeKey);
    }, [activeKey, nodes, relax]);

    const toCanvasPoint = (event) => {
        const rect = svgRef.current.getBoundingClientRect();
        return {
            px: ((event.clientX - rect.left) / rect.width) * WIDTH,
            py: ((event.clientY - rect.top) / rect.height) * HEIGHT,
        };
    };

    const toGraphPoint = (event) => {
        const point = toCanvasPoint(event);
        return {
            x: (point.px - view.x) / view.scale,
            y: (point.py - view.y) / view.scale,
        };
    };

    useEffect(() => {
        const element = svgRef.current;
        if (!element) {
            return undefined;
        }

        const handleWheel = (event) => {
            event.preventDefault();
            const rect = element.getBoundingClientRect();
            const px = ((event.clientX - rect.left) / rect.width) * WIDTH;
            const py = ((event.clientY - rect.top) / rect.height) * HEIGHT;

            setView((current) => {
                const nextScale = clamp(current.scale * (1 - event.deltaY * 0.0015), MIN_SCALE, MAX_SCALE);
                const ratio = nextScale / current.scale;
                return {
                    scale: nextScale,
                    x: px - (px - current.x) * ratio,
                    y: py - (py - current.y) * ratio,
                };
            });
        };

        element.addEventListener("wheel", handleWheel, { passive: false });
        return () => element.removeEventListener("wheel", handleWheel);
    }, []);

    const nodeMouseDown = (event, key) => {
        event.preventDefault();
        event.stopPropagation();

        const point = toGraphPoint(event);
        dragged.current = false;
        draggingRef.current = true;
        setDragging({
            key,
            offsetX: (positions[key]?.x ?? point.x) - point.x,
            offsetY: (positions[key]?.y ?? point.y) - point.y,
        });
    };

    const canvasMouseMove = (event) => {
        if (dragging) {
            const point = toGraphPoint(event);
            const nextPoint = {
                x: clamp(point.x + dragging.offsetX, 40, WIDTH - 40),
                y: clamp(point.y + dragging.offsetY, 40, HEIGHT - 40),
            };

            dragged.current = true;

            const base = { ...displayRef.current };
            base[dragging.key] = nextPoint;

            const targets = resolveCollisions(base, nodes, {
                passes: DRAG_PASSES,
                anchor: base,
                radius: (node) =>
                    collisionRadius(node, node.key === dragging.key ? DRAG_GROWTH : 1),
            });
            targets.set(dragging.key, nextPoint);

            animateTo(targets, [dragging.key]);
            return;
        }

        const pan = panning.current;
        if (pan) {
            const point = toCanvasPoint(event);
            setView((current) => ({
                ...current,
                x: pan.viewX + (point.px - pan.px),
                y: pan.viewY + (point.py - pan.py),
            }));
        }
    };

    const canvasMouseUp = () => {
        if (dragging) {
            draggingRef.current = false;
            setDragging(null);

            const snapshot = {};
            Object.entries(displayRef.current).forEach(([nodeKey, position]) => {
                snapshot[nodeKey] = { x: position.x, y: position.y };
            });
            restRef.current = snapshot;
            settle(snapshot);
        }
        panning.current = null;
    };

    const backgroundMouseDown = (event) => {
        const point = toCanvasPoint(event);
        panning.current = { px: point.px, py: point.py, viewX: view.x, viewY: view.y };
    };

    const nodeClick = (node) => {
        if (dragged.current) {
            dragged.current = false;
            return;
        }
        if (node.own) {
            navigate(`/sets/${node.id}`);
            return;
        }
        if (node.snapshotId > 0) {
            navigate(`/snapshots/${node.snapshotId}`);
            return;
        }
        if (node.slug) {
            navigate(`/s/${node.slug}`);
        }
    };

    const ownCount = graph.nodes.filter((node) => node.own !== false).length;
    const externalCount = graph.nodes.length - ownCount;
    const isolated = graph.nodes.filter((node) => node.links + node.backlinks === 0).length;
    const oneSidedCount = graph.edges.filter((edge) => edge.one_sided).length;

    const nodeClassName = (node) => {
        const classes = ["graphNode"];
        if (node.own) {
            classes.push("graphNodeSet");
        } else if (node.deleted) {
            classes.push("graphNodeDeleted");
        } else if (node.frozen) {
            classes.push("graphNodeFrozen");
        } else {
            classes.push("graphNodeExternal");
        }
        if (activeKey) {
            if (node.key === activeKey) {
                classes.push("graphNodeActive");
            } else if (neighbors.get(activeKey)?.has(node.key)) {
                classes.push("graphNodeNeighbor");
            } else {
                classes.push("graphNodeDim");
            }
        }
        return classes.join(" ");
    };

    const edgeClassName = (edge) => {
        const classes = ["graphEdge", edge.oneSided ? "graphEdgeOneSided" : "graphEdgeSolid"];
        if (activeKey && (edge.from === activeKey || edge.to === activeKey)) {
            classes.push("graphEdgeActive");
        }
        return classes.join(" ");
    };

    const shorten = (value, limit = 22) =>
        value.length > limit ? `${value.slice(0, limit - 1)}…` : value;

    if (loading) {
        return <p className="mutedText">Строим граф связей...</p>;
    }

    if (error) {
        return (
            <div className="alert alertError" role="alert">
                {error}
                <button className="btn btnGhost btnSmall" onClick={load}>
                    Повторить
                </button>
            </div>
        );
    }

    if (graph.nodes.length === 0) {
        return (
            <div className="emptyState">
                <h2>Граф пока пуст</h2>
                <p className="mutedText">
                    Создайте сет и добавьте в него ссылку вида [[Название сета]] — на графе
                    появится связь.
                </p>
                <button className="btn btnPrimary" onClick={() => navigate("/sets/new")}>
                    Создать сет
                </button>
            </div>
        );
    }

    return (
        <div className="graphPanel">
            <div className="graphToolbar">
                <span className="badge">Своих сетов: {ownCount}</span>
                {externalCount > 0 && (
                    <span className="badge">
                        <span className="oneSidedMark">◇</span>
                        Внешних: {externalCount}
                    </span>
                )}
                <span className="badge">Связей: {graph.edges.length}</span>
                {oneSidedCount > 0 && (
                    <span className="badge">
                        <span className="oneSidedMark">→</span>
                        Односторонних: {oneSidedCount}
                    </span>
                )}
                {isolated > 0 && <span className="badge">Без связей: {isolated}</span>}
                <div className="graphActions">
                    <button
                        className="btn btnGhost btnSmall"
                        onClick={resetView}
                    >
                        Сбросить вид
                    </button>
                    <button
                        className="btn btnGhost btnSmall"
                        onClick={load}
                    >
                        Обновить
                    </button>
                </div>
            </div>

            <svg
                ref={svgRef}
                className="graphCanvas"
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                onMouseMove={canvasMouseMove}
                onMouseUp={canvasMouseUp}
                onMouseLeave={canvasMouseUp}
            >
                <defs>
                    <marker
                        id="graphArrow"
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="7"
                        markerHeight="7"
                        orient="auto-start-reverse"
                    >
                        <path d="M 0 0 L 10 5 L 0 10 z" className="graphArrowHead" />
                    </marker>
                </defs>

                <rect
                    className="graphBackground"
                    x="0"
                    y="0"
                    width={WIDTH}
                    height={HEIGHT}
                    onMouseDown={backgroundMouseDown}
                />

                <g transform={`translate(${view.x}, ${view.y}) scale(${view.scale})`}>
                    {edges.map((edge) => {
                        const from = positions[edge.from];
                        const to = positions[edge.to];
                        if (!from || !to) {
                            return null;
                        }

                        let x2 = to.x;
                        let y2 = to.y;

                        if (edge.oneSided) {
                            const target = nodes.find((node) => node.key === edge.to);
                            const gap = (target?.radius ?? 10) + 5;
                            const dx = to.x - from.x;
                            const dy = to.y - from.y;
                            const distance = Math.hypot(dx, dy) || 1;
                            x2 = to.x - (dx / distance) * gap;
                            y2 = to.y - (dy / distance) * gap;
                        }

                        return (
                            <line
                                key={edge.key}
                                className={edgeClassName(edge)}
                                x1={from.x}
                                y1={from.y}
                                x2={x2}
                                y2={y2}
                                markerEnd={edge.oneSided ? "url(#graphArrow)" : undefined}
                            />
                        );
                    })}

                    {nodes.map((node) => {
                        const position = positions[node.key];
                        if (!position) {
                            return null;
                        }
                        return (
                            <g
                                key={node.key}
                                className={nodeClassName(node)}
                                transform={`translate(${position.x}, ${position.y})`}
                                onMouseDown={(event) => nodeMouseDown(event, node.key)}
                                onClick={() => nodeClick(node)}
                                onMouseEnter={() => setActiveKey(node.key)}
                                onMouseLeave={() => setActiveKey(null)}
                            >
                                <title>{node.hint}</title>
                                <circle r={node.radius} />
                                <text y={node.radius + 15} textAnchor="middle">
                                    {shorten(node.title)}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>

            <p className="graphHint">
                Клик по кругу — открыть сет, перетаскивание — подвинуть (узлы расступаются),
                колесо — зум, фон — сдвинуть граф. Сплошная линия — взаимные ссылки, стрелка —
                односторонняя: сет ссылается на соседа, но на него не ссылаются. Золотой пунктирный
                круг — чужой публичный сет; бирюзовый — замороженный снимок; серый пунктир — сет
                удалён, сохранённая копия ещё хранится (наведите, чтобы узнать срок).
            </p>
        </div>
    );
};

export default Graph;
