const {app, BrowserWindow, Tray, Menu} = require('electron')
const fs = require('fs');
const path = require('path')
const request = require('request');

let tray = undefined
let window = undefined
let apiKey = undefined

const handleRedirect = (e, url) => {
    setTimeout(() => window.loadURL(`file://${path.join(__dirname, 'index.html')}`), 2000);
    if (url !== window.getURL()) {
        e.preventDefault()
        require('electron').shell.openExternal(url).then()
    }
}

app.dock.hide()
app.on('ready', () => {
    createTray()
    createWindow()
})
app.on('window-all-closed', () => app.quit())

const createTray = () => {
    tray = new Tray(path.join(__dirname, 'assets/wakatime.png'))
    tray.setIgnoreDoubleClickEvents(true)

    // tray.on('click', toggleWindow)
    tray.on('click', function (event) {
        toggleWindow()

        // Show devtools when command clicked
        if (window.isVisible() && process.defaultApp && event.metaKey) {
            window.openDevTools({mode: 'detach'})
        }
    })

    const contextMenu = Menu.buildFromTemplate([
        {
            label: '(Re)Login', click: () => {
                window.webContents.session.clearStorageData()
                window.loadURL('https://wakatime.com/login')
                let code = `document.getElementsByClassName("login")[0].onsubmit = function() {
                    location.reload()
                };`;
                window.webContents.executeJavaScript(code);
            }
        },
        {label: 'Close', click: () => app.quit()}
    ])
    tray.on('right-click', (event, bounds) => {
        tray.popUpContextMenu(contextMenu);
    });
    setInterval(refreshTime, 60000)
}

const getWindowPosition = () => {
    const windowBounds = window.getBounds()
    const trayBounds = tray.getBounds()
    const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2))
    const y = Math.round(trayBounds.y + trayBounds.height + 4)
    return {x: x, y: y}
}

const createWindow = () => {
    window = new BrowserWindow({
        width: 425,
        height: 600,
        show: false,
        frame: false,
        fullscreenable: false,
        resizable: false,
        transparent: true,
        webPreferences: {
            nodeIntegration: false,
            backgroundThrottling: false,
        }
    })

    window.loadURL(`file://${path.join(__dirname, 'index.html')}`)

    fs.readFile(`${process.env['HOME']}/.wakatime.cfg`, 'utf-8', (err, data) => {
        if (err) return;
        apiKey = data.match(/[0-9A-Za-z]{8}-[0-9A-Za-z]{4}-4[0-9A-Za-z]{3}-[89ABab][0-9A-Za-z]{3}-[0-9A-Za-z]{12}/g);
        refreshTime()
    });

    // window.on('blur', window.hide)
    window.on('blur', () => {
        if (!window.webContents.isDevToolsOpened()) {
            window.hide()
        }
    })

    window.webContents.on('will-navigate', handleRedirect)
    window.webContents.on('new-window', handleRedirect)

    window.webContents.on('did-finish-load', () => {
        let code = `document.addEventListener('click', (event) => {
            if (event.target.classList.contains('js-quit-action')) window.close()
            if (event.target.classList.contains('js-refresh-action')) location.reload()
        })`;
        window.webContents.executeJavaScript(code);
    });
}

const toggleWindow = () => {
    if (window.isVisible()) window.hide()
    else showWindow()
}

const showWindow = () => {
    const position = getWindowPosition()
    window.setPosition(position.x, position.y, false)
    window.setVisibleOnAllWorkspaces(true);
    window.show();
    window.setVisibleOnAllWorkspaces(false);
    window.focus()
}

const refreshTime = () => {
    const options = {
        'method': 'GET',
        'url': `https://wakatime.com/api/v1/users/current/summaries?api_key=${apiKey}&start=today&end=today`,
        'headers': {}
    };
    request(options, function (error, response) {
        if (error) throw new Error(error);
        let time = JSON.parse(response.body).data[0].grand_total.text
        time = time.substr(0, time.indexOf(' ')) + time.substr(time.indexOf(' ') + 1);
        time = time.substr(0, time.lastIndexOf(' ')) + time.substr(time.lastIndexOf(' ') + 1);
        tray.setTitle(' ' + time);
        window.webContents.executeJavaScript(`if (document.getElementById('js-update-time')) document.getElementById('js-update-time').textContent = "${time}"`);
    });
}
