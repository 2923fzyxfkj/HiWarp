const {build} = require('./package.json');

module.exports = {
  ...build,
  appId: 'org.hiwarp.desktop.alpha',
  productName: 'HiWarp Linux-2.2.7-alp.1',
  executableName: 'hiwarp',
  extraMetadata: {
    name: 'hiwarp-desktop',
    productName: 'HiWarp Linux-2.2.7-alp.1',
    version: '2.2.7-alp.1'
  },
  linux: {
    ...build.linux,
    executableName: 'hiwarp',
    artifactName: 'HiWarp Linux-2.2.7-${arch}-alp.1.${ext}',
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
