import PropTypes from 'prop-types';
import React from 'react';
import Modal from '../../containers/modal.jsx';
import styles from './project-encryption-modal.css';
const ProjectEncryptionModal = props => /*#__PURE__*/React.createElement(Modal, {
  className: styles.modal,
  contentLabel: "\u4F5C\u54C1\u52A0\u5BC6",
  onRequestClose: props.onRequestClose
}, /*#__PURE__*/React.createElement("div", {
  className: styles.body
}, /*#__PURE__*/React.createElement("p", {
  className: styles.intro
}, "\u52A0\u5BC6\u5BFC\u51FA\u7684 SB3 \u53EA\u80FD\u7531 HiWarp \u89E3\u5BC6\u6253\u5F00\uFF1B\u5176\u4ED6\u7F16\u8F91\u5668\u4F1A\u8BC6\u522B\u4E3A\u65E0\u6548\u9879\u76EE\u3002"), /*#__PURE__*/React.createElement("div", {
  className: styles.tabs
}, /*#__PURE__*/React.createElement("button", {
  className: props.mode === 'encrypt' ? "".concat(styles.tab, " ").concat(styles.tabActive) : styles.tab,
  onClick: props.onSelectEncrypt
}, "\u5BFC\u51FA\u52A0\u5BC6\u4F5C\u54C1"), /*#__PURE__*/React.createElement("button", {
  className: props.mode === 'decrypt' ? "".concat(styles.tab, " ").concat(styles.tabActive) : styles.tab,
  onClick: props.onSelectDecrypt
}, "\u5BFC\u51FA\u89E3\u5BC6\u4F5C\u54C1")), /*#__PURE__*/React.createElement("div", {
  className: styles.panel
}, props.mode === 'decrypt' && /*#__PURE__*/React.createElement("div", {
  className: styles.field
}, /*#__PURE__*/React.createElement("div", {
  className: styles.label
}, "\u9009\u62E9\u52A0\u5BC6 SB3"), /*#__PURE__*/React.createElement("div", {
  className: styles.fileRow
}, /*#__PURE__*/React.createElement("button", {
  className: styles.button,
  onClick: props.onChooseEncryptedProject
}, "\u9009\u62E9\u6587\u4EF6"), /*#__PURE__*/React.createElement("span", {
  className: styles.fileName
}, props.encryptedProjectName || '未选择'))), /*#__PURE__*/React.createElement("div", {
  className: styles.field
}, /*#__PURE__*/React.createElement("label", {
  className: styles.label,
  htmlFor: "hiwarp-encryption-medium"
}, props.mode === 'encrypt' ? '选择加密媒介' : '选择解密媒介'), /*#__PURE__*/React.createElement("select", {
  className: styles.select,
  id: "hiwarp-encryption-medium",
  value: props.medium,
  onChange: props.onMediumChange
}, /*#__PURE__*/React.createElement("option", {
  value: "password"
}, "\u5BC6\u7801"), /*#__PURE__*/React.createElement("option", {
  value: "key"
}, "\u5BC6\u94A5"))), props.medium === 'password' ? /*#__PURE__*/React.createElement("div", {
  className: styles.field
}, /*#__PURE__*/React.createElement("label", {
  className: styles.label,
  htmlFor: "hiwarp-encryption-password"
}, props.mode === 'encrypt' ? '设置密码' : '输入密码'), /*#__PURE__*/React.createElement("input", {
  className: styles.input,
  id: "hiwarp-encryption-password",
  type: "password",
  value: props.password,
  onChange: props.onPasswordChange
})) : /*#__PURE__*/React.createElement("div", {
  className: styles.field
}, /*#__PURE__*/React.createElement("div", {
  className: styles.label
}, "\u4E0A\u4F20\u5BC6\u94A5\u6587\u4EF6"), /*#__PURE__*/React.createElement("div", {
  className: styles.fileRow
}, /*#__PURE__*/React.createElement("button", {
  className: styles.button,
  onClick: props.onChooseKeyFile
}, "\u9009\u62E9\u6587\u4EF6"), /*#__PURE__*/React.createElement("span", {
  className: styles.fileName
}, props.keyFileName || '未选择'))), props.mode === 'encrypt' ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
  className: styles.field
}, /*#__PURE__*/React.createElement("label", {
  className: styles.label,
  htmlFor: "hiwarp-encryption-hash"
}, "\u9009\u62E9\u5BC6\u7801\u52A0\u5BC6\u65B9\u5F0F"), /*#__PURE__*/React.createElement("select", {
  className: styles.select,
  id: "hiwarp-encryption-hash",
  value: props.hashAlgorithm,
  onChange: props.onHashAlgorithmChange
}, props.hashAlgorithms.map(algorithm => /*#__PURE__*/React.createElement("option", {
  key: algorithm,
  value: algorithm
}, algorithm)))), /*#__PURE__*/React.createElement("div", {
  className: styles.field
}, /*#__PURE__*/React.createElement("div", {
  className: styles.label
}, "\u5F53\u51ED\u636E\u9519\u8BEF\u65F6\u53EF\u4EE5..."), /*#__PURE__*/React.createElement("div", {
  className: styles.checkboxGrid
}, /*#__PURE__*/React.createElement("label", {
  className: styles.checkboxLabel
}, /*#__PURE__*/React.createElement("input", {
  checked: props.wrongCredentialPermissions.viewSource,
  type: "checkbox",
  onChange: () => props.onWrongCredentialPermissionChange('viewSource')
}), "\u67E5\u770B\u6E90\u4EE3\u7801"), /*#__PURE__*/React.createElement("label", {
  className: styles.checkboxLabel
}, /*#__PURE__*/React.createElement("input", {
  checked: props.wrongCredentialPermissions.runProject,
  type: "checkbox",
  onChange: () => props.onWrongCredentialPermissionChange('runProject')
}), "\u8FD0\u884C\u4F5C\u54C1"), /*#__PURE__*/React.createElement("label", {
  className: styles.checkboxLabel
}, /*#__PURE__*/React.createElement("input", {
  checked: props.wrongCredentialPermissions.exportProject,
  type: "checkbox",
  onChange: () => props.onWrongCredentialPermissionChange('exportProject')
}), "\u5BFC\u51FA\u4F5C\u54C1"), /*#__PURE__*/React.createElement("label", {
  className: styles.checkboxLabel
}, /*#__PURE__*/React.createElement("input", {
  checked: props.wrongCredentialPermissions.editSource,
  type: "checkbox",
  onChange: () => props.onWrongCredentialPermissionChange('editSource')
}), "\u7F16\u8F91\u6E90\u4EE3\u7801")))) : /*#__PURE__*/React.createElement("div", {
  className: styles.field
}, /*#__PURE__*/React.createElement("div", {
  className: styles.label
}, "\u68C0\u6D4B\u5230\u7684\u5BC6\u7801\u52A0\u5BC6\u65B9\u5F0F"), /*#__PURE__*/React.createElement("input", {
  className: styles.input,
  readOnly: true,
  value: props.detectedHashAlgorithm || '选择加密 SB3 后自动检测'
})), /*#__PURE__*/React.createElement("div", {
  className: props.error ? "".concat(styles.status, " ").concat(styles.error) : styles.status
}, props.error || props.status), /*#__PURE__*/React.createElement("div", {
  className: styles.actions
}, /*#__PURE__*/React.createElement("button", {
  className: styles.button,
  onClick: props.onRequestClose
}, "\u5173\u95ED"), /*#__PURE__*/React.createElement("button", {
  className: styles.primaryButton,
  disabled: props.busy,
  onClick: props.onSubmit
}, props.mode === 'encrypt' ? '导出加密后的作品（SB3）' : '导出解密后的作品（SB3）')))));
ProjectEncryptionModal.propTypes = {
  busy: PropTypes.bool,
  detectedHashAlgorithm: PropTypes.string,
  encryptedProjectName: PropTypes.string,
  error: PropTypes.string,
  hashAlgorithm: PropTypes.string,
  hashAlgorithms: PropTypes.arrayOf(PropTypes.string),
  keyFileName: PropTypes.string,
  medium: PropTypes.string,
  mode: PropTypes.string,
  password: PropTypes.string,
  status: PropTypes.string,
  wrongCredentialPermissions: PropTypes.shape({
    editSource: PropTypes.bool,
    exportProject: PropTypes.bool,
    runProject: PropTypes.bool,
    viewSource: PropTypes.bool
  }),
  onChooseEncryptedProject: PropTypes.func,
  onChooseKeyFile: PropTypes.func,
  onHashAlgorithmChange: PropTypes.func,
  onMediumChange: PropTypes.func,
  onPasswordChange: PropTypes.func,
  onRequestClose: PropTypes.func,
  onSelectDecrypt: PropTypes.func,
  onSelectEncrypt: PropTypes.func,
  onSubmit: PropTypes.func,
  onWrongCredentialPermissionChange: PropTypes.func
};
export default ProjectEncryptionModal;