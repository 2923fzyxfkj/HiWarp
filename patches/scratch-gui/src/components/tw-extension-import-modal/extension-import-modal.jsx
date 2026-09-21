function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
import { defineMessages, FormattedMessage, intlShape, injectIntl } from 'react-intl';
import PropTypes from 'prop-types';
import React from 'react';
import Box from '../box/box.jsx';
import Modal from '../../containers/modal.jsx';
import Spinner from '../spinner/spinner.jsx';
import styles from './extension-import-modal.css';
const messages = defineMessages({
  title: {
    defaultMessage: 'Choose Import Method',
    description: 'Title of extension import method selection modal',
    id: 'tw.extensionImportModal.title'
  },
  description: {
    defaultMessage: 'How would you like to import this extension?',
    description: 'Description for extension import method selection',
    id: 'tw.extensionImportModal.description'
  },
  batchDescription: {
    defaultMessage: 'How would you like to import these {count} extensions?',
    description: 'Description for batch extension import method selection',
    id: 'tw.extensionImportModal.batchDescription'
  },
  progress: {
    defaultMessage: 'Importing {current} / {total}',
    description: 'Progress text shown while importing extensions in batch',
    id: 'tw.extensionImportModal.progress'
  },
  normalImport: {
    defaultMessage: 'Normal Import',
    description: 'Button to import extension normally',
    id: 'tw.extensionImportModal.normalImport'
  },
  textImport: {
    defaultMessage: 'Import as Text',
    description: 'Button to import extension as text',
    id: 'tw.extensionImportModal.textImport'
  },
  cancel: {
    defaultMessage: 'Cancel',
    description: 'Button to cancel import',
    id: 'tw.extensionImportModal.cancel'
  }
});
const ExtensionImportModal = props => /*#__PURE__*/React.createElement(Modal, {
  className: styles.modalContent,
  onRequestClose: props.onClose,
  contentLabel: props.intl.formatMessage(messages.title),
  id: "extensionImportModal"
}, /*#__PURE__*/React.createElement(Box, {
  className: styles.body
}, /*#__PURE__*/React.createElement("h3", {
  className: styles.title
}, /*#__PURE__*/React.createElement(FormattedMessage, messages.title)), /*#__PURE__*/React.createElement("p", {
  className: styles.description
}, props.batchMode ? /*#__PURE__*/React.createElement(FormattedMessage, _extends({}, messages.batchDescription, {
  values: {
    count: props.itemCount
  }
})) : /*#__PURE__*/React.createElement(FormattedMessage, messages.description)), props.loading && props.batchMode && props.itemCount > 1 ? /*#__PURE__*/React.createElement("p", {
  className: styles.progressText
}, /*#__PURE__*/React.createElement(FormattedMessage, _extends({}, messages.progress, {
  values: {
    current: props.progressIndex || 1,
    total: props.itemCount
  }
}))) : null, props.error && /*#__PURE__*/React.createElement("div", {
  className: styles.errorMessage
}, props.error), /*#__PURE__*/React.createElement("div", {
  className: styles.buttonGroup
}, /*#__PURE__*/React.createElement("button", {
  className: styles.normalButton,
  onClick: props.onNormalImport,
  disabled: props.loading
}, props.loading ? /*#__PURE__*/React.createElement(Spinner, {
  small: true
}) : /*#__PURE__*/React.createElement(FormattedMessage, messages.normalImport)), /*#__PURE__*/React.createElement("button", {
  className: styles.textButton,
  onClick: props.onTextImport,
  disabled: props.loading
}, props.loading ? /*#__PURE__*/React.createElement(Spinner, {
  small: true
}) : /*#__PURE__*/React.createElement(FormattedMessage, messages.textImport)), /*#__PURE__*/React.createElement("button", {
  className: styles.cancelButton,
  onClick: props.onClose,
  disabled: props.loading
}, /*#__PURE__*/React.createElement(FormattedMessage, messages.cancel)))));
ExtensionImportModal.propTypes = {
  batchMode: PropTypes.bool,
  extensionName: PropTypes.string,
  itemCount: PropTypes.number,
  loading: PropTypes.bool,
  error: PropTypes.string,
  onClose: PropTypes.func,
  onNormalImport: PropTypes.func,
  onTextImport: PropTypes.func,
  progressIndex: PropTypes.number,
  intl: intlShape.isRequired
};
export default injectIntl(ExtensionImportModal);