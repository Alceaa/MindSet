import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import tokenService from "../../api/token.service";
import IntegrationsSettingsPanel from "./settings.integrations.jsx";

jest.mock("../../api/token.service", () => ({
    __esModule: true,
    default: {
        list: jest.fn(),
        create: jest.fn(),
        revoke: jest.fn(),
    },
}));

const token = {
    id: 7,
    title: "Скрипт выгрузки",
    prefix: "msk_abc123",
    created_at: "2026-11-11T15:15:24Z",
    last_used_at: "",
    expires_at: "2026-12-11T15:15:24Z",
    expired: false,
};

beforeEach(() => {
    jest.clearAllMocks();
    tokenService.list.mockResolvedValue({
        tokens: [token],
        limit: 20,
        expiry_choices: [0, 30, 90, 365],
    });
});

test("показывает список токенов с подписью и сроком", async () => {
    render(<IntegrationsSettingsPanel />);

    expect(await screen.findByText("Скрипт выгрузки")).toBeTruthy();
    expect(screen.getByText(/msk_abc123/)).toBeTruthy();
    expect(screen.getByText(/ещё не использовался/)).toBeTruthy();
    expect(screen.getByText(/Использовано 1 из 20/)).toBeTruthy();
});

test("создаёт токен и показывает значение один раз", async () => {
    tokenService.create.mockResolvedValue({
        message: "Токен создан",
        value: "msk_новый-секрет",
        token: { ...token, id: 8, prefix: "msk_новый" },
    });

    render(<IntegrationsSettingsPanel />);
    await screen.findByText("Скрипт выгрузки");

    const input = screen.getByPlaceholderText("Например, «Скрипт выгрузки»");
    fireEvent.change(input, { target: { value: "Новый токен" } });

    await act(async () => {
        screen.getByRole("button", { name: "Создать токен" }).click();
    });

    expect(tokenService.create).toHaveBeenCalledWith({
        title: "Новый токен",
        expires_in_days: 90,
    });
    expect(await screen.findByText("msk_новый-секрет")).toBeTruthy();
    expect(screen.getByText(/второй раз оно не показывается/)).toBeTruthy();
});

test("отзывает токен после подтверждения", async () => {
    tokenService.revoke.mockResolvedValue({ message: "Токен отозван" });

    render(<IntegrationsSettingsPanel />);
    await screen.findByText("Скрипт выгрузки");

    await act(async () => {
        screen.getByRole("button", { name: "Отозвать" }).click();
    });
    await act(async () => {
        screen.getByRole("button", { name: "Отозвать" }).click();
    });

    await waitFor(() => expect(tokenService.revoke).toHaveBeenCalledWith(7));
    await waitFor(() => expect(screen.queryByText("Скрипт выгрузки")).toBeNull());
});

test("показывает ошибку загрузки списка", async () => {
    tokenService.list.mockRejectedValue({ response: { data: { message: "Сервер недоступен" } } });

    render(<IntegrationsSettingsPanel />);

    expect(await screen.findByText("Сервер недоступен")).toBeTruthy();
});
