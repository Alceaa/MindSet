import { render, screen } from "@testing-library/react";
import themeService from "../../api/theme.service";
import { THEME_PRESETS } from "../../themes/theme.roles";
import AppearanceSettingsPanel from "./settings.appearance.jsx";

jest.mock("../../api/theme.service", () => ({
    __esModule: true,
    default: {
        list: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
    },
}));

const item = {
    id: 3,
    key: "morskaya-noch",
    title: "Морская ночь",
    description: "Синяя вода",
    mode: "dark",
    base: "nord",
    roles: THEME_PRESETS[1].roles,
};

beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    themeService.list.mockResolvedValue({ themes: [item], limit: 10 });
});

test("показывает встроенные темы, конструктор и свои темы", async () => {
    render(<AppearanceSettingsPanel />);

    // «Тёмная» встречается дважды: карточка встроенной темы и вариант в селекте «тёмная или светлая».
    expect((await screen.findAllByText("Тёмная")).length).toBeGreaterThan(0);
    expect(screen.getByText("Конструктор темы")).toBeTruthy();
    expect(await screen.findByText("Мои темы")).toBeTruthy();
    expect(await screen.findByText("Морская ночь")).toBeTruthy();
    expect(screen.getByText(/Сохранено 1 из 10/)).toBeTruthy();
});

test("пустая библиотека зовёт собрать тему в конструкторе", async () => {
    themeService.list.mockResolvedValue({ themes: [], limit: 10 });

    render(<AppearanceSettingsPanel />);

    expect(await screen.findByText(/Пока ни одной темы/)).toBeTruthy();
    expect(screen.queryByText("Морская ночь")).toBeNull();
});
