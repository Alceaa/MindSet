const path = require('path');

module.exports = {
    paths: function (paths, env) {        
        paths.appIndexJs = path.join(__dirname, 'index.js');
        paths.appSrc = path.join(__dirname, 'app');
        paths.appHtml = path.join(__dirname, '..', 'templates/index.html');
        return paths;
    },
}