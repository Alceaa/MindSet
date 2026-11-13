// Правки конфигурации CRA без выброса (eject).
//
// Нужны ровно из-за одной вещи: Excalidraw приходит как строгий ESM и импортирует
// roughjs без расширения файла (`roughjs/bin/rough`). Webpack 5 такие импорты
// внутри ESM отклоняет, поэтому разрешаем неполные пути — иначе холст не собирается.
module.exports = {
    webpack: (config) => {
        config.module.rules.push({
            test: /\.m?js$/,
            resolve: { fullySpecified: false },
        });

        // У @excalidraw/mermaid-to-excalidraw нет карт исходников, и webpack
        // ругается на каждую из них. К сборке это отношения не имеет.
        config.ignoreWarnings = [
            { module: /@excalidraw/ },
            { message: /Failed to parse source map from/ },
        ];

        return config;
    },
};
