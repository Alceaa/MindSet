import { act, renderHook } from "@testing-library/react";
import notificationsService from "../api/notifications.service";
import useNotifications, { NOTIFICATIONS_POLL_INTERVAL } from "./use.notifications";

jest.mock("../api/notifications.service", () => ({
    __esModule: true,
    default: { unread: jest.fn(() => Promise.resolve({ unread: 0 })) },
}));

let view = null;

const mount = (enabled) => {
    view = renderHook(() => useNotifications(enabled));
    return view;
};

const flush = () =>
    act(async () => {
        await Promise.resolve();
    });

beforeEach(() => {
    jest.useFakeTimers();
    notificationsService.unread.mockReset();
    notificationsService.unread.mockResolvedValue({ unread: 0 });
    Object.defineProperty(document, "visibilityState", {
        value: "visible",
        configurable: true,
    });
});

afterEach(() => {
    view?.unmount();
    view = null;
    jest.clearAllTimers();
    jest.useRealTimers();
});

test("запрашивает счётчик сразу и повторяет по таймеру", async () => {
    notificationsService.unread.mockResolvedValue({ unread: 3 });

    const { result } = mount(true);
    await flush();

    expect(notificationsService.unread).toHaveBeenCalledTimes(1);
    expect(result.current.unread).toBe(3);

    await act(async () => {
        jest.advanceTimersByTime(NOTIFICATIONS_POLL_INTERVAL);
    });

    expect(notificationsService.unread).toHaveBeenCalledTimes(2);
});

test("без авторизации сервер не опрашивается", async () => {
    mount(false);

    await act(async () => {
        jest.advanceTimersByTime(NOTIFICATIONS_POLL_INTERVAL * 3);
    });

    expect(notificationsService.unread).not.toHaveBeenCalled();
});

test("ошибка сети не сбрасывает счётчик", async () => {
    notificationsService.unread.mockResolvedValueOnce({ unread: 5 });

    const { result } = mount(true);
    await flush();
    expect(result.current.unread).toBe(5);

    notificationsService.unread.mockRejectedValueOnce(new Error("network"));
    await act(async () => {
        jest.advanceTimersByTime(NOTIFICATIONS_POLL_INTERVAL);
    });

    expect(result.current.unread).toBe(5);
});

test("возврат на вкладку обновляет счётчик", async () => {
    const { result } = mount(true);
    await flush();

    notificationsService.unread.mockResolvedValue({ unread: 2 });
    await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.unread).toBe(2);
});

test("после размонтирования таймер не тикает", async () => {
    mount(true);
    await flush();

    const calls = notificationsService.unread.mock.calls.length;
    view.unmount();
    view = null;

    await act(async () => {
        jest.advanceTimersByTime(NOTIFICATIONS_POLL_INTERVAL * 2);
    });

    expect(notificationsService.unread).toHaveBeenCalledTimes(calls);
});
