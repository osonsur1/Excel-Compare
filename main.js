const path = require('path')
const os = require('os')
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron')
const slash = require('slash')
const log = require('electron-log')
const xlsx = require('xlsx')
const fs = require('fs')
const _ = require('lodash')

// Set env
process.env.NODE_ENV = 'development'

const isDev = process.env.NODE_ENV !== 'production' ? true : false
const isMac = process.platform === 'darwin' ? true : false

let mainWindow
let aboutWindow

function createMainWindow() {
    mainWindow = new BrowserWindow({
        title: 'ImageShrink',
        width: isDev ? 800 : 500,
        height: 700,
        icon: `${__dirname}/assets/icons/Icon_256x256.png`,
        resizable: isDev ? true : false,
        backgroundColor: 'white',
        webPreferences: {
            nodeIntegration: true
        }
    })

    if (isDev) {
        mainWindow.webContents.openDevTools()
    }

    mainWindow.loadFile('./app/index.html')
}

function createAboutWindow() {
    aboutWindow = new BrowserWindow({
        title: 'About ExcelCompare',
        width: 300,
        height: 300,
        icon: `${__dirname}/assets/icons/Icon_256x256.png`,
        resizable: false,
        backgroundColor: 'white',
    })
    aboutWindow.setMenu(null)
    aboutWindow.loadFile('./app/about.html')
}

app.on('ready', () => {
    createMainWindow()

    const mainMenu = Menu.buildFromTemplate(menu)
    Menu.setApplicationMenu(mainMenu)

    mainWindow.on('ready', () => (mainWindow = null))
})

const menu = [
    ...(isMac ? [{
        label: app.name,
        submenu: [{
            label: 'About',
            click: createAboutWindow,
        }, ],
    }, ] : []),
    {
        role: 'fileMenu',
    },
    ...(!isMac ? [{
        label: 'Help',
        submenu: [{
            label: 'About',
            click: createAboutWindow,
        }, ],
    }, ] : []),
    ...(isDev ? [{
        label: 'Developer',
        submenu: [
            { role: 'reload' },
            { role: 'forcereload' },
            { type: 'separator' },
            { role: 'toggledevtools' },
        ],
    }, ] : []),
]

ipcMain.on('file:compare', (e, options) => {
    targetDir = slash(path.join(os.homedir(), 'excelcompare'))

    let file1JSON = readFileToJson(options.file1Path)
    let file2JSON = readFileToJson(options.file2Path)

    let targetUniqueField = options.uniqueField

    let nonMatchingData = findNotMatching(file1JSON, file2JSON, targetUniqueField)
    let matchingData = findMatching(file1JSON, file2JSON, targetUniqueField)

    generateXl(targetDir, nonMatchingData, 'noMatch', 'noMatchd')
    generateXl(targetDir, matchingData, 'match', 'matchd')

    shell.openPath(targetDir)
    mainWindow.webContents.send('file:done')
})

function readFileToJson(filename) {

    let wb = xlsx.readFile(filename, { cellDates: true, cellStyles: true })
    let firstTabName = wb.SheetNames[0]
    let ws = wb.Sheets[firstTabName]
    let data = xlsx.utils.sheet_to_json(ws)

    return data
}

function findMatching(file1, file2, matchField) {
    try {
        // return _.intersectionBy(file1, file2, matchField)
        return combineArrays(matchField, file1, file2)
    } catch (err) {
        log.error(err)
    }
}

function findNotMatching(file1, file2, noMatchField) {
    try {
        return _.differenceBy(file1, file2, noMatchField)
    } catch (err) {
        log.error(err)
    }
}

function generateXl(targetDir, data, sheetname, filename) {
    try {
        let newWB = xlsx.utils.book_new()
        let newWS = xlsx.utils.json_to_sheet(data)

        fs.existsSync(targetDir) || fs.mkdirSync(targetDir);

        xlsx.utils.book_append_sheet(newWB, newWS, sheetname)
        filePath = path.join(targetDir, filename)
        xlsx.writeFile(newWB, filePath + '.xlsx')
    } catch (err) {
        log.error(err)
    }
}

function combineArrays(key, ...arrs) {
    const result = {};
    const counts = {};
    arrs.forEach(arr => {
        arr.forEach(el => {
            result[el[key]] = {...result[el[key]], ...el };
            counts[el[key]] = (counts[el[key]] || 0) + 1;
        });
    });
    return Object.values(result).filter(obj =>
        counts[obj[key]] > 1
    );
}

app.on('window-all-closed', () => {
    if (!isMac) {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow()
    }
})

app.allowRendererProcessReuse = true