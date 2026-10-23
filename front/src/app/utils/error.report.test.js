const mockSend = jest.fn(() => Promise.resolve({}));

jest.mock("../api/report.service", () => ({
    __esModule: true,
    default: { send: (...args) => mockSend(...args) },
}));

// Свежий модуль на каждый тест: у репортёра свои счётчики отправок.
const loadReporter = () => {
    let reporter = null;
    jest.isolateModules(() => {
        reporter = require("./error.report");
    });
    return reporter;
};

beforeEach(() => {
    mockSend.mockClear();
    window.history.replaceState({}, "", "/mindset/sets/12");
});

afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
});

test("отправляет ошибку браузера в журнал жалоб", () => {
    const { reportFrontendError } = loadReporter();

    reportFrontendError("window.onerror", new Error("Упал редактор заметки"));

    expect(mockSend).toHaveBeenCalledTimes(1);

    const payload = mockSend.mock.calls[0][0];
    expect(payload.topic).toBe("Ошибка в браузере");
    expect(payload.message).toContain("Упал редактор заметки");
    expect(payload.page).toBe("/mindset/sets/12");
});

test("не отправляет одну и ту же ошибку дважды", () => {
    const { reportFrontendError } = loadReporter();
    const error = new Error("Одна и та же ошибка в списке сетов");

    reportFrontendError("window.onerror", error);
    reportFrontendError("window.onerror", error);

    expect(mockSend).toHaveBeenCalledTimes(1);
});

test("пропускает кросс-доменные и служебные ошибки", () => {
    const { reportFrontendError } = loadReporter();

    reportFrontendError("window.onerror", "Script error.");
    reportFrontendError("window.onerror", "ResizeObserver loop limit exceeded");

    expect(mockSend).not.toHaveBeenCalled();
});

test("не чаще одного отчёта в 30 секунд и не больше двух за сеанс", () => {
    jest.useFakeTimers();
    const { reportFrontendError } = loadReporter();

    reportFrontendError("window.onerror", new Error("Первая ошибка в приложении"));
    reportFrontendError("unhandledrejection", new Error("Вторая ошибка сразу же"));

    expect(mockSend).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(31000);
    reportFrontendError("unhandledrejection", new Error("Вторая ошибка в приложении"));

    expect(mockSend).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(31000);
    reportFrontendError("window.onerror", new Error("Третья ошибка в приложении"));

    expect(mockSend).toHaveBeenCalledTimes(2);
});

test("ловит необработанные ошибки через слушатели", () => {
    const { installErrorReporting } = loadReporter();

    installErrorReporting();

    window.dispatchEvent(
        new ErrorEvent("error", { error: new Error("Необработанная ошибка в графе") })
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0].message).toContain("Необработанная ошибка в графе");
});

