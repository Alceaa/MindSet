import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import "../../css/common/toast.scss";

const ToastContext = createContext(null);

const LIFETIME = { error: 6000, success: 4000, info: 4000 };

let nextId = 1;

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);
    const timers = useRef(new Map());

    const dismiss = useCallback((id) => {
        setToasts((current) => current.filter((item) => item.id !== id));
        const timer = timers.current.get(id);
        if (timer) {
            window.clearTimeout(timer);
            timers.current.delete(id);
        }
    }, []);

    const push = useCallback(
        (text, kind = "success") => {
            if (!text) {
                return null;
            }
            const id = nextId++;
            setToasts((current) => [...current, { id, text, kind }]);
            const timer = window.setTimeout(
                () => dismiss(id),
                LIFETIME[kind] ?? LIFETIME.info
            );
            timers.current.set(id, timer);
            return id;
        },
        [dismiss]
    );

    useEffect(
        () => () => {
            timers.current.forEach((timer) => window.clearTimeout(timer));
            timers.current.clear();
        },
        []
    );

    const value = useMemo(() => ({ push, dismiss }), [push, dismiss]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="toastRegion" role="region" aria-label="Уведомления">
                <div className="toastStack" aria-live="polite" aria-atomic="false">
                    {toasts.map((item) => (
                        <div className={`toast toast-${item.kind}`} key={item.id}>
                            <span className="toastText">{item.text}</span>
                            <button
                                type="button"
                                className="toastClose"
                                onClick={() => dismiss(item.id)}
                                aria-label="Закрыть уведомление"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => useContext(ToastContext) ?? { push: () => null, dismiss: () => {} };

export default ToastProvider;
