# NBN PersonalServer desktop app

NBN PersonalServer shares one folder on your computer with your ZX Spectrum Next over your home network. The Next connects to it with `.nbnget` and `.nbnshell`, and can read files from the folder and write files into it.

The app runs on Windows, macOS and Linux. It has one window, where you choose the folder, start and stop the server, and see the address to type on the Next.

Use it on your home network only. Anyone who can reach your computer on the network can read and write files in the shared folder while the server runs.

## Install on Windows

1. Download `NBN-PersonalServer-<version>-win-x64.exe`.
2. Your browser may say the file is not commonly downloaded. In Microsoft Edge, open the `...` menu next to the download, choose **Keep**, then **Show more** and **Keep anyway**.
3. Double-click the file. Windows shows a blue box that says "Windows protected your PC". The app is not signed, so Windows does not know who made it. Click **More info**, then **Run anyway**.
4. Follow the installer. It puts NBN PersonalServer in the Start menu and on the desktop.

## Install on macOS

1. Download `NBN-PersonalServer-<version>-mac-universal.dmg`. The same file works on Apple silicon and Intel Macs.
2. Double-click the `.dmg` file, then drag **NBN PersonalServer** into the **Applications** folder.
3. Open **NBN PersonalServer** from Applications. The first time, macOS says it cannot check the app for malicious software, because the app is not signed. Click **Done**.
4. Open **System Settings**, then **Privacy & Security**. Scroll down to the message about NBN PersonalServer and click **Open Anyway**. macOS asks again: click **Open Anyway**, then type your password and click **OK**.

After this, the app opens like any other app.

## Install on Linux

1. Download `NBN-PersonalServer-<version>-linux-x86_64.AppImage`.
2. Make it executable. In your file manager, open the file's properties and turn on "Allow executing file as program", or run `chmod +x NBN-PersonalServer-*.AppImage` in a terminal.
3. Double-click the file to start it.

AppImages need FUSE 2. When the AppImage does not start on Ubuntu or Debian, install it with `sudo apt install libfuse2` (on Ubuntu 24.04 and later, the package is `libfuse2t64`).

## Allow the firewall

The first time you start the server, your computer's firewall may ask whether the app can accept connections.

- **Windows.** Windows Defender Firewall asks which networks to allow. Tick **Private networks**, then click **Allow access**. If you click **Cancel**, the Next cannot connect.
- **macOS.** When the firewall is on, macOS asks whether NBN PersonalServer can accept incoming network connections. Click **Allow**.
- **Linux.** Most desktops have no firewall prompt. If you use `ufw`, allow the port with `sudo ufw allow 48128/tcp`.

## Use the app

### Choose the shared folder

Click **Choose folder** and pick a folder. The Next can read and write files in this folder and in the folders inside it. Make a new, empty folder for the Next if you are not sure which one to use.

The server cannot start until you choose a folder. When the folder you chose is moved or deleted, the window says so, and you choose it again.

### Start the server

Click **Start**. The window shows **Running**. Click **Stop** to stop it.

When the server cannot start, the window says why. The usual reason is that another program already uses the port. Close that program, or choose another port.

### The address to type on the Next

Under **Address for the Next**, the window lists this computer's addresses on your network, such as `192.168.1.20`. The name after each address is the network connection it belongs to, such as `Wi-Fi` or `Ethernet` on Windows, or `en0` on a Mac. Use the address of the connection your computer uses for your home network. When there are several and you are not sure, try each one.

On the Next, give the address with `-s`:

```
.nbnget -s 192.168.1.20 GAME.NEX
.nbnshell -s 192.168.1.20
```

The Next uses port 48128 unless you give another one. When you change the port in the app, give the same port on the Next with `-p`:

```
.nbnget -s 192.168.1.20 -p 48200 GAME.NEX
```

### Settings

- **Port.** The network port the server uses. The default is 48128.
- **Show files and folders with names that start with ".".** When this is off, folder listings on the Next leave out such names.
- **When I close this window.** Choose **Quit the app** to stop the server when you close the window. Choose **Keep the server running** to keep it running with an icon in the Windows tray, the macOS menu bar or the Linux tray. The icon's menu opens the window again, or quits the app. On Windows, click the icon to open the window, and right-click it for the menu.

To change the folder, the port or the dot setting, stop the server first.

Some Linux desktops, such as GNOME, show tray icons only with an extension such as AppIndicator. Without a tray, choose **Quit the app**, or the app keeps running with no window and no icon.

The app saves the settings and uses them the next time it starts. They are in a file called `settings.json`, in:

- Windows: `%APPDATA%\NBN PersonalServer`
- macOS: `~/Library/Application Support/NBN PersonalServer`
- Linux: `~/.config/NBN PersonalServer`

### The log

The bottom of the window shows the server's log: each connection, and each command the Next sends. Each line starts with the time and the level: `INFO`, `WARN` or `ERROR`. When something does not work, the log shows what the server saw.

## For developers

The app is an Electron app. It runs the PersonalServer from `../server` in its main process, through the library's `startServer()`. Node.js 24 is needed to build it.

```sh
cd server && npm ci
cd ../desktop && npm ci
npm test           # builds the server, then runs the tests in test/
npm run typecheck
npm run dist:mac   # dist/NBN-PersonalServer-<version>-mac-universal.dmg
npm run dist:win   # dist/NBN-PersonalServer-<version>-win-x64.exe
npm run dist:linux # dist/NBN-PersonalServer-<version>-linux-x86_64.AppImage
npm run dist       # every package
```

Every package builds on a Mac. The packages are not signed: the macOS app has an ad-hoc signature only, and the Windows files have none. The electron-builder settings are in the `build` section of `package.json`.

`npm run build` bundles the app into `build/` with esbuild (`bundle.mjs`): the main process and the server library in `main.cjs`, the preload script, and the window's files from `src/renderer/`. The packages need no `node_modules` at run time.

The tests use Node's test runner and open no window. They cover the settings file, the address list, and starting and stopping the server in `src/core/`.

`assets/` holds the icons. The PNG files are drawn from the SVG files next to them, with `rsvg-convert`.
