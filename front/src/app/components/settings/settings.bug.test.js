import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import reportService from "../../api/report.service";
import uploadImage from "../../utils/image.upload";
import BugReportPanel from "./settings.bug.jsx";

jest.mock("../../api/report.service", () => ({
    __esModule: true,
    default: { send: jest.fn() },
}));

jest.mock("../../utils/image.upload", () => ({
    __esModule: true,
    default: jest.fn(),
}));

const image = (name) => new File(["fake"], name, { type: "image/png" });

const attach = async (files) => {
    const input = screen.getByLabelText("Прикрепить изображения к отчёту");
    await act(async () => {
        fireEvent.change(input, { target: { files } });
    });
};

const fillForm = () => {
    fireEvent.change(screen.getByPlaceholderText(/не сохраняется биография/), {
        target: { value: "Не сохраняется биография" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Что произошло/), {
        target: { value: "Ввёл текст, нажал сохранить — ничего не произошло." },
    });
};

beforeEach(() => {
    jest.clearAllMocks();
    reportService.send.mockResolvedValue({ message: "Спасибо! Отчёт отправлен" });
    uploadImage.mockResolvedValue("https://s3.twcstorage.ru/mindset-media/reports/1.png");
});

test("отправляет отчёт вместе со ссылками на скриншоты", async () => {
    render(<BugReportPanel />);
    fillForm();
    await attach([image("screen.png")]);

    expect(uploadImage).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText("Убрать изображение")).toBeTruthy();

    await act(async () => {
        screen.getByRole("button", { name: "Отправить" }).click();
    });

    await waitFor(() => expect(reportService.send).toHaveBeenCalledTimes(1));
    expect(reportService.send).toHaveBeenCalledWith({
        topic: "Не сохраняется биография",
        message: "Ввёл текст, нажал сохранить — ничего не произошло.",
        page: window.location.pathname + window.location.search,
        attachments: ["https://s3.twcstorage.ru/mindset-media/reports/1.png"],
    });
    expect(await screen.findByText(/Спасибо!/)).toBeTruthy();
});

test("принимает не больше трёх изображений", async () => {
    render(<BugReportPanel />);
    await attach([image("1.png"), image("2.png"), image("3.png"), image("4.png")]);

    expect(uploadImage).toHaveBeenCalledTimes(3);
    expect(await screen.findByText(/не больше 3 изображений/)).toBeTruthy();
});

test("умеет убрать вложение и отправляет отчёт без него", async () => {
    render(<BugReportPanel />);
    fillForm();
    await attach([image("screen.png")]);

    fireEvent.click(await screen.findByLabelText("Убрать изображение"));
    expect(screen.queryByLabelText("Убрать изображение")).toBeNull();

    await act(async () => {
        screen.getByRole("button", { name: "Отправить" }).click();
    });

    await waitFor(() => expect(reportService.send).toHaveBeenCalledTimes(1));
    expect(reportService.send.mock.calls[0][0].attachments).toEqual([]);
});

test("показывает ошибку, если изображение не загрузилось", async () => {
    uploadImage.mockRejectedValue(new Error("Не удалось загрузить изображение"));

    render(<BugReportPanel />);
    await attach([image("screen.png")]);

    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByLabelText("Убрать изображение")).toBeNull();
});
