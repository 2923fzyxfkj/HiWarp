function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
import PropTypes from 'prop-types';
import React from 'react';
import bindAll from 'lodash.bindall';
import ProjectUnlockModal from '../components/hiwarp-project-unlock-modal/project-unlock-modal.jsx';
import hiwarpProjectEncryption from 'scratch-vm/src/util/hiwarp-project-encryption';
class ProjectUnlockModalContainer extends React.Component {
  constructor(props) {
    super(props);
    bindAll(this, ['chooseFile', 'handleChooseKeyFile', 'handleMediumChange', 'handlePasswordChange', 'handlePasswordKeyDown', 'handleUnlock']);
    this.state = {
      busy: false,
      error: '',
      keyFileBytes: null,
      keyFileName: '',
      medium: 'password',
      password: '',
      status: ''
    };
  }
  chooseFile() {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file';
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
  async handleChooseKeyFile() {
    const file = await this.chooseFile();
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
  handleMediumChange(event) {
    this.setState({
      medium: event.target.value,
      error: '',
      status: ''
    });
  }
  handlePasswordChange(event) {
    this.setState({
      password: event.target.value,
      error: ''
    });
  }
  handlePasswordKeyDown(event) {
    if (event.key === 'Enter') {
      this.handleUnlock();
    }
  }
  async getPassword() {
    if (this.state.medium === 'password') {
      if (!this.state.password) {
        throw new Error('请输入密码。');
      }
      return this.state.password;
    }
    if (!this.state.keyFileBytes) {
      throw new Error('请选择密钥文件。');
    }
    return hiwarpProjectEncryption.keyFileToPassword(this.state.keyFileBytes, this.props.hashAlgorithm);
  }
  async handleUnlock() {
    try {
      this.setState({
        busy: true,
        error: '',
        status: '正在解密...'
      });
      const password = await this.getPassword();
      await this.props.onUnlock(password);
    } catch (error) {
      this.setState({
        busy: false,
        error: error && error.message ? error.message : String(error),
        status: ''
      });
    }
  }
  render() {
    return /*#__PURE__*/React.createElement(ProjectUnlockModal, _extends({}, this.state, {
      hashAlgorithm: this.props.hashAlgorithm,
      onCancel: this.props.onCancel,
      onChooseKeyFile: this.handleChooseKeyFile,
      onMediumChange: this.handleMediumChange,
      onPasswordChange: this.handlePasswordChange,
      onPasswordKeyDown: this.handlePasswordKeyDown,
      onUnlock: this.handleUnlock
    }));
  }
}
ProjectUnlockModalContainer.propTypes = {
  hashAlgorithm: PropTypes.string,
  onCancel: PropTypes.func,
  onUnlock: PropTypes.func
};
export default ProjectUnlockModalContainer;