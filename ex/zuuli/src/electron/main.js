// Module to control the application lifecycle and the native browser window.
const { app, BrowserWindow, protocol } = require("electron");
const { fork } = require('child_process');
const path = require("path");
const url = require("url");
const warp = require("./warp/index.node")

const { ipcMain } = require('electron')


// Maybe have to do this in every process to call other methods such
// as getServerHeight ....
// at least all these initCoin calls (2 too many?) seem to resolve
// relative to the process that is running (eg electronmon .)
// Maybe have to revisit when packaging?
warp.initCoin(0, "./zec.db", "https://mainnet.lightwalletd.com:9067")

let p

function forkWarp() {
    // console.log("forkWarp")
    p = fork(path.join(__dirname, 'warp.js'), [], {
        stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });
    // console.log("set on close")
    p.on('error', (err) => {
        console.log('ERROR', err)
        // console.log(arguments)
        // try again in 30 seconds
        setTimeout(forkWarp, 30000)
    })
    p.on('close', (code, signal) => {
        console.log("CLOSE AND RESTART", code, signal)
        const syncH = warp.getSyncHeight()
        console.log("SYNC", warp.getSyncHeight())
        console.log("Server", warp.getServerHeight())
        // TODO: differentiate between errors?
        // TODO: how much is the right amount to rewind?
        // only need to rewind for chain reorg?
        if (code !== 0) {
            console.log("NULL CODE")
            // warp.rewindToHeight(syncH - 10)
            // console.log("rewound!")
            setTimeout(forkWarp, 1)
            return
        }
        // else {
        //     console.log("Exit with code", code)
        // }
        // does this do sth weird tho ...
        setTimeout(forkWarp, 30000)
        // forkWarp()
    });
    // console.log("END")
}
// console.log("FORK")
forkWarp()




//  // Event handler for synchronous incoming messages
//  ipcMain.on('synchronous-message', (event, arg) => {
//     console.log(arg)

//     // Synchronous event emmision
//     event.returnValue = 'sync pong'
//  })



// Create the native browser window.
function createWindow() {
    const mainWindow = new BrowserWindow({
        width: 700,
        height: 800,
        // Set the path of an additional "preload" script that can be used to
        // communicate between the node-land and the browser-land.
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            nodeIntegrationInWorker: true,
        },
    });

    // In production, set the initial browser path to the local bundle generated
    // by the Create React App build process.
    // In development, set it to localhost to allow live/hot-reloading.
    const appURL = app.isPackaged
        ? url.format({
            pathname: path.join(__dirname, "index.html"),
            protocol: "file:",
            slashes: true,
        })
        : "http://localhost:3000";
    mainWindow.loadURL(appURL);

    // Automatically open Chrome's DevTools in development mode.
    if (!app.isPackaged) {
        mainWindow.webContents.openDevTools();
    }

    // IPC -------------------------------------------
    // Event handler for asynchronous incoming messages
    ipcMain.on('rewind', (event, arg) => {
        // console.log(arg)
        // console.log("KILLING", p.kill)
        p.kill()
        // console.log("Killed", p.killed)
        // let's see about this arg ...
        warp.rewindToHeight(arg)
        // Event emitter for sending asynchronous messages
        event.sender.send('ipcsnackbar', {
            message: "kilt",
            severity: "success",
        })
    })
}

// Setup a local proxy to adjust the paths of requested files when loading
// them from the local production bundle (e.g.: local fonts, etc...).
function setupLocalFilesNormalizerProxy() {
    protocol.registerHttpProtocol(
        "file",
        (request, callback) => {
            const url = request.url.substr(8);
            callback({ path: path.normalize(`${__dirname}/${url}`) });
        },
        (error) => {
            if (error) console.error("Failed to register protocol");
        }
    );
}

// This method will be called when Electron has finished its initialization and
// is ready to create the browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    createWindow();
    setupLocalFilesNormalizerProxy();

    app.on("activate", function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows are closed, except on macOS.
// There, it's common for applications and their menu bar to stay active until
// the user quits  explicitly with Cmd + Q.
app.on("window-all-closed", function () {
    if (process.platform !== "darwin") {
        app.quit();
    }
});

// If your app has no need to navigate or only needs to navigate to known pages,
// it is a good idea to limit navigation outright to that known scope,
// disallowing any other kinds of navigation.
const allowedNavigationDestinations = "https://free2z.cash";
app.on("web-contents-created", (event, contents) => {
    contents.on("will-navigate", (event, navigationURL) => {
        const parsedURL = new URL(navigationURL);
        if (!allowedNavigationDestinations.includes(parsedURL.origin)) {
            event.preventDefault();
        }
    });
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

//
