import React from 'react';
import DockableTab from '../gui/dockable-tab.jsx';
import {parse, compileToXML, compileToSB3} from './scratch-text.js';

const drawerStyle = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: '26rem',
  maxWidth: '94vw',
  background: 'linear-gradient(180deg, #132a36 0%, #0b171f 100%)',
  color: '#eef5fa',
  zIndex: 9999,
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '-18px 0 48px rgba(3, 14, 21, 0.5)',
  borderLeft: '1px solid rgba(154, 218, 222, 0.24)',
  fontFamily: '"Segoe UI", sans-serif'
};

const tabButtonStyle = {
  position: 'fixed',
  right: 0,
  top: '24%',
  zIndex: 9998,
  border: 0,
  borderRadius: '0.65rem 0 0 0.65rem',
  padding: '0.7rem 0.55rem',
  background: 'linear-gradient(135deg, #1e91a4, #146f84)',
  color: '#ffffff',
  fontWeight: 700,
  fontSize: '0.78rem',
  cursor: 'pointer',
  boxShadow: '-6px 6px 18px rgba(0, 0, 0, 0.28)',
  writingMode: 'vertical-rl'
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  color: '#eef5fa',
  background: 'rgba(8, 21, 29, 0.82)',
  border: '1px solid rgba(113, 158, 174, 0.42)',
  borderRadius: '0.65rem',
  outline: 'none'
};

const buttonStyle = {
  minHeight: '2.2rem',
  padding: '0.5rem 0.8rem',
  border: 0,
  borderRadius: '999px',
  background: 'linear-gradient(135deg, #1e91a4, #146f84)',
  color: '#ffffff',
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: '0 8px 20px rgba(11, 93, 111, 0.28)'
};

const subtleButtonStyle = {
  ...buttonStyle,
  background: 'rgba(62, 91, 106, 0.82)',
  boxShadow: 'none'
};

const actionRowStyle = {display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem'};
const headerStyle = {
  padding: '0.95rem 1rem',
  borderBottom: '1px solid rgba(143, 205, 214, 0.2)'
};
const resultStyle = {
  margin: '0.6rem 0.85rem 0',
  padding: '0.55rem 0.7rem',
  borderRadius: '0.6rem',
  background: 'rgba(8, 21, 29, 0.55)',
  fontSize: '0.78rem',
  whiteSpace: 'pre-wrap',
  maxHeight: '6rem',
  overflowY: 'auto'
};
const hintStyle = {
  margin: '0.55rem 0.85rem 0',
  padding: '0.5rem 0.65rem',
  borderRadius: '0.6rem',
  background: 'rgba(17, 34, 44, 0.72)',
  fontSize: '0.74rem',
  color: '#9cb8c4',
  lineHeight: 1.6,
  maxHeight: '8rem',
  overflowY: 'auto'
};

const KEYWORD_HINT = `【帽子】当绿旗被点击 / 当按下 空格 键 / 当角色被点击
【动作】说 你好 · 移动 10 步 · 左转/右转 15 度 · 面向 90 度 · 移到 x:0 y:0 · 等待 1 秒
【控制】重复 10 次 · 重复无限次 · 如果 按下鼠标？ 那么 ... 否则 · 停止 全部
【外观】显示 · 隐藏 · 说 你好 持续 2 秒 · 换成 造型1 造型
【数据】将 分数 设为 0 · 将 分数 增加 1 · 广播 开始
【条件】按下鼠标？ · 按下 空格 键？ · 分数 大于 100
【项目】项目: 标题 · 设置 帧率 60 · 设置 补帧 开启 · 导入扩展 pen
【分段】舞台: · 角色: 角色1（每个角色一段）`;

class ScratchTextSidebar extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      open: false,
      text: '',
      result: '',
      resultOk: true,
      busy: false
    };
  }

  setResult (message, ok = true) {
    this.setState({result: message, resultOk: ok});
  }

  applySettings (ast) {
    const vm = this.props.vm;
    const applied = [];
    for (const setting of ast.settings) {
      try {
        switch (setting.key) {
        case 'framerate':
          vm.setFramerate(setting.value);
          break;
        case 'interpolation':
          vm.setInterpolation(setting.value);
          break;
        case 'highQualityPen':
          if (vm.renderer && typeof vm.renderer.setUseHighQualityRender === 'function') {
            vm.renderer.setUseHighQualityRender(setting.value);
          }
          break;
        case 'infiniteClones':
          vm.setRuntimeOptions({maxClones: setting.value ? Infinity : 300});
          break;
        case 'removeFencing':
          vm.setRuntimeOptions({fencing: !setting.value});
          break;
        case 'removeMiscLimits':
          vm.setRuntimeOptions({miscLimits: !setting.value});
          break;
        case 'warpTimer':
          vm.setCompilerOptions({warpTimer: setting.value});
          break;
        case 'compiler':
          vm.setCompilerOptions({enabled: setting.value});
          break;
        case 'turboMode':
          vm.setTurboMode(setting.value);
          break;
        case 'compatibilityMode':
          vm.setCompatibilityMode(setting.value);
          break;
        case 'stageSize':
          vm.setStageSize(setting.value.width, setting.value.height);
          break;
        case 'extension':
          this.loadExtension(setting.value);
          break;
        default:
          continue;
        }
        applied.push(setting.key);
      } catch (error) {
        throw new Error(`应用设置"${setting.key}"失败: ${error.message}`);
      }
    }
    if (applied.length && typeof vm.storeProjectOptions === 'function') {
      vm.storeProjectOptions();
    }
    return applied;
  }

  loadExtension (ref) {
    const manager = this.props.vm.extensionManager;
    if (/^https?:\/\//.test(ref)) {
      if (typeof manager.loadExtensionURL !== 'function') {
        throw new Error('当前 VM 不支持加载外部扩展');
      }
      return manager.loadExtensionURL(ref);
    }
    if (typeof manager.loadExtensionIdSync === 'function') {
      manager.loadExtensionIdSync(ref);
    } else {
      throw new Error(`无法加载内置扩展: ${ref}`);
    }
  }

  insertToProject (ast) {
    const vm = this.props.vm;
    const Blockly = window.ScratchBlocks || window.Blockly;
    const workspace = Blockly && Blockly.getMainWorkspace && Blockly.getMainWorkspace();
    if (!workspace) throw new Error('积木编辑器尚未就绪');

    const isDefault = !ast.hasSections && ast.targets.length === 1;
    const availableNames = vm.runtime.targets.map(t => (t.isStage ? '舞台' : t.name)).join('、');
    const inserted = [];

    for (const target of ast.targets) {
      let vmTarget = isDefault ? vm.editingTarget : vm.runtime.targets.find(
        t => t.isStage === target.isStage && t.name === target.name
      );
      if (!vmTarget) {
        throw new Error(`项目中不存在目标 "${target.isStage ? '舞台' : target.name}"。现有: ${availableNames}`);
      }
      const xml = compileToXML(target);
      if (!xml.includes('<block')) continue;
      const originalId = vm.editingTarget && vm.editingTarget.id;
      if (vmTarget.id !== originalId && typeof vm.setEditingTarget === 'function') {
        vm.setEditingTarget(vmTarget.id);
      }
      const ids = Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(xml), workspace);
      inserted.push(`${target.isStage ? '舞台' : target.name}(${ids.length}个积木)`);
      if (originalId && vmTarget.id !== originalId && typeof vm.setEditingTarget === 'function') {
        vm.setEditingTarget(originalId);
      }
    }
    return inserted;
  }

  async handleInsert () {
    if (this.state.busy) return;
    this.setState({busy: true});
    try {
      const ast = parse(this.state.text, {defaultTargetName: this.props.vm.editingTarget && this.props.vm.editingTarget.name});
      const inserted = this.insertToProject(ast);
      const applied = this.applySettings(ast);
      this.setResult(
        `已插入: ${inserted.join('、') || '无积木'}\n已应用设置: ${applied.join('、') || '无'}`
      );
    } catch (error) {
      this.setResult(error.message, false);
    } finally {
      this.setState({busy: false});
    }
  }

  async handleLoadProject () {
    if (this.state.busy) return;
    this.setState({busy: true});
    try {
      const ast = parse(this.state.text);
      const buffer = await compileToSB3(ast);
      await this.props.vm.loadProject(buffer);
      const applied = this.applySettings(ast);
      this.setResult(`项目已加载（${ast.targets.length} 个目标）\n已应用设置: ${applied.join('、') || '无'}`);
    } catch (error) {
      this.setResult(`加载失败: ${error.message}`, false);
    } finally {
      this.setState({busy: false});
    }
  }

  async handleImport () {
    if (typeof EditorPreload.openScratchTextFile !== 'function') {
      this.setResult('当前环境不支持导入 .sp 文件', false);
      return;
    }
    try {
      const file = await EditorPreload.openScratchTextFile();
      if (!file) return;
      this.setState({text: file.content, result: `已导入: ${file.name}`});
    } catch (error) {
      this.setResult(`导入失败: ${error.message}`, false);
    }
  }

  render () {
    return <React.Fragment>
      {!this.state.open && <DockableTab tabKey="scratch-text" label="文本编程" side="right" onOpen={() => this.setState({open: true})} />}
      {this.state.open && <aside style={drawerStyle}>
        <header style={headerStyle}>
          <strong style={{fontSize: '1.1rem'}}>文本编程</strong>
          <div style={{fontSize: '0.74rem', color: '#9cb8c4', marginTop: '0.18rem'}}>
            Scratch Project for HiWarp（.sp）— 一个文件描述整个项目
          </div>
          <div style={actionRowStyle}>
            <button style={buttonStyle} disabled={this.state.busy} onClick={() => this.handleInsert()}>
              {this.state.busy ? '处理中...' : '插入到项目'}
            </button>
            <button style={buttonStyle} disabled={this.state.busy} onClick={() => this.handleLoadProject()}>
              加载为新项目
            </button>
            <button style={subtleButtonStyle} onClick={() => this.handleImport()}>导入 .sp</button>
            <button style={subtleButtonStyle} onClick={() => this.setState({open: false})}>关闭</button>
          </div>
        </header>
        <textarea
          style={{...inputStyle, flex: 1, minHeight: '9rem', margin: '0.75rem 0.85rem 0', padding: '0.6rem', resize: 'vertical', lineHeight: 1.55, fontFamily: 'Consolas, monospace'}}
          placeholder={'当绿旗被点击\n  重复 999 次\n    说 你好'}
          value={this.state.text}
          onChange={event => this.setState({text: event.currentTarget.value})}
        />
        <div style={{...resultStyle, color: this.state.resultOk ? '#9be7a1' : '#ff8a80'}}>{this.state.result}</div>
        <div style={hintStyle}>{KEYWORD_HINT}</div>
      </aside>}
    </React.Fragment>;
  }
}

export default ScratchTextSidebar;
