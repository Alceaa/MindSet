export const desktopAutofocus = () => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
        return false;
    }
    return window.matchMedia("(pointer: fine)").matches;
};

export default desktopAutofocus;
