const {build} = require('./package.json');

module.exports = {
  ...build,
  appId: 'org.hiwarp.desktop.alpha',
  productName: 'HiWarp Linux-1.4.2-alpha.1-UD.Q',
  executableName: 'hiwarp',
  extraMetadata: {
    name: 'hiwarp-desktop',
    productName: 'HiWarp Linux-1.4.2-alpha.1-UD.Q',
    version: '1.4.2-alpha.1-UD.Q'
  },
  linux: {
    ...build.linux,
    executableName: 'hiwarp',
    artifactName: 'HiWarp Linux-1.4.2-${arch}-alpha.1-UD.Q.${ext}',
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
