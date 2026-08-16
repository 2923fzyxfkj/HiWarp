import * as fs from 'node:fs';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import asar from '@electron/asar';
import sevenZip from '7zip-bin';
import packageJSON from '../package.json' with { type: 'json' };
import packagerInfo from './packager.json' with { type: 'json' };
import { computeSHA256 } from './lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const packagerPath = path.join(root, 'src-renderer', 'packager', 'standalone.html');
const appAsarPath = path.join(root, 'dist', 'win-unpacked', 'resources', 'app.asar');
const unpackedPath = path.join(root, 'dist', 'win-unpacked');
const outputPath = path.join(root, 'dist', `${packageJSON.build.productName} ${packageJSON.version} Windows x64.zip`);

const run = (command, args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    ...options
  });
  child.on('error', reject);
  child.on('exit', code => {
    if (code === 0) {
      resolve();
    } else {
      reject(new Error(`${command} exited with code ${code}`));
    }
  });
});

const assertPackagerDownloaded = () => {
  if (!fs.existsSync(packagerPath)) {
    throw new Error(`Missing packager page: ${packagerPath}. Run node scripts/download-packager.mjs first.`);
  }
  const hash = computeSHA256(fs.readFileSync(packagerPath));
  if (hash !== packagerInfo.sha256) {
    throw new Error(`Packager page hash mismatch: expected ${packagerInfo.sha256} but found ${hash}`);
  }
};

const assertPackagerInAsar = () => {
  if (!fs.existsSync(appAsarPath)) {
    throw new Error(`Missing packaged app.asar: ${appAsarPath}. Run electron-builder --dir first.`);
  }
  const files = asar.listPackage(appAsarPath).map(file => file.replaceAll('\\', '/'));
  if (!files.includes('/src-renderer/packager/standalone.html')) {
    throw new Error('Packaged app.asar does not include src-renderer/packager/standalone.html');
  }
};

const main = async () => {
  assertPackagerDownloaded();
  assertPackagerInAsar();

  fs.mkdirSync(path.dirname(outputPath), {
    recursive: true
  });
  fs.rmSync(outputPath, {
    force: true
  });

  await run(sevenZip.path7za, [
    'a',
    '-tzip',
    '-mx=9',
    outputPath,
    '.'
  ], {
    cwd: unpackedPath
  });

  console.log(`Created ${outputPath}`);
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
