#!/usr/bin/env node
/**
 * HiWarp Desktop —— node_modules 补丁应用脚本
 *
 * 背景：HiWarp 对 scratch-gui / scratch-vm 的改动曾经**只存在于 node_modules 里**，
 * 而 node_modules 被 .gitignore 忽略、且会被 npm ci 整体重建 —— 等于源码没有版本控制。
 * 2026-09-21 事故：一次 npm ci 之后，34 个新增文件和 9 个上游文件的改动全部丢失，
 * 只能从残留的 dist-web source map 的 sourcesContent 里抢救回来。
 *
 * 现在这些改动都在 patches/ 里，受 git 管理。npm ci 之后执行：
 *     node patches/apply.mjs
 *
 * 设计要点：
 *  - 幂等：每个编辑带 marker，已应用则跳过
 *  - 失败要吵：锚点找不到或出现多次 => 记入 problems，最后以非 0 退出
 *  - 纯字符串锚点，不用行号（对上游小改动免疫）
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const rel = p => path.join(ROOT, p);

let copied = 0;
const applied = [];
const skipped = [];
const problems = [];

// ───────────────────────── 1) 整文件补丁：直接复制 ─────────────────────────
function copyPackage(pkg){
    const src = rel(`patches/${pkg}`);
    if(!fs.existsSync(src)) return;
    const walk = dir => {
        for(const ent of fs.readdirSync(dir, {withFileTypes:true})){
            const p = path.join(dir, ent.name);
            if(ent.isDirectory()){ walk(p); continue; }
            const target = rel(`node_modules/${pkg}/${path.relative(src, p)}`);
            fs.mkdirSync(path.dirname(target), {recursive:true});
            fs.copyFileSync(p, target);
            copied++;
        }
    };
    walk(src);
}
copyPackage('scratch-gui');
copyPackage('scratch-vm');

// ───────────────────────── 2) 定点编辑 ─────────────────────────
/**
 * @typedef {{file:string, marker:string, find:string, replace:string, why:string}} Edit
 */

/** @type {Edit[]} */
const EDITS = [
{
    file: 'scratch-gui/src/reducers/modals.js',
    why: 'HiWarp 新增 3 个弹窗状态 + 扩展选择状态',
    marker: "MODAL_PROJECT_ENCRYPTION",
    find: "const MODAL_INVALID_PROJECT = 'invalidProjectModal';\n",
    replace: "const MODAL_INVALID_PROJECT = 'invalidProjectModal';\n" +
        "const MODAL_PROJECT_ENCRYPTION = 'projectEncryptionModal';\n" +
        "const MODAL_CCW_EXTENSION = 'ccwExtensionModal';\n" +
        "const MODAL_EXTENSION_IMPORT_METHOD = 'extensionImportMethodModal';\n"
},
{
    file: 'scratch-gui/src/reducers/modals.js',
    why: 'state 初值',
    marker: "[MODAL_PROJECT_ENCRYPTION]",
    find: "    [MODAL_INVALID_PROJECT]: false\n};",
    replace: "    [MODAL_INVALID_PROJECT]: false,\n" +
        "    [MODAL_PROJECT_ENCRYPTION]: false,\n" +
        "    [MODAL_CCW_EXTENSION]: false,\n" +
        "    [MODAL_EXTENSION_IMPORT_METHOD]: false,\n" +
        "    selectedExtension: null,\n" +
        "    selectedExtensions: []\n};"
},
{
    file: 'scratch-gui/src/reducers/modals.js',
    why: 'SET_SELECTED_EXTENSION(S) action 类型',
    marker: "SET_SELECTED_EXTENSIONS",
    find: "const CLOSE_MODAL = 'scratch-gui/modals/CLOSE_MODAL';\n",
    replace: "const CLOSE_MODAL = 'scratch-gui/modals/CLOSE_MODAL';\n" +
        "const SET_SELECTED_EXTENSION = 'scratch-gui/modals/SET_SELECTED_EXTENSION';\n" +
        "const SET_SELECTED_EXTENSIONS = 'scratch-gui/modals/SET_SELECTED_EXTENSIONS';\n"
},
{
    file: 'scratch-gui/src/reducers/modals.js',
    why: 'SET_SELECTED_EXTENSION(S) reducer 分支',
    marker: "case SET_SELECTED_EXTENSIONS:",
    find: "    case CLOSE_MODAL:\n        return Object.assign({}, state, {\n            [action.modal]: false\n        });\n",
    replace: "    case CLOSE_MODAL:\n        return Object.assign({}, state, {\n            [action.modal]: false\n        });\n" +
        "    case SET_SELECTED_EXTENSION:\n        return Object.assign({}, state, {\n            selectedExtension: action.extension\n        });\n" +
        "    case SET_SELECTED_EXTENSIONS:\n        return Object.assign({}, state, {\n            selectedExtensions: action.extensions\n        });\n"
},
{
    file: 'scratch-gui/src/reducers/modals.js',
    why: '新增 action creators',
    marker: "const closeProjectEncryptionModal = function () {",
    find: "const closeInvalidProjectModal = function () {\n    return closeModal(MODAL_INVALID_PROJECT);\n};\n",
    replace: "const closeInvalidProjectModal = function () {\n    return closeModal(MODAL_INVALID_PROJECT);\n};\n" +
        "const closeProjectEncryptionModal = function () {\n    return closeModal(MODAL_PROJECT_ENCRYPTION);\n};\n" +
        "const closeCCWExtensionModal = function () {\n    return closeModal(MODAL_CCW_EXTENSION);\n};\n" +
        "const openExtensionImportMethodModal = function () {\n    return openModal(MODAL_EXTENSION_IMPORT_METHOD);\n};\n" +
        "const closeExtensionImportMethodModal = function () {\n    return closeModal(MODAL_EXTENSION_IMPORT_METHOD);\n};\n" +
        "const setSelectedExtension = function (extension) {\n    return {\n        type: SET_SELECTED_EXTENSION,\n        extension: extension\n    };\n};\n" +
        "const setSelectedExtensions = function (extensions) {\n    return {\n        type: SET_SELECTED_EXTENSIONS,\n        extensions: extensions\n    };\n};\n"
},
{
    file: 'scratch-gui/src/reducers/modals.js',
    why: '导出新增 action creators',
    marker: "closeProjectEncryptionModal,",
    find: "    closeInvalidProjectModal\n};",
    replace: "    closeInvalidProjectModal,\n" +
        "    closeProjectEncryptionModal,\n" +
        "    closeCCWExtensionModal,\n" +
        "    openExtensionImportMethodModal,\n" +
        "    closeExtensionImportMethodModal,\n" +
        "    setSelectedExtension,\n" +
        "    setSelectedExtensions\n};"
},
{
    file: 'scratch-gui/src/containers/gui.jsx',
    why: '把 3 个新弹窗的可见性接到 redux',
    marker: "projectEncryptionModalVisible:",
    find: "        invalidProjectModalVisible: state.scratchGui.modals.invalidProjectModal,\n",
    replace: "                invalidProjectModalVisible: state.scratchGui.modals.invalidProjectModal,\n" +
        "        projectEncryptionModalVisible: state.scratchGui.modals.projectEncryptionModal,\n" +
        "        ccwExtensionModalVisible: state.scratchGui.modals.ccwExtensionModal,\n" +
        "        extensionImportMethodModalVisible: state.scratchGui.modals.extensionImportMethodModal,\n"
},
{
    file: 'scratch-gui/src/components/gui/gui.jsx',
    why: 'import 3 个新弹窗',
    marker: "HiWarpProjectEncryptionModal from",
    find: "import TWInvalidProjectModal from '../../containers/tw-invalid-project-modal.jsx';\n",
    replace: "import TWInvalidProjectModal from '../../containers/tw-invalid-project-modal.jsx';\n" +
        "import TWCCWExtensionModal from '../../containers/tw-ccw-extension-modal.jsx';\n" +
        "import TWExtensionImportModal from '../../containers/tw-extension-import-modal.jsx';\n" +
        "import HiWarpProjectEncryptionModal from '../../containers/hiwarp-project-encryption-modal.jsx';\n"
},
{
    file: 'scratch-gui/src/components/gui/gui.jsx',
    why: '渲染 3 个新弹窗',
    marker: "projectEncryptionModalVisible &&",
    find: "                {invalidProjectModalVisible && <TWInvalidProjectModal />}\n            </React.Fragment>",
    replace: "                {invalidProjectModalVisible && <TWInvalidProjectModal />}\n" +
        "                {projectEncryptionModalVisible && <HiWarpProjectEncryptionModal />}\n" +
        "                {ccwExtensionModalVisible && <TWCCWExtensionModal />}\n" +
        "                {extensionImportMethodModalVisible && <TWExtensionImportModal vm={vm} />}\n" +
        "            </React.Fragment>"
},
{
    file: 'scratch-gui/src/components/menu-bar/menu-bar.jsx',
    why: '反馈按钮改成 HiWarp 反馈（tw-feedback:// 协议）',
    marker: "tw-feedback://",
    find: "                            href=\"https://scratch.mit.edu/users/GarboMuffin/#comments\"\n",
    replace: "                            href=\"tw-feedback://./feedback.html\"\n"
},
{
    file: 'scratch-gui/src/components/menu-bar/menu-bar.jsx',
    why: '反馈按钮文案改成 HiWarp 反馈',
    marker: "HiWarp 反馈",
    find: "                                <FormattedMessage\n" +
        "                                    defaultMessage=\"{APP_NAME} Feedback\"\n" +
        "                                    description=\"Button to give feedback in the menu bar\"\n" +
        "                                    id=\"tw.feedbackButton\"\n" +
        "                                    values={{\n" +
        "                                        APP_NAME\n" +
        "                                    }}\n" +
        "                                />\n",
    replace: "                                {'HiWarp 反馈'}\n"
},
{
    file: 'scratch-gui/src/containers/sb3-downloader.jsx',
    why: '保存对话框增加 .hwp 类型',
    marker: "'HiWarp Project'",
    find: "                types: [\n                    {\n                        description: 'Scratch 3 Project',\n",
    replace: "                types: [\n" +
        "                    {\n" +
        "                        description: 'HiWarp Project',\n" +
        "                        accept: {\n" +
        "                            'application/octet-stream': '.hwp'\n" +
        "                        }\n" +
        "                    },\n" +
        "                    {\n" +
        "                        description: 'Scratch 3 Project',\n"
},
{
    file: 'scratch-vm/src/extension-support/tw-default-extension-urls.js',
    why: '注册 6 个 HiWarp 内置扩展的默认 URL',
    marker: "// HiWarp bundled extensions",
    find: "  videoSprites: 'https://extensions.turbowarp.org/lab/video-sprites.js'\n};",
    replace: "  videoSprites: 'https://extensions.turbowarp.org/lab/video-sprites.js',\n" +
        "  // HiWarp bundled extensions\n" +
        "  liquidGlassPopup: 'tw-extensions://./hidream_puw.js',\n" +
        "  ImageProcessor: 'tw-extensions://./image-processing.js',\n" +
        "  webglLiquidGlassV4: 'tw-extensions://./liquid-glass-render-v4.js',\n" +
        "  cyberexplorertoolboxmini: 'tw-extensions://./cyberexplorer-toolbox-mini.js',\n" +
        "  NTeaseMusic: 'tw-extensions://./netease-music.js',\n" +
        "  filehelperprov2: 'tw-extensions://./file-plus.js'\n};"
},
{
    file: 'scratch-vm/src/virtual-machine.js',
    why: '引入加密模块',
    marker: "hiwarpProjectEncryption",
    find: "const Base64Util = require('./util/base64-util');\n",
    replace: "const Base64Util = require('./util/base64-util');\n" +
        "const hiwarpProjectEncryption = require('./util/hiwarp-project-encryption');\n"
},
{
    file: 'scratch-vm/src/virtual-machine.js',
    why: '新增 saveEncryptedProjectSb3',
    marker: "saveEncryptedProjectSb3",
    find: "    saveProjectSb3 (type) {\n",
    replace: "    async saveEncryptedProjectSb3 (options, type) {\n" +
        "        const projectJson = this.toJSON();\n" +
        "        const zip = this._saveProjectZip();\n" +
        "        await hiwarpProjectEncryption.addEncryptedProjectToZip(zip, projectJson, options);\n" +
        "        return zip.generateAsync({\n" +
        "            type: type || 'blob',\n" +
        "            mimeType: 'application/x.scratch.sb3'\n" +
        "        });\n" +
        "    }\n" +
        "    saveProjectSb3 (type) {\n"
},
{
    file: 'scratch-gui/src/lib/sb-file-uploader-hoc.jsx',
    why: '引入加密/解锁模块',
    marker: "hiwarpProjectEncryption from 'scratch-vm",
    find: "import {setFileHandle, setProjectError} from '../reducers/tw';\n",
    replace: "import {setFileHandle, setProjectError, setRestrictedProjectMode} from '../reducers/tw';\n" +
        "import hiwarpProjectEncryption from 'scratch-vm/src/util/hiwarp-project-encryption';\n" +
        "import ProjectUnlockModal from '../containers/hiwarp-project-unlock-modal.jsx';\n"
},
{
    file: 'scratch-gui/src/reducers/tw.js',
    why: 'SET_RESTRICTED_PROJECT_MODE action 类型',
    marker: "SET_RESTRICTED_PROJECT_MODE =",
    find: "const SET_PROJECT_ERROR = 'tw/SET_PROJECT_ERROR';\n",
    replace: "const SET_PROJECT_ERROR = 'tw/SET_PROJECT_ERROR';\n" +
        "const SET_RESTRICTED_PROJECT_MODE = 'tw/SET_RESTRICTED_PROJECT_MODE';\n"
},
{
    file: 'scratch-gui/src/reducers/tw.js',
    why: 'restrictedProjectMode state 初值',
    marker: "restrictedProjectMode: null",
    find: "    projectError: null\n};",
    replace: "    projectError: null,\n    restrictedProjectMode: null\n};"
},
{
    file: 'scratch-gui/src/reducers/tw.js',
    why: 'restrictedProjectMode reducer 分支',
    marker: "case SET_RESTRICTED_PROJECT_MODE:",
    find: "    case SET_PROJECT_ERROR:\n        return Object.assign({}, state, {\n            projectError: action.projectError\n        });\n",
    replace: "    case SET_PROJECT_ERROR:\n        return Object.assign({}, state, {\n            projectError: action.projectError\n        });\n" +
        "    case SET_RESTRICTED_PROJECT_MODE:\n        return Object.assign({}, state, {\n            restrictedProjectMode: action.restrictedProjectMode\n        });\n"
},
{
    file: 'scratch-gui/src/reducers/tw.js',
    why: 'setRestrictedProjectMode action creator',
    marker: "const setRestrictedProjectMode = function",
    find: "export {\n    reducer as default,",
    replace: "const setRestrictedProjectMode = function (restrictedProjectMode) {\n" +
        "    return {\n" +
        "        type: SET_RESTRICTED_PROJECT_MODE,\n" +
        "        restrictedProjectMode\n" +
        "    };\n" +
        "};\n" +
        "export {\n    reducer as default,"
},
{
    file: 'scratch-gui/src/reducers/tw.js',
    why: '导出 setRestrictedProjectMode',
    marker: "    setRestrictedProjectMode\n};",
    find: "    setProjectError\n};",
    replace: "    setProjectError,\n    setRestrictedProjectMode\n};"
},
{
    file: 'scratch-gui/src/lib/sb-file-uploader-hoc.jsx',
    why: '新增 setPlayer / activateTab import',
    marker: "from '../reducers/editor-tab'",
    find: "import ProjectUnlockModal from '../containers/hiwarp-project-unlock-modal.jsx';\n",
    replace: `import ProjectUnlockModal from '../containers/hiwarp-project-unlock-modal.jsx';
import {setPlayer} from '../reducers/mode';
import {activateTab, BLOCKS_TAB_INDEX} from '../reducers/editor-tab';
`
},
{
    file: 'scratch-gui/src/lib/sb-file-uploader-hoc.jsx',
    why: 'bindAll 注册 3 个新方法',
    marker: "'decryptProjectIfNeeded'",
    find: `                'onload',
                'removeFileObjects'
`,
    replace: `                'onload',
                'handleUnlockCancel',
                'handleUnlockSubmit',
                'decryptProjectIfNeeded',
                'removeFileObjects'
`
},
{
    file: 'scratch-gui/src/lib/sb-file-uploader-hoc.jsx',
    why: 'state 增加 unlockRequest',
    marker: '            this.state = {',
    find: `            // tw: We have multiple instances of this HOC alive at a time. This flag fixes issues that arise from that.
            this.expectingFileUploadFinish = false;
`,
    replace: `            // tw: We have multiple instances of this HOC alive at a time. This flag fixes issues that arise from that.
            this.expectingFileUploadFinish = false;
            this.state = {
                unlockRequest: null
            };
`
},
{
    file: 'scratch-gui/src/lib/sb-file-uploader-hoc.jsx',
    why: '新增 5 个加解密方法，onload 改 async',
    marker: 'enterRestrictedMode (manifest, reason)',
    find: `        // step 6: attached as a handler on our FileReader object; called when
        // file upload raw data is available in the reader
        onload () {
`,
    replace: `        enterRestrictedMode (manifest, reason) {
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
            this.setState({
                unlockRequest: null
            });
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
                this.setState({
                    unlockRequest: null
                });
                request.resolve(result.data);
            } catch (error) {
                this.setState({
                    unlockRequest: null
                });
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
        // step 6: attached as a handler on our FileReader object; called when
        // file upload raw data is available in the reader
        async onload () {
`
},
{
    file: 'scratch-gui/src/lib/sb-file-uploader-hoc.jsx',
    why: 'onload 走解密流程',
    marker: 'await this.decryptProjectIfNeeded(this.fileReader.result)',
    find: `                this.props.vm.quit();
                this.props.vm.loadProject(this.fileReader.result)
`,
    replace: `                this.props.vm.quit();
                let projectData;
                try {
                    projectData = await this.decryptProjectIfNeeded(this.fileReader.result);
                } catch (error) {
                    log.error(error);
                    this.props.onLoadingFailed(error);
                    this.props.onLoadingFinished(this.props.loadingState, false);
                    this.removeFileObjects();
                    return;
                }
                this.props.vm.loadProject(projectData)
`
},
{
    file: 'scratch-gui/src/lib/sb-file-uploader-hoc.jsx',
    why: 'render 解构新增 3 个 props',
    marker: "                onSetRestrictedProjectMode,\n",
    find: `                onSetProjectTitle,
                projectChanged,
`,
    replace: `                onSetProjectTitle,
                onSetRestrictedProjectMode,
                onSetPlayerOnly,
                onActivateBlocksTab,
                projectChanged,
`
},
{
    file: 'scratch-gui/src/lib/sb-file-uploader-hoc.jsx',
    why: 'render 挂载解锁弹窗',
    marker: '<ProjectUnlockModal',
    find: `                        {...componentProps}
                    />
                </React.Fragment>`,
    replace: `                        {...componentProps}
                    />
                    {this.state.unlockRequest ? (
                        <ProjectUnlockModal
                            hashAlgorithm={this.state.unlockRequest.manifest.hashAlgorithm}
                            onCancel={this.handleUnlockCancel}
                            onUnlock={this.handleUnlockSubmit}
                        />
                    ) : null}
                </React.Fragment>`
},
{
    file: 'scratch-gui/src/lib/sb-file-uploader-hoc.jsx',
    why: 'propTypes 新增 3 个',
    marker: 'onSetRestrictedProjectMode: PropTypes.func',
    find: `        onSetProjectTitle: PropTypes.func,
        projectChanged: PropTypes.bool,
`,
    replace: `        onSetProjectTitle: PropTypes.func,
        onSetRestrictedProjectMode: PropTypes.func,
        onSetPlayerOnly: PropTypes.func,
        onActivateBlocksTab: PropTypes.func,
        projectChanged: PropTypes.bool,
`
},
{
    file: 'scratch-gui/src/lib/sb-file-uploader-hoc.jsx',
    why: 'mapDispatchToProps 接入 3 个 dispatcher',
    marker: 'onSetRestrictedProjectMode: restrictedProjectMode',
    find: `        onSetFileHandle: fileHandle => dispatch(setFileHandle(fileHandle))
    });`,
    replace: `        onSetFileHandle: fileHandle => dispatch(setFileHandle(fileHandle)),
        onSetRestrictedProjectMode: restrictedProjectMode => dispatch(setRestrictedProjectMode(restrictedProjectMode)),
        onSetPlayerOnly: playerOnly => dispatch(setPlayer(playerOnly)),
        onActivateBlocksTab: () => dispatch(activateTab(BLOCKS_TAB_INDEX))
    });`
}
];

for(const ed of EDITS){
    const file = rel(`node_modules/${ed.file}`);
    if(!fs.existsSync(file)){ problems.push(`文件不存在: ${ed.file}`); continue; }
    let text = fs.readFileSync(file, 'utf8');
    if(text.includes(ed.marker)){ skipped.push(`${ed.file} — ${ed.why}`); continue; }
    const occurrences = text.split(ed.find).length - 1;
    if(occurrences !== 1){
        problems.push(`${ed.file}: 锚点命中 ${occurrences} 次（期望 1） — ${ed.why}`);
        continue;
    }
    fs.writeFileSync(file, text.replace(ed.find, ed.replace));
    applied.push(`${ed.file} — ${ed.why}`);
}

// ───────────────────────── 3) 报告 ─────────────────────────
console.log(`复制文件      : ${copied}`);
console.log(`应用编辑      : ${applied.length}`);
console.log(`已存在跳过    : ${skipped.length}`);
console.log(`问题          : ${problems.length}`);
if(applied.length){
    console.log('\n已应用:');
    applied.forEach(x => console.log('  + ' + x));
}
if(skipped.length){
    console.log('\n跳过（已应用过）:');
    skipped.forEach(x => console.log('  = ' + x));
}
if(problems.length){
    console.error('\n!! 需要人工处理:');
    problems.forEach(x => console.error('  ! ' + x));
    process.exit(1);
}
console.log('\n补丁应用完成。');