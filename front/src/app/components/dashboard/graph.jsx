import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import setService from "../../api/set.service";
import parseApiError from "../../utils/api.error";
import EmptyState from "../common/empty.state.jsx";
import "../../css/dashboard/graph.scss";

const REPULSION = 5200;
const SPRING = 0.025;
const SPRING_LENGTH = 140;
const CENTER_PULL = 0.014;
const DAMPING = 0.85;
const ITERATIONS = 340;
const DENSE_ITERATIONS = 220;

const NODE_PADDING = 12;
const DRAG_GROWTH = 1.3;
const DRAG_PASSES = 4;
// Порог перетаскивания узла в пикселях экрана: меньше — это клик, а не сдвиг.
const DRAG_THRESHOLD = 4;
const SETTLE_PASSES = 12;
const DENSE_SETTLE_PASSES = 24;
const LERP = 0.28;

const MIN_SCALE = 0.35;
const MAX_SCALE = 3;

const CANVAS_RATIO = 1.6;
const CANVAS_MIN_AREA = 960 * 600;
const CANVAS_AREA_PER_NODE = 2600;
const CANVAS_MAX_WIDTH = 6000;
const CANVAS_MARGIN = 30;

const DENSE_NODES = 80;
const GRID_MIN_CELL = 56;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const setKey = (id) => `s${id}`;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const canvasFor = (count) => {
    const area = Math.max(CANVAS_MIN_AREA, count * CANVAS_AREA_PER_NODE);
    const width = Math.min(CANVAS_MAX_WIDTH, Math.round(Math.sqrt(area * CANVAS_RATIO)));
    return { width, height: Math.round(width / CANVAS_RATIO) };
};

const isDense = (count) => count > DENSE_NODES;

const densityScale = (count) => clamp(Math.sqrt(DENSE_NODES / Math.max(count, 1)), 0.34, 1);

const nodeSpacing = (count, canvas) =>
    isDense(count)
        ? clamp(Math.sqrt((canvas.width * canvas.height * 0.6) / Math.max(count, 1)) / 2, 8, 26)
        : 0;

const gridCellSize = (count, canvas) =>
    Math.max(GRID_MIN_CELL, Math.sqrt((canvas.width * canvas.height) / Math.max(count, 1)));

const settlePasses = (count) => (isDense(count) ? DENSE_SETTLE_PASSES : SETTLE_PASSES);

const gridKey = (cx, cy) => cx * 100000 + cy;

function forEachNeighborPair(nodes, positions, canvas, visit) {
    const cell = gridCellSize(nodes.length, canvas);
    const buckets = new Map();

    nodes.forEach((node, index) => {
        const point = positions.get(node.key);
        if (!point) {
            return;
        }
        const key = gridKey(Math.floor(point.x / cell), Math.floor(point.y / cell));
        const entry = { index, point };
        const bucket = buckets.get(key);
        if (bucket) {
            bucket.push(entry);
        } else {
            buckets.set(key, [entry]);
        }
    });

    nodes.forEach((node, index) => {
        const point = positions.get(node.key);
        if (!point) {
            return;
        }
        const cx = Math.floor(point.x / cell);
        const cy = Math.floor(point.y / cell);

        for (let dx = -1; dx <= 1; dx += 1) {
            for (let dy = -1; dy <= 1; dy += 1) {
                const bucket = buckets.get(gridKey(cx + dx, cy + dy));
                if (!bucket) {
                    continue;
                }
                bucket.forEach((entry) => {
                    if (entry.index > index) {
                        visit(index, entry.index, point, entry.point);
                    }
                });
            }
        }
    });
}

function buildNodes(graph) {
    const scale = densityScale(graph.nodes.length);

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
            radius: (10 + Math.min(node.links + node.backlinks, 8) * 1.8) * scale,
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

function collisionRadius(node, growth = 1, reserveLabel = true) {
    const label = reserveLabel
        ? Math.max((Math.min(node.title.length, 22) * 6.6) / 2, 16) + NODE_PADDING
        : 3;
    return (node.radius + label) * growth;
}

function radiusFor(count, canvas) {
    const spacing = nodeSpacing(count, canvas);

    return (node, growth = 1) =>
        spacing ? Math.max(spacing, node.radius + 3) * growth : collisionRadius(node, growth);
}

function initialPositions(nodes, canvas) {
    const positions = new Map();
    const { width, height } = canvas;

    nodes.forEach((node, index) => {
        const angle = index * GOLDEN_ANGLE;
        const radius = Math.sqrt((index + 0.5) / Math.max(nodes.length, 1));

        positions.set(node.key, {
            x: clamp(width / 2 + Math.cos(angle) * radius * width * 0.42, CANVAS_MARGIN, width - CANVAS_MARGIN),
            y: clamp(height / 2 + Math.sin(angle) * radius * height * 0.42, CANVAS_MARGIN, height - CANVAS_MARGIN),
        });
    });

    return positions;
}

function layout(nodes, edges, canvas) {
    const positions = initialPositions(nodes, canvas);
    const velocity = new Map();
    const dense = isDense(nodes.length);
    const steps = dense ? DENSE_ITERATIONS : ITERATIONS;
    const centerPull = dense ? CENTER_PULL * 0.2 : CENTER_PULL;

    nodes.forEach((node) => velocity.set(node.key, { x: 0, y: 0 }));

    for (let step = 0; step < steps; step += 1) {
        const forces = new Map();
        nodes.forEach((node) => forces.set(node.key, { x: 0, y: 0 }));

        const repel = (i, j, first, second) => {
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
        };

        if (dense) {
            forEachNeighborPair(nodes, positions, canvas, repel);
        } else {
            for (let i = 0; i < nodes.length; i += 1) {
                for (let j = i + 1; j < nodes.length; j += 1) {
                    repel(i, j, positions.get(nodes[i].key), positions.get(nodes[j].key));
                }
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

            force.x += (canvas.width / 2 - position.x) * centerPull;
            force.y += (canvas.height / 2 - position.y) * centerPull;

            speed.x = (speed.x + force.x) * DAMPING;
            speed.y = (speed.y + force.y) * DAMPING;

            position.x = clamp(position.x + speed.x, CANVAS_MARGIN, canvas.width - CANVAS_MARGIN);
            position.y = clamp(position.y + speed.y, CANVAS_MARGIN, canvas.height - CANVAS_MARGIN);
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

    const dense = isDense(nodes.length);
    const pull = options.anchorPull ?? 0.05;
    const { width, height } = options.canvas;

    for (let pass = 0; pass < options.passes; pass += 1) {
        const separate = (i, j, first, second) => {
            let dx = second.x - first.x;
            let dy = second.y - first.y;
            let distance = Math.hypot(dx, dy);

            if (distance < 0.01) {
                dx = 0.5;
                dy = 0.5;
                distance = Math.hypot(dx, dy);
            }

            const minDistance = options.radius(nodes[i]) + options.radius(nodes[j]);
            if (distance >= minDistance) {
                return;
            }

            const shift = (minDistance - distance) / 2;
            const ux = dx / distance;
            const uy = dy / distance;

            first.x -= ux * shift;
            first.y -= uy * shift;
            second.x += ux * shift;
            second.y += uy * shift;
        };

        if (dense) {
            forEachNeighborPair(nodes, working, options.canvas, separate);
        } else {
            for (let i = 0; i < nodes.length; i += 1) {
                for (let j = i + 1; j < nodes.length; j += 1) {
                    separate(i, j, working.get(nodes[i].key), working.get(nodes[j].key));
                }
            }
        }

        nodes.forEach((node) => {
            const position = working.get(node.key);
            const anchor = options.anchor[node.key] ?? position;

            position.x += (anchor.x - position.x) * pull;
            position.y += (anchor.y - position.y) * pull;
            position.x = clamp(position.x, CANVAS_MARGIN, width - CANVAS_MARGIN);
            position.y = clamp(position.y, CANVAS_MARGIN, height - CANVAS_MARGIN);
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
    const pointers = useRef(new Map());
    const pinch = useRef(null);

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

    const dense = isDense(nodes.length);
    const canvas = useMemo(() => canvasFor(nodes.length), [nodes.length]);

    const radiusOf = useMemo(() => radiusFor(nodes.length, canvas), [nodes.length, canvas]);

    const labeled = useMemo(() => {
        if (!dense) {
            return null;
        }
        const keys = new Set();
        if (activeKey) {
            keys.add(activeKey);
            neighbors.get(activeKey)?.forEach((key) => keys.add(key));
        }
        return keys;
    }, [dense, activeKey, neighbors]);

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

    const applyData = useCallback(
        (data) => {
            const loadedNodes = buildNodes(data);
            const loadedEdges = buildEdges(data, loadedNodes);
            const loadedCanvas = canvasFor(loadedNodes.length);

            const base = layout(loadedNodes, loadedEdges, loadedCanvas);
            const settled = resolveCollisions(base, loadedNodes, {
                passes: settlePasses(loadedNodes.length),
                anchor: base,
                anchorPull: isDense(loadedNodes.length) ? 0.02 : undefined,
                canvas: loadedCanvas,
                radius: radiusFor(loadedNodes.length, loadedCanvas),
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

    const toCanvasPoint = (event) => {
        const rect = svgRef.current.getBoundingClientRect();
        return {
            px: ((event.clientX - rect.left) / rect.width) * canvas.width,
            py: ((event.clientY - rect.top) / rect.height) * canvas.height,
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
            const px = ((event.clientX - rect.left) / rect.width) * canvas.width;
            const py = ((event.clientY - rect.top) / rect.height) * canvas.height;

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
    }, [canvas]);

    const zoomBy = (factor) => {
        setView((current) => {
            const nextScale = clamp(current.scale * factor, MIN_SCALE, MAX_SCALE);
            const ratio = nextScale / current.scale;
            const px = canvas.width / 2;
            const py = canvas.height / 2;
            return {
                scale: nextScale,
                x: px - (px - current.x) * ratio,
                y: py - (py - current.y) * ratio,
            };
        });
    };

    const capturePointer = (element, pointerId) => {
        if (!element || typeof element.setPointerCapture !== "function") {
            return;
        }
        try {
            element.setPointerCapture(pointerId);
        } catch (error) {
            return;
        }
    };

    const beginPinch = () => {
        if (pointers.current.size !== 2) {
            return;
        }

        const [first, second] = [...pointers.current.values()];
        draggingRef.current = false;
        setDragging(null);
        panning.current = null;
        pinch.current = {
            distance: Math.hypot(second.px - first.px, second.py - first.py) || 1,
            middlePx: (first.px + second.px) / 2,
            middlePy: (first.py + second.py) / 2,
            scale: view.scale,
            x: view.x,
            y: view.y,
        };
    };

    const applyPinch = () => {
        const start = pinch.current;
        const points = [...pointers.current.values()];
        if (!start || points.length < 2) {
            return false;
        }

        const [first, second] = points;
        const distance = Math.hypot(second.px - first.px, second.py - first.py) || 1;
        const middlePx = (first.px + second.px) / 2;
        const middlePy = (first.py + second.py) / 2;
        const nextScale = clamp(start.scale * (distance / start.distance), MIN_SCALE, MAX_SCALE);
        const ratio = nextScale / start.scale;

        setView({
            scale: nextScale,
            x: middlePx - (start.middlePx - start.x) * ratio,
            y: middlePy - (start.middlePy - start.y) * ratio,
        });
        return true;
    };

    const nodePointerDown = (event, key) => {
        event.preventDefault();

        const point = toGraphPoint(event);
        const pressed = toCanvasPoint(event);
        dragged.current = false;
        draggingRef.current = true;
        setDragging({
            key,
            offsetX: (positions[key]?.x ?? point.x) - point.x,
            offsetY: (positions[key]?.y ?? point.y) - point.y,
            pressPx: pressed.px,
            pressPy: pressed.py,
        });
    };

    const canvasPointerDown = (event) => {
        pointers.current.set(event.pointerId, toCanvasPoint(event));
        capturePointer(event.currentTarget, event.pointerId);

        if (pointers.current.size === 2) {
            beginPinch();
        }
    };

    const canvasPointerMove = (event) => {
        if (pointers.current.has(event.pointerId)) {
            pointers.current.set(event.pointerId, toCanvasPoint(event));
        }

        if (applyPinch()) {
            return;
        }

        if (dragging) {
            const point = toGraphPoint(event);
            const nextPoint = {
                x: clamp(point.x + dragging.offsetX, CANVAS_MARGIN, canvas.width - CANVAS_MARGIN),
                y: clamp(point.y + dragging.offsetY, CANVAS_MARGIN, canvas.height - CANVAS_MARGIN),
            };

            // Перетаскивание включается только после порога в пикселях: иначе клик
            // по узлу считался перетаскиванием и сет не открывался.
            if (!dragged.current) {
                const moved = toCanvasPoint(event);
                if (
                    Math.hypot(moved.px - dragging.pressPx, moved.py - dragging.pressPy) <
                    DRAG_THRESHOLD
                ) {
                    return;
                }
            }

            dragged.current = true;

            const base = { ...displayRef.current };
            base[dragging.key] = nextPoint;

            const targets = resolveCollisions(base, nodes, {
                passes: DRAG_PASSES,
                anchor: base,
                canvas,
                radius: (node) => radiusOf(node, node.key === dragging.key ? DRAG_GROWTH : 1),
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

    const canvasPointerUp = (event) => {
        if (event && typeof event.pointerId === "number") {
            pointers.current.delete(event.pointerId);
        }
        if (pointers.current.size < 2) {
            pinch.current = null;
        }
        if (pointers.current.size > 0) {
            return;
        }

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

    const backgroundPointerDown = (event) => {
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
        return <p className="mutedText">Строим граф связей…</p>;
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
            <EmptyState
                icon="🕸️"
                title="Граф пока пуст"
                hint="Создайте сет и добавьте в него ссылку вида [[Название сета]] — на графе появится связь."
                action={
                    <button className="btn btnPrimary" onClick={() => navigate("/sets/new")}>
                        Создать сет
                    </button>
                }
            />
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
                        onClick={() => zoomBy(1.25)}
                        aria-label="Увеличить"
                    >
                        +
                    </button>
                    <button
                        className="btn btnGhost btnSmall"
                        onClick={() => zoomBy(0.8)}
                        aria-label="Уменьшить"
                    >
                        −
                    </button>
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
                viewBox={`0 0 ${canvas.width} ${canvas.height}`}
                onPointerDown={canvasPointerDown}
                onPointerMove={canvasPointerMove}
                onPointerUp={canvasPointerUp}
                onPointerCancel={canvasPointerUp}
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
                    width={canvas.width}
                    height={canvas.height}
                    onPointerDown={backgroundPointerDown}
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
                                onPointerDown={(event) => nodePointerDown(event, node.key)}
                                onClick={() => nodeClick(node)}
                                onMouseEnter={() => setActiveKey(node.key)}
                                onMouseLeave={() => setActiveKey(null)}
                            >
                                <title>{node.hint}</title>
                                <g className="graphNodeShape">
                                    <circle r={node.radius} />
                                </g>
                                {!labeled || labeled.has(node.key) ? (
                                    <text y={node.radius + 15} textAnchor="middle">
                                        {shorten(node.title)}
                                    </text>
                                ) : null}
                            </g>
                        );
                    })}
                </g>
            </svg>

            <p className="graphHint">
                Клик по кругу — открыть сет, перетаскивание — подвинуть (узлы расступаются),
                на телефоне: один палец — сдвиг графа, два пальца — зум,
                колесо — зум, фон — сдвинуть граф. Сплошная линия — взаимные ссылки, стрелка —
                односторонняя: сет ссылается на соседа, но на него не ссылаются. Золотой пунктирный
                круг — чужой публичный сет; бирюзовый — замороженный снимок; серый пунктир — сет
                удалён, сохранённая копия ещё хранится (наведите, чтобы узнать срок).
                {dense && (
                    <>
                        {" "}
                        Сетов много, поэтому подписи видны только у наведённого узла и его соседей —
                        наведите на круг или приблизьте граф.
                    </>
                )}
            </p>
        </div>
    );
};

export default Graph;
