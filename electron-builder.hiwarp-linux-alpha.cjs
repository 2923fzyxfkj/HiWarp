const {build} = require('./package.json');

module.exports = {
  ...build,
  appId: 'org.hiwarp.desktop.alpha',
  productName: 'HiWarp Linux-1.2.2-alpha.1',
  executableName: 'hiwarp',
  extraMetadata: {
    name: 'hiwarp-desktop',
    productName: 'HiWarp Linux-1.2.2-alpha.1',
    version: '1.2.2-alpha.1'
  },
  linux: {
    ...build.linux,
    executableName: 'hiwarp',
    artifactName: 'HiWarp Linux-1.2.2-${arch}-alpha.1.${ext}',
    target: [
      {
        target: 'deb',
        arch: 'x64'
      },
      {
        target: 'AppImage',
        arch: 'x64'
      },
      {
        target: 'tar.gz',
        arch: 'x64'
      }
    ]
  }
};
