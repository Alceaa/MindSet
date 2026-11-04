// Экранирование markdown. Сериализатор (mdast-util-to-markdown) защищает знаки препинания
// обратным слешем: «*» уезжает как «\*», бэктик — как «\`». Правила экранирования он
// только добавляет к своим (см. mdast-util-to-markdown/lib/configure.js), поэтому
// отключить их настройками нельзя — экранированное приходится снимать при разборе.
export const ESCAPED_PUNCTUATION = /\\([!-/:-@[-`{-~])/g;

export const stripEscapes = (value) =>
    String(value ?? "").replace(ESCAPED_PUNCTUATION, "$1");

export default stripEscapes;
