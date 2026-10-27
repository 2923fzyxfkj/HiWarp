const {build} = require('./package.json');

module.exports = {
  ...build,
  appId: 'org.hiwarp.desktop.alpha',
  productName: 'HiWarp windows-2.3.7-alp.1',
  executableName: 'HiWarp',
  extraMetadata: {
    name: 'hiwarp-desktop',
    productName: 'HiWarp windows-2.3.7-alp.1',
    version: '2.3.7-alp.1'
  },
  win: {
    ...build.win,
    executableName: 'HiWarp',
    artifactName: 'HiWarp windows-2.3.7-alp.1 Portable ${arch}.${ext}'
  },
  nsis: {
    ...build.nsis,
    guid: '8f5f3a42-3a99-4bb6-9f42-44a9f6df9b40',
    artifactName: 'HiWarp windows-2.3.7-alp.1 Setup ${arch}.${ext}'
  }
};
