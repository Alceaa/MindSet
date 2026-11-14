import { act, render, screen } from "@testing-library/react";
import { ToastProvider, useToast } from "./toast.jsx";

const Trigger = () => {
    const { push } = useToast();
    return (
        <button type="button" onClick={() => push("Сет сохранён", "success")}>
            Сохранить
        </button>
    );
};

const openToast = () =>
    act(() => {
        screen.getByRole("button", { name: "Сохранить" }).click();
    });

beforeEach(() => {
    jest.useFakeTimers();
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});

test("тост появляется по вызову push и исчезает сам", () => {
    render(
        <ToastProvider>
            <Trigger />
        </ToastProvider>
    );

    expect(screen.queryByText("Сет сохранён")).toBeNull();

    openToast();
    expect(screen.getByText("Сет сохранён")).toBeTruthy();

    act(() => {
        jest.advanceTimersByTime(4000);
    });
    expect(screen.queryByText("Сет сохранён")).toBeNull();
});

test("тост закрывается кнопкой", () => {
    render(
        <ToastProvider>
            <Trigger />
        </ToastProvider>
    );

    openToast();
    act(() => {
        screen.getByRole("button", { name: "Закрыть уведомление" }).click();
    });

    expect(screen.queryByText("Сет сохранён")).toBeNull();
});

test("без провайдера хук не роняет страницу", () => {
    const Alone = () => {
        const { push } = useToast();
        return (
            <button type="button" onClick={() => push("нет провайдера")}>
                Ок
            </button>
        );
    };

    render(<Alone />);
    act(() => {
        screen.getByRole("button", { name: "Ок" }).click();
    });

    expect(screen.queryByText("нет провайдера")).toBeNull();
});
