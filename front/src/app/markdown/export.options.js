// Настройки экспорта markdown для всех редакторов MDXEditor.
//
// Без явного маркера mdast сам выбирает символ списка и после любой правки менял наши «-» на «*».
// Фиксируем «-» как основной маркер, «*» оставляем запасным (его mdast берёт, только если «-»
// в документе конфликтует).
export const MARKDOWN_EXPORT_OPTIONS = {
    bullet: "-",
    bulletOther: "*",
};

export default MARKDOWN_EXPORT_OPTIONS;
