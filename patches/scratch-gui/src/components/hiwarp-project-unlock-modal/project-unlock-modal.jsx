import PropTypes from 'prop-types';
import React from 'react';
import Modal from '../../containers/modal.jsx';
import styles from './project-unlock-modal.css';
const ProjectUnlockModal = props => /*#__PURE__*/React.createElement(Modal, {
  className: styles.modal,
  contentLabel: "\u89E3\u9501\u52A0\u5BC6\u4F5C\u54C1",
  onRequestClose: props.onCancel
}, /*#__PURE__*/React.createElement("div", {
  className: styles.body
}, /*#__PURE__*/React.createElement("h2", {
  className: styles.title
}, "\u89E3\u9501 HiWarp \u52A0\u5BC6\u4F5C\u54C1"), /*#__PURE__*/React.createElement("p", {
  className: styles.intro
}, "\u8FD9\u4E2A\u4F5C\u54C1\u7684\u771F\u5B9E\u6E90\u7801\u5DF2\u52A0\u5BC6\u3002\u8F93\u5165\u6B63\u786E\u51ED\u636E\u540E\u4F1A\u5728\u5185\u5B58\u4E2D\u89E3\u5BC6\u5E76\u6253\u5F00\uFF1B\u51ED\u636E\u9519\u8BEF\u6216\u53D6\u6D88\u4F1A\u8FDB\u5165\u53D7\u9650\u5360\u4F4D\u6A21\u5F0F\u3002"), /*#__PURE__*/React.createElement("div", {
  className: styles.panel
}, /*#__PURE__*/React.createElement("div", {
  className: styles.field
}, /*#__PURE__*/React.createElement("div", {
  className: styles.label
}, "\u68C0\u6D4B\u5230\u7684\u5BC6\u7801\u52A0\u5BC6\u65B9\u5F0F"), /*#__PURE__*/React.createElement("input", {
  className: styles.input,
  readOnly: true,
  value: props.hashAlgorithm || 'SHA-256'
})), /*#__PURE__*/React.createElement("div", {
  className: styles.field
}, /*#__PURE__*/React.createElement("label", {
  className: styles.label,
  htmlFor: "hiwarp-unlock-medium"
}, "\u9009\u62E9\u89E3\u5BC6\u5A92\u4ECB"), /*#__PURE__*/React.createElement("select", {
  className: styles.select,
  id: "hiwarp-unlock-medium",
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
  htmlFor: "hiwarp-unlock-password"
}, "\u8F93\u5165\u5BC6\u7801"), /*#__PURE__*/React.createElement("input", {
  autoFocus: true,
  className: styles.input,
  id: "hiwarp-unlock-password",
  type: "password",
  value: props.password,
  onChange: props.onPasswordChange,
  onKeyDown: props.onPasswordKeyDown
})) : /*#__PURE__*/React.createElement("div", {
  className: styles.field
}, /*#__PURE__*/React.createElement("div", {
  className: styles.label
}, "\u4E0A\u4F20\u5BC6\u94A5\u6587\u4EF6"), /*#__PURE__*/React.createElement("div", {
  className: styles.fileRow
}, /*#__PURE__*/React.createElement("button", {
  className: styles.button,
  disabled: props.busy,
  onClick: props.onChooseKeyFile
}, "\u9009\u62E9\u6587\u4EF6"), /*#__PURE__*/React.createElement("span", {
  className: styles.fileName
}, props.keyFileName || '未选择'))), /*#__PURE__*/React.createElement("div", {
  className: styles.status
}, props.error || props.status), /*#__PURE__*/React.createElement("div", {
  className: styles.actions
}, /*#__PURE__*/React.createElement("button", {
  className: styles.button,
  disabled: props.busy,
  onClick: props.onCancel
}, "\u53D6\u6D88\u5E76\u8FDB\u5165\u53D7\u9650\u6A21\u5F0F"), /*#__PURE__*/React.createElement("button", {
  className: styles.primaryButton,
  disabled: props.busy,
  onClick: props.onUnlock
}, "\u89E3\u9501\u4F5C\u54C1")))));
ProjectUnlockModal.propTypes = {
  busy: PropTypes.bool,
  error: PropTypes.string,
  hashAlgorithm: PropTypes.string,
  keyFileName: PropTypes.string,
  medium: PropTypes.string,
  password: PropTypes.string,
  status: PropTypes.string,
  onCancel: PropTypes.func,
  onChooseKeyFile: PropTypes.func,
  onMediumChange: PropTypes.func,
  onPasswordChange: PropTypes.func,
  onPasswordKeyDown: PropTypes.func,
  onUnlock: PropTypes.func
};
export default ProjectUnlockModal;