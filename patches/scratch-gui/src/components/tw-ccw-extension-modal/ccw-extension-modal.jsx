function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
import { defineMessages, FormattedMessage, intlShape, injectIntl } from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';
import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';
import Spinner from '../spinner/spinner.jsx';
import styles from './ccw-extension-modal.css';
const messages = defineMessages({
  title: {
    defaultMessage: '加载CCW扩展',
    description: 'Title of CCW extension loader modal',
    id: 'tw.ccwExtensionModal.title'
  },
  description: {
    defaultMessage: '从共创世界加载扩展，可从 https://assets.ccw.site/extensions 获取。',
    description: 'Description of CCW extension loader modal',
    id: 'tw.ccwExtensionModal.description'
  },
  prompt: {
    defaultMessage: '输入CCW扩展ID：',
    description: 'Label that appears when loading a CCW extension by ID',
    id: 'tw.ccwExtensionModal.prompt'
  },
  lookup: {
    defaultMessage: '查询',
    description: 'Button to fetch CCW extension metadata',
    id: 'tw.ccwExtensionModal.lookup'
  },
  publisher: {
    defaultMessage: '发布者：{publisher}',
    description: 'Publisher label in CCW extension loader',
    id: 'tw.ccwExtensionModal.publisher'
  },
  version: {
    defaultMessage: '版本：',
    description: 'Version selector label in CCW extension loader',
    id: 'tw.ccwExtensionModal.version'
  },
  latest: {
    defaultMessage: '最新',
    description: 'Latest version marker in CCW extension loader',
    id: 'tw.ccwExtensionModal.latest'
  },
  asset: {
    defaultMessage: '资源：{asset}',
    description: 'Asset URL label in CCW extension loader',
    id: 'tw.ccwExtensionModal.asset'
  },
  cancel: {
    defaultMessage: '取消',
    description: 'Button that cancels loading a CCW extension',
    id: 'tw.ccwExtensionModal.cancel'
  },
  confirm: {
    defaultMessage: '确认',
    description: 'Button that confirms loading a CCW extension',
    id: 'tw.ccwExtensionModal.confirm'
  }
});
const CCWExtensionModal = props => {
  var _props$metadata, _props$metadata2, _props$metadata3;
  const versions = Array.isArray((_props$metadata = props.metadata) === null || _props$metadata === void 0 ? void 0 : _props$metadata.versions) ? props.metadata.versions : [];
  const selectedVersion = versions[props.selectedVersionIndex] || versions[0];
  const publisher = ((_props$metadata2 = props.metadata) === null || _props$metadata2 === void 0 || (_props$metadata2 = _props$metadata2.publisher) === null || _props$metadata2 === void 0 ? void 0 : _props$metadata2.nickname) || ((_props$metadata3 = props.metadata) === null || _props$metadata3 === void 0 ? void 0 : _props$metadata3.publisherId) || 'Unknown';
  return /*#__PURE__*/React.createElement(Modal, {
    className: styles.modalContent,
    onRequestClose: props.onClose,
    contentLabel: props.intl.formatMessage(messages.title),
    id: "ccwExtensionModal"
  }, /*#__PURE__*/React.createElement(Box, {
    className: styles.body
  }, /*#__PURE__*/React.createElement("h3", {
    className: styles.title
  }, /*#__PURE__*/React.createElement(FormattedMessage, messages.title)), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement(FormattedMessage, messages.description)), /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement(FormattedMessage, messages.prompt)), /*#__PURE__*/React.createElement("div", {
    className: styles.inputRow
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    className: styles.urlInput,
    value: props.extensionId,
    onChange: props.onChangeExtensionId,
    onKeyDown: props.onKeyDown,
    placeholder: "\u8F93\u5165\u6269\u5C55ID",
    disabled: props.loading,
    autoFocus: true
  }), /*#__PURE__*/React.createElement("button", {
    className: styles.lookupButton,
    onClick: props.onLookup,
    disabled: props.loading || !props.extensionId.trim()
  }, props.loading ? /*#__PURE__*/React.createElement(Spinner, {
    small: true
  }) : /*#__PURE__*/React.createElement(FormattedMessage, messages.lookup))), props.error ? /*#__PURE__*/React.createElement("div", {
    className: styles.errorMessage
  }, props.error) : null, props.metadata ? /*#__PURE__*/React.createElement("div", {
    className: styles.extensionInfo
  }, /*#__PURE__*/React.createElement("div", {
    className: styles.infoHeader
  }, props.metadata.cover ? /*#__PURE__*/React.createElement("img", {
    className: styles.cover,
    src: props.metadata.cover,
    draggable: false
  }) : null, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: styles.name
  }, props.metadata.name || props.metadata.eid), /*#__PURE__*/React.createElement("div", {
    className: styles.meta
  }, /*#__PURE__*/React.createElement(FormattedMessage, _extends({}, messages.publisher, {
    values: {
      publisher
    }
  }))))), props.metadata.description ? /*#__PURE__*/React.createElement("p", null, props.metadata.description) : null, /*#__PURE__*/React.createElement("p", null, /*#__PURE__*/React.createElement(FormattedMessage, messages.version)), /*#__PURE__*/React.createElement("select", {
    className: styles.versionSelect,
    value: props.selectedVersionIndex,
    onChange: props.onChangeVersion
  }, versions.map((version, index) => /*#__PURE__*/React.createElement("option", {
    key: version.id || version.version || index,
    value: index
  }, version.version || "#".concat(index + 1), index === 0 ? " (".concat(props.intl.formatMessage(messages.latest), ")") : ''))), selectedVersion !== null && selectedVersion !== void 0 && selectedVersion.assetUri ? /*#__PURE__*/React.createElement("div", {
    className: styles.assetUri
  }, /*#__PURE__*/React.createElement(FormattedMessage, _extends({}, messages.asset, {
    values: {
      asset: selectedVersion.assetUri
    }
  }))) : null) : null, /*#__PURE__*/React.createElement("div", {
    className: styles.buttonRow
  }, /*#__PURE__*/React.createElement("button", {
    className: styles.cancelButton,
    onClick: props.onClose,
    disabled: props.loading
  }, /*#__PURE__*/React.createElement(FormattedMessage, messages.cancel)), /*#__PURE__*/React.createElement("button", {
    className: styles.loadButton,
    onClick: props.onConfirm,
    disabled: props.loading || !(selectedVersion !== null && selectedVersion !== void 0 && selectedVersion.assetUri)
  }, /*#__PURE__*/React.createElement(FormattedMessage, messages.confirm)))));
};
CCWExtensionModal.propTypes = {
  error: PropTypes.string,
  extensionId: PropTypes.string.isRequired,
  intl: intlShape,
  loading: PropTypes.bool.isRequired,
  metadata: PropTypes.object,
  onChangeExtensionId: PropTypes.func.isRequired,
  onChangeVersion: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func.isRequired,
  onLookup: PropTypes.func.isRequired,
  selectedVersionIndex: PropTypes.number.isRequired
};
export default injectIntl(CCWExtensionModal);