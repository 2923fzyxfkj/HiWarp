function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
import PropTypes from 'prop-types';
import React from 'react';
import { connect } from 'react-redux';
import bindAll from 'lodash.bindall';
import ProjectEncryptionModal from '../components/hiwarp-project-encryption-modal/project-encryption-modal.jsx';
import downloadBlob from '../lib/download-blob';
import hiwarpProjectEncryption from 'scratch-vm/src/util/hiwarp-project-encryption';
import { closeProjectEncryptionModal } from '../reducers/modals';
import { projectTitleInitialState } from '../reducers/project-title';
const getProjectFilename = title => "".concat((title || projectTitleInitialState).substring(0, 100), ".sb3");
class ProjectEncryptionModalContainer extends React.Component {
  constructor(props) {
    super(props);
    bindAll(this, ['handleChooseEncryptedProject', 'handleChooseKeyFile', 'handleHashAlgorithmChange', 'handleMediumChange', 'handlePasswordChange', 'handleSelectDecrypt', 'handleSelectEncrypt', 'handleSubmit', 'handleWrongCredentialPermissionChange']);
    this.state = {
      busy: false,
      detectedHashAlgorithm: '',
      encryptedProjectBuffer: null,
      encryptedProjectName: '',
      error: '',
      hashAlgorithm: 'SHA-256',
      keyFileBytes: null,
      keyFileName: '',
      medium: 'password',
      mode: 'encrypt',
      password: '',
      status: '',
      wrongCredentialPermissions: Object.assign({}, hiwarpProjectEncryption.DEFAULT_WRONG_CREDENTIAL_PERMISSIONS)
    };
  }
  setError(error) {
    this.setState({
      busy: false,
      error: error && error.message ? error.message : String(error),
      status: ''
    });
  }
  chooseFile(accept) {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept || '';
      input.style = 'display: none;';
      input.onchange = () => {
        const file = input.files && input.files[0];
        document.body.removeChild(input);
        resolve(file || null);
      };
      document.body.appendChild(input);
      input.click();
    });
  }
  async handleChooseEncryptedProject() {
    const file = await this.chooseFile('.sb3');
    if (!file) {
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      const manifest = await hiwarpProjectEncryption.getEncryptedManifestFromSb3(buffer);
      if (!manifest) {
        throw new Error('这不是 HiWarp 加密作品。');
      }
      this.setState({
        detectedHashAlgorithm: manifest.hashAlgorithm,
        encryptedProjectBuffer: buffer,
        encryptedProjectName: file.name,
        error: '',
        status: '已识别加密作品。'
      });
    } catch (error) {
      this.setError(error);
    }
  }
  async handleChooseKeyFile() {
    const file = await this.chooseFile('');
    if (!file) {
      return;
    }
    this.setState({
      keyFileBytes: new Uint8Array(await file.arrayBuffer()),
      keyFileName: file.name,
      error: '',
      status: '已选择密钥文件。'
    });
  }
  handleHashAlgorithmChange(event) {
    this.setState({
      hashAlgorithm: event.target.value
    });
  }
  handleMediumChange(event) {
    this.setState({
      medium: event.target.value
    });
  }
  handlePasswordChange(event) {
    this.setState({
      password: event.target.value
    });
  }
  handleWrongCredentialPermissionChange(permission) {
    this.setState(state => ({
      wrongCredentialPermissions: Object.assign({}, state.wrongCredentialPermissions, {
        [permission]: !state.wrongCredentialPermissions[permission]
      })
    }));
  }
  handleSelectDecrypt() {
    this.setState({
      mode: 'decrypt',
      error: '',
      status: ''
    });
  }
  handleSelectEncrypt() {
    this.setState({
      mode: 'encrypt',
      error: '',
      status: ''
    });
  }
  async getPassword() {
    const algorithm = this.state.mode === 'decrypt' ? this.state.detectedHashAlgorithm : this.state.hashAlgorithm;
    if (this.state.medium === 'password') {
      if (!this.state.password) {
        throw new Error('请输入密码。');
      }
      return this.state.password;
    }
    if (!this.state.keyFileBytes) {
      throw new Error('请选择密钥文件。');
    }
    return hiwarpProjectEncryption.keyFileToPassword(this.state.keyFileBytes, algorithm);
  }
  async handleSubmit() {
    try {
      this.setState({
        busy: true,
        error: '',
        status: '正在处理...'
      });
      const password = await this.getPassword();
      if (this.state.mode === 'encrypt') {
        const content = await this.props.vm.saveEncryptedProjectSb3({
          hashAlgorithm: this.state.hashAlgorithm,
          password,
          wrongCredentialPermissions: this.state.wrongCredentialPermissions
        });
        downloadBlob(getProjectFilename(this.props.projectTitle), content);
        this.setState({
          busy: false,
          status: '已导出加密作品。'
        });
        return;
      }
      if (!this.state.encryptedProjectBuffer) {
        throw new Error('请选择要解密的 SB3 文件。');
      }
      const result = await hiwarpProjectEncryption.decryptSb3Buffer(this.state.encryptedProjectBuffer, password);
      downloadBlob(this.state.encryptedProjectName.replace(/\.sb3$/i, '-decrypted.sb3'), new Blob([result.data], {
        type: 'application/x.scratch.sb3'
      }));
      this.setState({
        busy: false,
        status: '已导出解密作品。'
      });
    } catch (error) {
      this.setError(error);
    }
  }
  render() {
    return /*#__PURE__*/React.createElement(ProjectEncryptionModal, _extends({}, this.state, {
      hashAlgorithms: hiwarpProjectEncryption.SUPPORTED_HASHES,
      onChooseEncryptedProject: this.handleChooseEncryptedProject,
      onChooseKeyFile: this.handleChooseKeyFile,
      onHashAlgorithmChange: this.handleHashAlgorithmChange,
      onMediumChange: this.handleMediumChange,
      onPasswordChange: this.handlePasswordChange,
      onRequestClose: this.props.onRequestClose,
      onSelectDecrypt: this.handleSelectDecrypt,
      onSelectEncrypt: this.handleSelectEncrypt,
      onSubmit: this.handleSubmit,
      onWrongCredentialPermissionChange: this.handleWrongCredentialPermissionChange
    }));
  }
}
ProjectEncryptionModalContainer.propTypes = {
  projectTitle: PropTypes.string,
  vm: PropTypes.shape({
    saveEncryptedProjectSb3: PropTypes.func
  }),
  onRequestClose: PropTypes.func
};
const mapStateToProps = state => ({
  projectTitle: state.scratchGui.projectTitle,
  vm: state.scratchGui.vm
});
const mapDispatchToProps = dispatch => ({
  onRequestClose: () => dispatch(closeProjectEncryptionModal())
});
export default connect(mapStateToProps, mapDispatchToProps)(ProjectEncryptionModalContainer);