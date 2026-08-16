import * as fs from 'node:fs';
import * as pathUtil from 'node:path';
import { spawn } from 'node:child_process';
import { computeSHA256, persistentFetch } from './lib.mjs';
import packagerInfo from './packager.json' with { type: 'json' };

const path = pathUtil.join(import.meta.dirname, '../src-renderer/packager/standalone.html');

const applyHiWarpPackagerPatch = (buffer) => {
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
  let text = Buffer.from(buffer).toString('utf8');
  for (const [from, to] of replacements) {
    if (!text.includes(from) && !text.includes(to)) {
      throw new Error(`Could not patch packager: missing pattern ${from}`);
    }
    text = text.replace(from, to);
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

const isAlreadyDownloaded = () => {
  try {
    const data = fs.readFileSync(path);
    return computeSHA256(data) === packagerInfo.sha256;
  } catch (e) {
    // file might not exist, ignore
  }
  return false;
};

if (!isAlreadyDownloaded()) {
  console.log(`Downloading ${packagerInfo.src}`);
  console.time('Download packager');

  const saveAndVerify = (buffer) => {
    buffer = applyHiWarpPackagerPatch(buffer);
    const sha256 = computeSHA256(buffer);
    if (packagerInfo.sha256 !== sha256) {
      throw new Error(`Hash mismatch: expected ${packagerInfo.sha256} but found ${sha256}`);
    }

    fs.mkdirSync(pathUtil.dirname(path), {
      recursive: true
    });
    fs.writeFileSync(path, new Uint8Array(buffer));
  };

  const downloadWithCurl = () => new Promise((resolve, reject) => {
    const child = spawn('curl.exe', [
      '-L',
      '--retry',
      '5',
      '--retry-delay',
      '2',
      '--connect-timeout',
      '30',
      '--output',
      path,
      packagerInfo.src
    ], {
      stdio: 'inherit'
    });

    child.on('error', reject);
    child.on('exit', code => {
      if (code === 0) {
        try {
          saveAndVerify(fs.readFileSync(path));
          resolve();
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error(`curl.exe exited with code ${code}`));
      }
    });
  });

  persistentFetch(packagerInfo.src)
    .then((res) => res.arrayBuffer())
    .then(saveAndVerify)
    .catch((err) => {
      console.warn(`Node fetch failed, retrying with curl.exe: ${err && err.message ? err.message : err}`);
      return downloadWithCurl();
    })
    .then(() => {
      process.exit(0);
    })  
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
} else {
  console.log('Packager already updated');
}
