// 看車 Tokyo 桌面版：在本機開一個小 http server 服務 build/，再用 Electron 視窗載入。
// （不用 file:// 是因為 Web Worker 跟 fetch 在 file:// 下會被擋）
const {app, BrowserWindow, shell} = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const webRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'web')
    : path.join(__dirname, '..', 'build');

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.map': 'application/json',
    '.glb': 'model/gltf-binary', '.pbf': 'application/x-protobuf', '.woff2': 'font/woff2'
};

function startServer() {
    return new Promise(resolve => {
        const server = http.createServer((req, res) => {
            let p = decodeURIComponent(req.url.split('?')[0]);
            if (p.endsWith('/')) p += 'index.html';
            const file = path.normalize(path.join(webRoot, p));
            if (!file.startsWith(webRoot)) {
                res.statusCode = 403;
                return res.end();
            }
            fs.stat(file, (err, st) => {
                if (err || !st.isFile()) {
                    res.statusCode = 404;
                    return res.end();
                }
                res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
                fs.createReadStream(file).pipe(res);
            });
        });
        server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    });
}

app.whenReady().then(async () => {
    const port = await startServer();
    const win = new BrowserWindow({
        width: 1400, height: 900, backgroundColor: '#e9e6df', title: '看車 Tokyo',
        autoHideMenuBar: true
    });
    win.webContents.setWindowOpenHandler(({url}) => {
        shell.openExternal(url);
        return {action: 'deny'};
    });
    win.loadURL(`http://127.0.0.1:${port}/`);
});

app.on('window-all-closed', () => app.quit());
