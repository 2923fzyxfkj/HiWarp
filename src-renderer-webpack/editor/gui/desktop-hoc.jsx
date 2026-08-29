import React from 'react';
import {connect} from 'react-redux';
import PropTypes from 'prop-types';
import {
  openLoadingProject,
  closeLoadingProject,
  openInvalidProjectModal
} from 'scratch-gui/src/reducers/modals';
import {
  requestProjectUpload,
  setProjectId,
  defaultProjectId,
  onFetchedProjectData,
  onLoadedProject,
  requestNewProject
} from 'scratch-gui/src/reducers/project-state';
import {
  setFileHandle,
  setUsername,
  setProjectError,
  setRestrictedProjectMode
} from 'scratch-gui/src/reducers/tw';
import {setPlayer} from 'scratch-gui/src/reducers/mode';
import {activateTab, BLOCKS_TAB_INDEX} from 'scratch-gui/src/reducers/editor-tab';
import {WrappedFileHandle} from './filesystem-api.js';
import {setStrings} from '../prompt/prompt.js';
import AIChatSidebar from './ai-sidebar.jsx';
import ScratchTextSidebar from '../scratch-text/sidebar.jsx';
import hiwarpProjectEncryption from 'scratch-vm/src/util/hiwarp-project-encryption';
import ProjectUnlockModal from 'scratch-gui/src/containers/hiwarp-project-unlock-modal.jsx';

let mountedOnce = false;

/**
 * @param {string} filename
 * @returns {string}
 */
const getDefaultProjectTitle = (filename) => {
  const match = filename.match(/([^/\\]+)\.sb[23]?$/);
  if (!match) return filename;
  return match[1];
};

const handleClickAddonSettings = (search) => {
  EditorPreload.openAddonSettings(typeof search === 'string' ? search : null);
};

const handleClickNewWindow = () => {
  EditorPreload.openNewWindow();
};

const handleClickPackager = () => {
  EditorPreload.openPackager();
};

const handleClickDesktopSettings = () => {
  EditorPreload.openDesktopSettings();
};

const handleClickPrivacy = () => {
  EditorPreload.openPrivacy();
};

const handleClickAbout = () => {
  EditorPreload.openAbout();
};

const handleClickSourceCode = () => {
  window.open('https://github.com/2923fzyxfkj/HiWarp');
};

const securityManager = {
  // Everything not specified here falls back to the scratch-gui security manager

  // Managed by Electron main process:
  canReadClipboard: () => true,
  canNotify: () => true,

  // Does not work in Electron:
  canGeolocate: () => false
};

const USERNAME_KEY = 'tw:username';
const DEFAULT_USERNAME = 'player';

const DesktopHOC = function (WrappedComponent) {
  class DesktopComponent extends React.Component {
    constructor (props) {
      super(props);
      this.state = {
        title: '',
        unlockRequest: null
      };
      this.handleUpdateProjectTitle = this.handleUpdateProjectTitle.bind(this);
      this.handleUnlockCancel = this.handleUnlockCancel.bind(this);
      this.handleUnlockSubmit = this.handleUnlockSubmit.bind(this);

      // Changing locale always re-mounts this component
      const stateFromMain = EditorPreload.setLocale(this.props.locale);
      this.messages = stateFromMain.strings;
      setStrings({
        ok: this.messages['prompt.ok'],
        cancel: this.messages['prompt.cancel']
      });

      const storedUsername = localStorage.getItem(USERNAME_KEY);
      if (typeof storedUsername === 'string') {
        this.props.onSetReduxUsername(storedUsername);
      } else {
        this.props.onSetReduxUsername(DEFAULT_USERNAME);
      }
    }
    componentDidMount () {
      EditorPreload.setRestrictedProjectMode(this.props.restrictedProjectMode);
      EditorPreload.setExportForPackager(() => {
        if (this.props.restrictedProjectMode &&
          this.props.restrictedProjectMode.active &&
          !this.props.restrictedProjectMode.permissions.exportProject) {
          return Promise.reject(new Error('受限模式禁止导出作品。'));
        }
        return this.props.vm.saveProjectSb3('arraybuffer')
          .then((buffer) => ({
          name: this.state.title,
          data: buffer
          }));
      });

      // This component is re-mounted when the locale changes, but we only want to load
      // the initial project once.
      if (mountedOnce) {
        return;
      }
      mountedOnce = true;

      this.props.onLoadingStarted();
      (async () => {
        // Note that 0 is a valid ID and does mean there is a file open
        const id = await EditorPreload.getInitialFile();
        if (id === null) {
          this.props.onHasInitialProject(false, this.props.loadingState);
          this.props.onLoadingCompleted();
          return;
        }

        this.props.onHasInitialProject(true, this.props.loadingState);
        const {name, type, data} = await EditorPreload.getFile(id);

        const projectData = await this.decryptProjectIfNeeded(data);
        await this.props.vm.loadProject(projectData);
        this.props.onLoadingCompleted();
        this.props.onLoadedProject(this.props.loadingState, true);

        const title = getDefaultProjectTitle(name);
        if (title) {
          this.setState({
            title
          });
        }

        if (type === 'file' && name.endsWith('.sb3')) {
          this.props.onSetFileHandle(new WrappedFileHandle(id, name));
        }
      })().catch(error => {
        console.error(error);

        this.props.onShowErrorModal(error);
        this.props.onLoadingCompleted();
        this.props.onLoadedProject(this.props.loadingState, false);
        this.props.onHasInitialProject(false, this.props.loadingState);
        this.props.onRequestNewProject();
      });
    }
    componentDidUpdate (prevProps, prevState) {
      if (this.props.projectChanged !== prevProps.projectChanged) {
        EditorPreload.setChanged(this.props.projectChanged);
      }

      if (this.props.restrictedProjectMode !== prevProps.restrictedProjectMode) {
        EditorPreload.setRestrictedProjectMode(this.props.restrictedProjectMode);
      }

      if (this.state.title !== prevState.title) {
        document.title = this.state.title;
      }

      if (this.props.fileHandle !== prevProps.fileHandle) {
        if (this.props.fileHandle) {
          EditorPreload.openedFile(this.props.fileHandle.id);
        } else {
          EditorPreload.closedFile();
        }
      }

      if (this.props.reduxUsername !== prevProps.reduxUsername) {
        localStorage.setItem(USERNAME_KEY, this.props.reduxUsername);
      }

      if (this.props.isFullScreen !== prevProps.isFullScreen) {
        EditorPreload.setIsFullScreen(this.props.isFullScreen);
      }
    }
    handleUpdateProjectTitle (newTitle) {
      this.setState({
        title: newTitle
      });
    }
    enterRestrictedMode (manifest, reason) {
      const permissions = hiwarpProjectEncryption.normalizeWrongCredentialPermissions(
        manifest && manifest.wrongCredentialPermissions
      );
      this.props.onSetRestrictedProjectMode({
        active: true,
        reason,
        permissions
      });
      if (!permissions.viewSource) {
        this.props.onSetPlayerOnly(true);
      }
      this.props.onActivateBlocksTab();
      if (!permissions.runProject) {
        this.props.vm.stopAll();
      }
      return hiwarpProjectEncryption.createFallbackProject(manifest);
    }
    handleUnlockCancel () {
      const request = this.state.unlockRequest;
      if (!request) {
        return;
      }
      this.setState({unlockRequest: null});
      request.resolve(this.enterRestrictedMode(request.manifest, '已取消解密，已进入受限模式。'));
    }
    async handleUnlockSubmit (password) {
      const request = this.state.unlockRequest;
      if (!request) {
        return;
      }
      try {
        const result = await hiwarpProjectEncryption.decryptSb3Buffer(request.projectData, password);
        this.props.onSetRestrictedProjectMode(null);
        this.setState({unlockRequest: null});
        request.resolve(result.data);
      } catch (error) {
        this.setState({unlockRequest: null});
        request.resolve(this.enterRestrictedMode(request.manifest, '凭据错误，已进入受限模式。'));
      }
    }
    requestProjectUnlock (projectData, manifest) {
      return new Promise(resolve => {
        this.setState({
          unlockRequest: {
            projectData,
            manifest,
            resolve
          }
        });
      });
    }
    async decryptProjectIfNeeded (projectData) {
      const info = await hiwarpProjectEncryption.getEncryptedProjectInfo(projectData);
      if (!info.encrypted) {
        this.props.onSetRestrictedProjectMode(null);
        return projectData;
      }
      return this.requestProjectUnlock(projectData, info.manifest);
    }
    render() {
      const {
        locale,
        loadingState,
        projectChanged,
        fileHandle,
        reduxUsername,
        onFetchedInitialProjectData,
        onHasInitialProject,
        onLoadedProject,
        onLoadingCompleted,
        onLoadingStarted,
        onRequestNewProject,
        onSetRestrictedProjectMode,
        onSetPlayerOnly,
        onActivateBlocksTab,
        onSetFileHandle,
        onSetReduxUsername,
        onShowErrorModal,
        vm,
        ...props
      } = this.props;
      return (
        <React.Fragment>
        <WrappedComponent
          projectTitle={this.state.title}
          onUpdateProjectTitle={this.handleUpdateProjectTitle}
          onClickAddonSettings={handleClickAddonSettings}
          onClickNewWindow={handleClickNewWindow}
          onClickPackager={handleClickPackager}
          onClickAbout={[
            {
              title: this.messages['in-app-about.desktop-settings'],
              onClick: handleClickDesktopSettings
            },
            {
              title: this.messages['in-app-about.privacy'],
              onClick: handleClickPrivacy
            },
            {
              title: this.messages['in-app-about.about'],
              onClick: handleClickAbout
            },
            {
              title: this.messages['in-app-about.source-code'],
              onClick: handleClickSourceCode
            },
          ]}
          onClickDesktopSettings={handleClickDesktopSettings}
          securityManager={securityManager}
          {...props}
        />
        {!(this.props.restrictedProjectMode && this.props.restrictedProjectMode.active) ? (
          <AIChatSidebar vm={vm} />
        ) : null}
        {!(this.props.restrictedProjectMode && this.props.restrictedProjectMode.active) ? (
          <ScratchTextSidebar vm={vm} />
        ) : null}
        {this.state.unlockRequest ? (
          <ProjectUnlockModal
            hashAlgorithm={this.state.unlockRequest.manifest.hashAlgorithm}
            onCancel={this.handleUnlockCancel}
            onUnlock={this.handleUnlockSubmit}
          />
        ) : null}
        </React.Fragment>
      );
    }
  }

  DesktopComponent.propTypes = {
    locale: PropTypes.string.isRequired,
    loadingState: PropTypes.string.isRequired,
    projectChanged: PropTypes.bool.isRequired,
    fileHandle: PropTypes.shape({
      id: PropTypes.string.isRequired
    }),
    isFullScreen: PropTypes.bool.isRequired,
    reduxUsername: PropTypes.string.isRequired,
    restrictedProjectMode: PropTypes.shape({
      active: PropTypes.bool,
      permissions: PropTypes.shape({
        exportProject: PropTypes.bool
      })
    }),
    onFetchedInitialProjectData: PropTypes.func.isRequired,
    onHasInitialProject: PropTypes.func.isRequired,
    onLoadedProject: PropTypes.func.isRequired,
    onLoadingCompleted: PropTypes.func.isRequired,
    onLoadingStarted: PropTypes.func.isRequired,
    onRequestNewProject: PropTypes.func.isRequired,
    onSetRestrictedProjectMode: PropTypes.func.isRequired,
    onSetPlayerOnly: PropTypes.func.isRequired,
    onActivateBlocksTab: PropTypes.func.isRequired,
    onSetFileHandle: PropTypes.func.isRequired,
    onSetReduxUsername: PropTypes.func.isRequired,
    onShowErrorModal: PropTypes.func.isRequired,
    vm: PropTypes.shape({
      loadProject: PropTypes.func.isRequired,
      stopAll: PropTypes.func.isRequired
    }).isRequired
  };

  const mapStateToProps = state => ({
    locale: state.locales.locale,
    loadingState: state.scratchGui.projectState.loadingState,
    isFullScreen: state.scratchGui.mode.isFullScreen,
    projectChanged: state.scratchGui.projectChanged,
    fileHandle: state.scratchGui.tw.fileHandle,
    restrictedProjectMode: state.scratchGui.tw.restrictedProjectMode,
    reduxUsername: state.scratchGui.tw.username,
    vm: state.scratchGui.vm
  });

  const mapDispatchToProps = dispatch => ({
    onLoadingStarted: () => dispatch(openLoadingProject()),
    onLoadingCompleted: () => dispatch(closeLoadingProject()),
    onHasInitialProject: (hasInitialProject, loadingState) => {
      if (hasInitialProject) {
        return dispatch(requestProjectUpload(loadingState));
      }
      return dispatch(setProjectId(defaultProjectId));
    },
    onFetchedInitialProjectData: (projectData, loadingState) => dispatch(onFetchedProjectData(projectData, loadingState)),
    onLoadedProject: (loadingState, loadSuccess) => {
      return dispatch(onLoadedProject(loadingState, /* canSave */ false, loadSuccess));
    },
    onRequestNewProject: () => dispatch(requestNewProject(false)),
    onSetRestrictedProjectMode: mode => dispatch(setRestrictedProjectMode(mode)),
    onSetPlayerOnly: isPlayerOnly => dispatch(setPlayer(isPlayerOnly)),
    onActivateBlocksTab: () => dispatch(activateTab(BLOCKS_TAB_INDEX)),
    onSetFileHandle: fileHandle => dispatch(setFileHandle(fileHandle)),
    onSetReduxUsername: username => dispatch(setUsername(username)),
    onShowErrorModal: error => {
      dispatch(setProjectError(error));
      dispatch(openInvalidProjectModal());
    }
  });

  return connect(
    mapStateToProps,
    mapDispatchToProps
  )(DesktopComponent);
};

export default DesktopHOC;
