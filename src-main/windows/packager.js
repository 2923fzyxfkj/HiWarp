const AbstractWindow = require('./abstract');
const {PACKAGER_NAME} = require('../brand');
const PackagerPreviewWindow = require('./packager-preview');
const prompts = require('../prompts');
const FileAccessWindow = require('./file-access-window');
const {app, net} = require('electron');
const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const nodeURL = require('url');
const crypto = require('crypto');
const {spawn} = require('child_process');

const PACKAGER_URL = 'https://github.com/TurboWarp/packager/releases/download/v3.13.0/turbowarp-packager-standalone-3.13.0.html';
const PACKAGER_SHA256 = '4ce9acba1caae2d647365f952a2bd2acd560ba4cd743e7302d3445b4221b875c';
const PACKAGER_FILE_NAME = 'standalone-3.13.0.html';

const applyHiWarpPackagerPatch = data => {
  const replacements = [
    [
      'return"http:"===t.protocol||"https:"===t.protocol}catch(e){return!1}',
      'return"http:"===t.protocol||"https:"===t.protocol||"tw-extensions:"===t.protocol||"file:"===t.protocol}catch(e){return!1}'
    ],
    [
      '"bakeExtensions":"Try to embed cached copy of custom extensions instead of downloading them each time the project is run"',
      '"bakeExtensions":"Bundle custom extensions into the packaged file"'
    ],
    [
      '"bakeExtensions":"尝试嵌入自定义扩展的缓存副本，而不是每次运行作品时下载它们"',
      '"bakeExtensions":"将自定义扩展打包到文件里"'
    ]
  ];
  let text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
  for (const [from, to] of replacements) {
    if (text.includes(from)) {
      text = text.replace(from, to);
    }
  }

  const oldGenerateExtensionURLs = "async generateExtensionURLs(){const e=e=>this.dispatchEvent(new L.a(\"fetch-extensions\",{detail:{progress:e}})),t=e=>{if(!this.options.bakeExtensions)return!1;try{const t=new URL(e);return\"http:\"===t.protocol||\"https:\"===t.protocol||\"tw-extensions:\"===t.protocol||\"file:\"===t.protocol}catch(e){return!1}},n=this.options.extensions,r=n.filter((e=>!t(e))),o=n.filter((e=>t(e))),a=[...r];if(0!==o.length){for(let t=0;t<o.length;t++){e(t/o.length);const n=o[t];try{const e=`(function(Scratch) { ${await K.fetchExtensionScript(n)} })(Scratch);`,t=`data:text/javascript;,${encodeURIComponent(e)}`;a.push(t)}catch(e){console.warn(\"Could not bake extension\",n,e),a.push(n)}}e(1)}return a}";
  const newGenerateExtensionURLs = "async generateExtensionURLs(){const e=e=>this.dispatchEvent(new L.a(\"fetch-extensions\",{detail:{progress:e}})),t=e=>{if(!this.options.bakeExtensions)return!1;try{const t=new URL(e);return\"http:\"===t.protocol||\"https:\"===t.protocol||\"tw-extensions:\"===t.protocol||\"file:\"===t.protocol}catch(e){return!1}},i={liquidGlassPopup:\"tw-extensions://./hidream_puw.js\",ImageProcessor:\"tw-extensions://./image-processing.js\",webglLiquidGlassV4:\"tw-extensions://./liquid-glass-render-v4.js\",cyberexplorertoolboxmini:\"tw-extensions://./cyberexplorer-toolbox-mini.js\",NTeaseMusic:\"tw-extensions://./netease-music.js\",filehelperprov2:\"tw-extensions://./file-plus.js\"},s=[];try{let e=null;if(\"sb3\"===this.project.type){const t=await(await re()).loadAsync(this.project.arrayBuffer),i=t.file(\"project.json\")||t.file(new RegExp(\"^([^/]*/)?project\\\\.json$\"))[0];i&&(e=JSON.parse(await i.async(\"text\")))}else{const t=new TextDecoder().decode(this.project.arrayBuffer);e=JSON.parse(t)}if(e){const t=e=>{if(!e)return;if(Array.isArray(e.extensions))for(const t of e.extensions)i[t]&&s.push(i[t]);if(e.extensionURLs)for(const[t,n]of Object.entries(e.extensionURLs))s.push(n||i[t]);};t(e);Array.isArray(e.targets)&&e.targets.forEach(t)}}catch(e){console.warn(\"Could not inspect project extensions\",e)}const n=Array.from(new Set([...this.options.extensions,...s])),r=n.filter((e=>!t(e))),o=n.filter((e=>t(e))),a=[...r];if(0!==o.length){for(let t=0;t<o.length;t++){e(t/o.length);const n=o[t];try{const e=`(function(Scratch) { ${await K.fetchExtensionScript(n)} })(Scratch);`,t=`data:text/javascript;,${encodeURIComponent(e)}`;a.push(t)}catch(e){console.warn(\"Could not bake extension\",n,e),a.push(n)}}e(1)}return a}";
  if (text.includes(oldGenerateExtensionURLs)) {
    text = text.replace(oldGenerateExtensionURLs, newGenerateExtensionURLs);
  }
  text = text
    .replaceAll('return\"https:\"===A.protocol||\"http:\"===A.protocol||\"data:\"===A.protocol||\"file:\"===A.protocol}catch(t){return!1}', 'return\"https:\"===A.protocol||\"http:\"===A.protocol||\"data:\"===A.protocol||\"file:\"===A.protocol||\"tw-extensions:\"===A.protocol}catch(t){return!1}')
    .replaceAll('return\"https:\"===t.protocol||\"http:\"===t.protocol||\"data:\"===t.protocol||\"file:\"===t.protocol}catch(e){return!1}', 'return\"https:\"===t.protocol||\"http:\"===t.protocol||\"data:\"===t.protocol||\"file:\"===t.protocol||\"tw-extensions:\"===t.protocol}catch(e){return!1}');

  return Buffer.from(text);
};

const computeSHA256 = data => crypto
  .createHash('sha256')
  .update(data)
  .digest('hex');

const isValidPackagerFile = filePath => {
  try {
    return computeSHA256(fs.readFileSync(filePath)) === PACKAGER_SHA256;
  } catch (error) {
    return false;
  }
};

const getBundledPackagerPath = () => path.resolve(__dirname, '../../src-renderer/packager/standalone.html');

const getCachedPackagerPath = () => path.join(app.getPath('userData'), 'packager', PACKAGER_FILE_NAME);

const downloadWithCurl = (url, outputPath) => new Promise((resolve, reject) => {
  if (process.platform !== 'win32') {
    reject(new Error('curl fallback is only enabled on Windows'));
    return;
  }
  const child = spawn('curl.exe', [
    '-L',
    '--retry',
    '5',
    '--retry-delay',
    '2',
    '--connect-timeout',
    '30',
    '--output',
    outputPath,
    url
  ], {
    stdio: 'ignore'
  });
  child.on('error', reject);
  child.on('exit', code => {
    if (code === 0) {
      resolve();
    } else {
      reject(new Error(`curl.exe exited with code ${code}`));
    }
  });
});

const downloadPackager = async outputPath => {
  await fsPromises.mkdir(path.dirname(outputPath), {
    recursive: true
  });
  const temporaryPath = `${outputPath}.download`;
  await fsPromises.rm(temporaryPath, {
    force: true
  });

  try {
    const response = await net.fetch(PACKAGER_URL);
    if (response.status !== 200) {
      throw new Error(`${PACKAGER_URL}: Unexpected status code ${response.status}`);
    }
    const buffer = applyHiWarpPackagerPatch(Buffer.from(await response.arrayBuffer()));
    await fsPromises.writeFile(temporaryPath, buffer);
  } catch (error) {
    await downloadWithCurl(PACKAGER_URL, temporaryPath);
    await fsPromises.writeFile(temporaryPath, applyHiWarpPackagerPatch(await fsPromises.readFile(temporaryPath)));
  }

  if (!isValidPackagerFile(temporaryPath)) {
    await fsPromises.rm(temporaryPath, {
      force: true
    });
    throw new Error('Downloaded packager file failed SHA256 verification');
  }

  await fsPromises.rename(temporaryPath, outputPath);
};

const resolvePackagerPath = async () => {
  const bundledPath = getBundledPackagerPath();
  if (isValidPackagerFile(bundledPath)) {
    return bundledPath;
  }

  const cachedPath = getCachedPackagerPath();
  if (!isValidPackagerFile(cachedPath)) {
    await downloadPackager(cachedPath);
  }
  return cachedPath;
};

const escapeHTML = value => String(value).replace(/[<>&'"]/g, character => {
  switch (character) {
    case '<': return '&lt;';
    case '>': return '&gt;';
    case '&': return '&amp;';
    case '\'': return '&#39;';
    case '"': return '&quot;';
  }
});

const createPackagerErrorPage = error => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${PACKAGER_NAME}</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      background: #111827;
      color: #f8fafc;
      font: 16px/1.6 sans-serif;
    }
    main {
      width: min(640px, calc(100vw - 48px));
      padding: 32px;
      border: 1px solid rgba(148, 163, 184, 0.35);
      border-radius: 18px;
      background: rgba(15, 23, 42, 0.9);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.45);
    }
    h1 {
      margin: 0 0 12px;
      font-size: 26px;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      padding: 12px;
      border-radius: 12px;
      background: rgba(2, 6, 23, 0.9);
      color: #fecaca;
    }
  </style>
</head>
<body>
  <main>
    <h1>Failed to load the project packager</h1>
    <p>HiWarp tried to load the bundled packager and download a cached fallback when it was missing, but both attempts failed.</p>
    <p>Check your network connection, or run <code>npm run fetch</code> again to restore missing resources.</p>
    <pre>${escapeHTML(error && error.stack ? error.stack : error)}</pre>
  </main>
</body>
</html>`;

class PackagerWindow extends AbstractWindow {
  constructor (editorWindow) {
    super();

    /** @type {AbstractWindow} */
    this.editorWindow = editorWindow;

    this.window.setTitle(PACKAGER_NAME);
    this.window.on('page-title-updated', (event) => {
      event.preventDefault();
    });

    this.ipc.on('import-project-with-port', (event) => {
      const port = event.ports[0];
      if (this.editorWindow.window.isDestroyed()) {
        port.postMessage({
          error: true
        });
        return;
      }
      this.editorWindow.window.webContents.postMessage('export-project-to-port', null, [port]);
    });

    this.ipc.on('alert', (event, message) => {
      event.returnValue = prompts.alert(this.window, message);
    });

    this.ipc.on('confirm', (event, message) => {
      event.returnValue = prompts.confirm(this.window, message);
    });

    this.ipc.handle('check-drag-and-drop-path', (event, path) => {
      FileAccessWindow.check(path);
    });

    this.window.webContents.on('did-finish-load', () => {
      // We can't do this from the preload script
      this.window.webContents.executeJavaScript(`
        window.alert = (message) => PromptsPreload.alert(message);
        window.confirm = (message) => PromptsPreload.confirm(message);

        // Electron will try to clone the last value returned here, so make sure it doesn't try to clone a function
        void 0;
      `);
    });

    this.window.webContents.on('did-create-window', (newWindow) => {
      const childWindow = new PackagerPreviewWindow(this.window, newWindow);
      childWindow.protocol = this.protocol;
    });

    this.loadPackager();
    this.show();
  }

  async loadPackager () {
    try {
      const packagerPath = await resolvePackagerPath();
      const packagerURL = nodeURL.pathToFileURL(packagerPath).toString();
      this.initialURL = packagerURL;
      this.protocol = 'file:';
      await this.window.loadURL(packagerURL);
    } catch (error) {
      console.error('Failed to load HiWarp Packager', error);
      const errorURL = `data:text/html;charset=utf-8,${encodeURIComponent(createPackagerErrorPage(error))}`;
      this.initialURL = errorURL;
      this.protocol = 'data:';
      await this.window.loadURL(errorURL);
    }
  }

  getPreload () {
    return 'packager';
  }

  getDimensions () {
    return {
      width: 700,
      height: 700
    };
  }

  isPopup () {
    return true;
  }

  getBackgroundColor () {
    return '#111111';
  }

  handleWindowOpen (details) {
    if (details.url === 'about:blank') {
      return {
        action: 'allow',
        outlivesOpener: true,
        overrideBrowserWindowOptions: PackagerPreviewWindow.getBrowserWindowOverrides()
      };
    }
    return super.handleWindowOpen(details);
  }

  onBeforeRequest (details, callback) {
    const parsed = new URL(details.url);
    if (parsed.origin === 'https://extensions.turbowarp.org') {
      return callback({
        redirectURL: `tw-extensions://./${parsed.pathname}`
      });
    }

    return super.onBeforeRequest(details, callback);
  }

  static forEditor (editorWindow) {
    new PackagerWindow(editorWindow);
  }
}

module.exports = PackagerWindow;
