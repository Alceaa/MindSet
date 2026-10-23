import { act, renderHook } from "@testing-library/react";
import useReadingPosition, { readingPositionKey } from "./use.reading.position";

const KEY = readingPositionKey("set", 42);

const setScrollY = (value) => {
    Object.defineProperty(window, "scrollY", { value: value, configurable: true, writable: true });
};

const advance = (ms) =>
    act(() => {
        jest.advanceTimersByTime(ms);
    });

beforeEach(() => {
    window.localStorage.clear();
    jest.useFakeTimers();
    setScrollY(0);
    window.scrollTo = jest.fn();
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});

test("сохраняет место чтения после прокрутки", () => {
    renderHook(() => useReadingPosition({ key: KEY, ready: true }));

    setScrollY(640);
    act(() => {
        window.dispatchEvent(new Event("scroll"));
    });
    advance(400);

    expect(window.localStorage.getItem(KEY)).toBe("640");
});

test("восстанавливает место чтения при открытии сета", () => {
    window.localStorage.setItem(KEY, "900");

    renderHook(() => useReadingPosition({ key: KEY, ready: true }));
    advance(800);

    expect(window.scrollTo).toHaveBeenCalledWith({ top: 900, behavior: "auto" });
});

test("не прокручивает страницу, если место не сохранялось", () => {
    renderHook(() => useReadingPosition({ key: KEY, ready: true }));
    advance(800);

    expect(window.scrollTo).not.toHaveBeenCalled();
});

test("не сохраняет прокрутку почти в самом верху", () => {
    renderHook(() => useReadingPosition({ key: KEY, ready: true }));

    setScrollY(40);
    act(() => {
        window.dispatchEvent(new Event("scroll"));
    });
    advance(400);

    expect(window.localStorage.getItem(KEY)).toBeNull();
});

test("ничего не делает, пока содержимое не готово", () => {
    window.localStorage.setItem(KEY, "900");

    renderHook(() => useReadingPosition({ key: KEY, ready: false }));
    advance(800);

    expect(window.scrollTo).not.toHaveBeenCalled();
});

test("сохраняет место чтения при уходе со страницы", () => {
    const { unmount } = renderHook(() => useReadingPosition({ key: KEY, ready: true }));

    setScrollY(1280);
    unmount();

    expect(window.localStorage.getItem(KEY)).toBe("1280");
});
