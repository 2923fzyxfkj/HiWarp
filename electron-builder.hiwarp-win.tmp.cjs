const {build} = require('./package.json');

module.exports = {
  ...build,
  appId: 'org.hiwarp.desktop.alpha',
  productName: 'HiWarp windows-1.4.2-alpha.1-UD.Q',
  executableName: 'HiWarp',
  extraMetadata: {
    name: 'hiwarp-desktop',
    productName: 'HiWarp windows-1.4.2-alpha.1-UD.Q',
    version: '1.4.2-alpha.1-UD.Q'
  },
  win: {
    ...build.win,
    executableName: 'HiWarp',
    artifactName: 'HiWarp windows-1.4.2-alpha.1-UD.Q Portable ${arch}.${ext}'
  },
  nsis: {
    ...build.nsis,
    guid: '8f5f3a42-3a99-4bb6-9f42-44a9f6df9b40',
    artifactName: 'HiWarp windows-1.4.2-alpha.1-UD.Q Setup ${arch}.${ext}'
  }
};
