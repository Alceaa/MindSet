export function parseApiError(error) {
    const data = error?.response?.data;
    const fieldErrors = {};

    if (Array.isArray(data?.errors)) {
        data.errors.forEach((item) => {
            if (item?.field) {
                fieldErrors[item.field] = item.message || "Некорректное значение";
            }
        });
    }

    let message = data?.message;

    if (!message) {
        if (!error?.response) {
            message = "Сервер не отвечает. Проверьте, запущен ли backend.";
        } else if (error.response.status >= 500) {
            message = "Ошибка на сервере. Попробуйте ещё раз позже.";
        } else {
            message = "Не удалось выполнить запрос";
        }
    }

    return { message, fieldErrors, status: error?.response?.status };
}

export default parseApiError;
