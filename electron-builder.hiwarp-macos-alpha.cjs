const {build} = require('./package.json');

module.exports = {
  ...build,
  appId: 'org.hiwarp.desktop.alpha',
  productName: 'HiWarp macOS-1.2.2-universal-alpha.1',
  executableName: 'HiWarp',
  extraMetadata: {
    name: 'hiwarp-desktop',
    productName: 'HiWarp macOS-1.2.2-universal-alpha.1',
    version: '1.2.2-alpha.1'
  },
  mac: {
    ...build.mac,
    artifactName: 'HiWarp macOS-1.2.2-universal-alpha.1.${ext}',
    target: [
      {
        target: 'dmg',
        arch: 'universal'
      }
    ]
  }
};
