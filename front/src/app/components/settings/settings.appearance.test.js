import { render, screen } from "@testing-library/react";
import themeService from "../../api/theme.service";
import AppearanceSettingsPanel from "./settings.appearance.jsx";

jest.mock("../../api/theme.service", () => ({
    __esModule: true,
    default: {
        published: jest.fn(),
        own: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        submit: jest.fn(),
        withdraw: jest.fn(),
        profileTheme: jest.fn(),
        saveProfileTheme: jest.fn(),
        clearProfileTheme: jest.fn(),
    },
}));

jest.mock("../../context/auth.context", () => ({
    __esModule: true,
    useAuth: () => ({ user: { login: "verifyuser" }, isAuthenticated: true }),
}));

const own = {
    id: 3,
    key: "northern-dusk",
    title: "Северные сумерки",
    description: "Холодный вечер",
    author: "verifyuser",
    mode: "dark",
    base: "dark",
    variables: { "--bg-canvas": "#0f1420", "--bg-surface": "#151a26" },
};

const alien = {
    ...own,
    id: 4,
    key: "sea-glass",
    title: "Морское стекло",
    author: "someone",
};

beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    themeService.profileTheme.mockResolvedValue({ theme: null });
    themeService.own.mockResolvedValue({ themes: [], limit: 10 });
    themeService.published.mockResolvedValue({ themes: [alien, own] });
});

test("своя тема показывается один раз — в списке сообщества и с пометкой", async () => {
    render(<AppearanceSettingsPanel />);

    expect(await screen.findByText("Северные сумерки")).toBeTruthy();
    expect(screen.getByText("Морское стекло")).toBeTruthy();
    expect(screen.getByText("ваша")).toBeTruthy();
    // Отдельной карточки «Своя тема» больше нет.
    expect(screen.queryByText("Своя тема")).toBeNull();
});

test("пометки нет у чужой темы", async () => {
    themeService.published.mockResolvedValue({ themes: [alien] });

    render(<AppearanceSettingsPanel />);

    expect(await screen.findByText("Морское стекло")).toBeTruthy();
    expect(screen.queryByText("ваша")).toBeNull();
});

test("без описания под названием ничего не выводится", async () => {
    themeService.published.mockResolvedValue({
        themes: [{ ...alien, description: "" }],
    });

    render(<AppearanceSettingsPanel />);

    expect(await screen.findByText("Морское стекло")).toBeTruthy();
    expect(screen.queryByText(/Тема из сообщества/)).toBeNull();
});
