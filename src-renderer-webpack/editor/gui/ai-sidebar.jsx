import React from 'react';
import DockableTab from './dockable-tab.jsx';

const drawerStyle = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: '24rem',
  maxWidth: '94vw',
  background: 'radial-gradient(circle at 82% 4%, rgba(58, 126, 132, 0.42) 0, transparent 32%), linear-gradient(180deg, #162a34 0%, #0c171f 100%)',
  color: '#eef5fa',
  zIndex: 10000,
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '-18px 0 48px rgba(3, 14, 21, 0.46)',
  borderLeft: '1px solid rgba(154, 218, 222, 0.24)',
  fontFamily: '"Segoe UI", sans-serif'
};

const glassStyle = {
  background: 'rgba(17, 34, 44, 0.76)',
  border: '1px solid rgba(142, 195, 205, 0.18)',
  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.16)',
  backdropFilter: 'blur(14px)'
};

const inputStyle = {
  width: '100%',
  minHeight: '2.25rem',
  marginTop: '0.35rem',
  padding: '0.52rem 0.68rem',
  boxSizing: 'border-box',
  color: '#eef5fa',
  background: 'rgba(8, 21, 29, 0.78)',
  border: '1px solid rgba(113, 158, 174, 0.42)',
  borderRadius: '0.65rem',
  outline: 'none'
};

const buttonStyle = {
  minHeight: '2.2rem',
  padding: '0.48rem 0.78rem',
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

const warningButtonStyle = {
  ...buttonStyle,
  background: 'linear-gradient(135deg, #d08237, #a85b24)',
  boxShadow: '0 8px 20px rgba(168, 91, 36, 0.22)'
};

const actionRowStyle = {display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem'};
const fieldLabelStyle = {display: 'block', marginTop: '0.75rem', color: '#d2e1e7', fontSize: '0.82rem'};
const headerStyle = {
  padding: '0.95rem 1rem',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr)',
  gap: '0.75rem',
  borderBottom: '1px solid rgba(143, 205, 214, 0.2)'
};
const headerActionsStyle = {display: 'flex', gap: '0.45rem', flexWrap: 'wrap'};
const settingsStyle = {
  ...glassStyle,
  margin: '0.75rem',
  padding: '0.8rem',
  borderRadius: '1rem',
  maxHeight: '48vh',
  overflowY: 'auto'
};
const summaryStyle = {cursor: 'pointer', fontWeight: 700, color: '#f4fbff'};
const messageListStyle = {flex: 1, overflowY: 'auto', padding: '0.75rem 0.85rem 0.25rem'};
const messageBubbleStyle = role => ({
  overflowWrap: 'anywhere',
  margin: role === 'user' ? '0 0 0.8rem auto' : '0 auto 0.8rem 0',
  maxWidth: '92%',
  padding: '0.72rem 0.82rem',
  background: role === 'user' ? 'linear-gradient(135deg, #1e91a4, #126f84)' : 'rgba(33, 52, 65, 0.92)',
  border: '1px solid rgba(165, 219, 225, 0.14)',
  borderRadius: role === 'user' ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
  boxShadow: '0 10px 24px rgba(0, 0, 0, 0.16)',
  lineHeight: 1.5
});
const messageHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  marginBottom: '0.28rem'
};
const messageTextStyle = {
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere'
};
const speakButtonStyle = {
  ...subtleButtonStyle,
  minHeight: '1.55rem',
  padding: '0.16rem 0.55rem',
  fontSize: '0.72rem',
  boxShadow: 'none'
};
const permissionGridStyle = {display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.4rem 0.6rem', marginTop: '0.85rem'};
const sessionCardStyle = {...glassStyle, margin: '0 0.85rem 0.75rem', padding: '0.85rem', borderRadius: '1rem'};
const reviewCardStyle = {
  margin: '0.75rem 0.85rem 0',
  padding: '0.8rem',
  borderRadius: '1rem',
  background: 'rgba(32, 42, 40, 0.95)',
  border: '1px solid rgba(240, 190, 90, 0.5)',
  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.25)',
  fontSize: '0.82rem'
};
const undoButtonStyle = {
  marginLeft: '0.5rem',
  padding: '0.18rem 0.55rem',
  border: 0,
  borderRadius: '999px',
  background: 'rgba(62, 91, 106, 0.82)',
  color: '#eef5fa',
  fontSize: '0.72rem',
  cursor: 'pointer'
};

// 免费 DeepSeek 错误提示增强：未安装时引导运行安装命令
const formatFreeError = error => {
  const text = String(error || '');
  return text;
};
const footerStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
  gap: '0.6rem',
  padding: '0.8rem 0.9rem 0.9rem',
  borderTop: '1px solid rgba(143, 205, 214, 0.18)',
  background: 'rgba(11, 24, 32, 0.66)'
};
const tabButtonBaseStyle = {
  ...buttonStyle,
  position: 'fixed',
  zIndex: 10001,
  borderRadius: '1rem 0 0 1rem',
  padding: '0.85rem 0.6rem',
  boxShadow: '-8px 10px 28px rgba(8, 39, 47, 0.34)',
  writingMode: 'vertical-rl',
  letterSpacing: '0.08em',
  userSelect: 'none',
  touchAction: 'none'
};

const permissionNames = {
  insertScript: '新建脚本',
  replaceScript: '替换脚本',
  deleteScript: '删除脚本',
  updateVariable: '编辑变量',
  updateSprite: '编辑角色属性',
  updateTarget: '编辑角色/舞台',
  loadExtension: '添加扩展',
  manageTargets: '管理角色/舞台',
  projectControl: '控制项目运行',
  callVmMethod: '调用 VM 白名单',
  callTargetMethod: '调用目标白名单'
};

const getSpeakableAIText = text => {
  const raw = String(text || '');
  const withoutCodeBlocks = raw.replace(/```[\s\S]*?```/g, '').trim();
  return withoutCodeBlocks || raw.trim();
};

const CONTEXT_LIMITS = {
  maxTargets: Number.MAX_SAFE_INTEGER,
  maxCatalogScriptsPerTarget: Number.MAX_SAFE_INTEGER,
  maxScriptsPerTarget: Number.MAX_SAFE_INTEGER,
  maxBlocksPerScript: Number.MAX_SAFE_INTEGER,
  maxDetailedScripts: Number.MAX_SAFE_INTEGER,
  maxDetailedBlocksPerScript: Number.MAX_SAFE_INTEGER,
  maxVariablesPerTarget: Number.MAX_SAFE_INTEGER,
  maxCostumesPerTarget: Number.MAX_SAFE_INTEGER,
  maxSoundsPerTarget: Number.MAX_SAFE_INTEGER,
  maxCommentsPerTarget: Number.MAX_SAFE_INTEGER,
  maxMonitors: Number.MAX_SAFE_INTEGER,
  maxPrimitiveOpcodes: Number.MAX_SAFE_INTEGER,
  maxBuiltinExtensions: Number.MAX_SAFE_INTEGER,
  maxLoadedExtensions: Number.MAX_SAFE_INTEGER,
  maxListItems: Number.MAX_SAFE_INTEGER,
  maxObjectKeys: Number.MAX_SAFE_INTEGER,
  maxStringLength: Number.MAX_SAFE_INTEGER,
  maxObjectDepth: 32
};

const AI_OPERATION_SKILLS = [
  'insertScript',
  'replaceScript',
  'deleteScript',
  'updateVariable',
  'createVariable',
  'deleteVariable',
  'updateSprite',
  'updateTarget',
  'selectTarget',
  'duplicateTarget',
  'deleteTarget',
  'loadExtension',
  'greenFlag',
  'stopAll',
  'callVmMethod',
  'callTargetMethod'
];

const AI_BLOCK_SCHEMA_SKILLS = [
  'block.opcode',
  'block.fields',
  'block.inputs.value',
  'block.inputs.block',
  'block.inputs.shadow',
  'block.inputs.statement',
  'block.mutation',
  'block.comment',
  'block.next',
  'block.position'
];

const truncateText = value => {
  const text = String(value);
  return text.length > CONTEXT_LIMITS.maxStringLength ?
    `${text.slice(0, CONTEXT_LIMITS.maxStringLength)}...` :
    text;
};

const compactValue = (value, depth = 0) => {
  if (value === null || typeof value === 'undefined') return value;
  if (typeof value === 'string') return truncateText(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const items = value.slice(0, CONTEXT_LIMITS.maxListItems).map(item => compactValue(item, depth + 1));
    if (value.length > items.length) items.push(`...${value.length - items.length} more items`);
    return items;
  }
  if (typeof value === 'object') {
    if (depth >= CONTEXT_LIMITS.maxObjectDepth) return '[object]';
    const entries = Object.entries(value).slice(0, CONTEXT_LIMITS.maxObjectKeys);
    const result = {};
    for (const [key, item] of entries) {
      result[key] = compactValue(item, depth + 1);
    }
    const omitted = Object.keys(value).length - entries.length;
    if (omitted > 0) result.__omittedKeys = omitted;
    return result;
  }
  return String(value);
};

const getInputBlockIds = input => {
  const ids = [];
  const visit = value => {
    if (!value) return;
    if (typeof value === 'string') {
      ids.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) visit(item);
    } else if (typeof value === 'object') {
      if (typeof value.block === 'string') ids.push(value.block);
      if (typeof value.shadow === 'string') ids.push(value.shadow);
    }
  };
  visit(input);
  return ids;
};

const escapeXML = value => String(value).replace(/[<>&'"]/g, character => ({
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  "'": '&apos;',
  '"': '&quot;'
}[character]));

const getBlockMap = target => (target && target.blocks && target.blocks._blocks) || {};

const serializeIndexedItems = (items, maxItems, serialize) => {
  const list = Array.isArray(items) ? items : [];
  return {
    items: list.slice(0, maxItems).map(serialize),
    omitted: Math.max(0, list.length - maxItems),
    count: list.length
  };
};

const makeTargetResources = target => {
  const costumes = serializeIndexedItems(target.getCostumes ? target.getCostumes() : target.sprite && target.sprite.costumes, CONTEXT_LIMITS.maxCostumesPerTarget, (costume, index) => ({
    index,
    name: costume && costume.name,
    assetId: costume && costume.assetId,
    md5ext: costume && costume.md5ext,
    dataFormat: costume && costume.dataFormat,
    bitmapResolution: costume && costume.bitmapResolution,
    rotationCenterX: costume && costume.rotationCenterX,
    rotationCenterY: costume && costume.rotationCenterY
  }));
  const sounds = serializeIndexedItems(target.getSounds ? target.getSounds() : target.sprite && target.sprite.sounds, CONTEXT_LIMITS.maxSoundsPerTarget, (sound, index) => ({
    index,
    name: sound && sound.name,
    assetId: sound && sound.assetId,
    md5ext: sound && sound.md5ext,
    dataFormat: sound && sound.dataFormat,
    rate: sound && sound.rate,
    sampleCount: sound && sound.sampleCount
  }));
  const comments = Object.values(target.comments || {});
  return {
    costumes,
    sounds,
    comments: {
      count: comments.length,
      items: comments.slice(0, CONTEXT_LIMITS.maxCommentsPerTarget).map(comment => ({
        id: comment.id,
        blockId: comment.blockId || null,
        text: compactValue(comment.text || ''),
        minimized: Boolean(comment.minimized),
        x: comment.x,
        y: comment.y
      })),
      omitted: Math.max(0, comments.length - CONTEXT_LIMITS.maxCommentsPerTarget)
    }
  };
};

const makeTargetProperties = target => ({
  x: target.x,
  y: target.y,
  direction: target.direction,
  size: target.size,
  visible: target.visible,
  rotationStyle: target.rotationStyle,
  draggable: target.draggable,
  volume: target.volume,
  currentCostume: target.currentCostume,
  layerOrder: target.getLayerOrder ? target.getLayerOrder() : target.layerOrder
});

const makeMonitorCatalog = vm => {
  const monitorState = vm && vm.runtime && vm.runtime._monitorState;
  if (!monitorState) return {count: 0, items: [], omitted: 0};
  const monitors = [];
  if (typeof monitorState.values === 'function') {
    for (const monitor of monitorState.values()) monitors.push(monitor);
  } else if (monitorState._map) {
    for (const monitor of monitorState._map.values()) monitors.push(monitor);
  }
  return {
    count: monitors.length,
    items: monitors.slice(0, CONTEXT_LIMITS.maxMonitors).map(monitor => ({
      id: monitor.id || monitor.get && monitor.get('id'),
      opcode: monitor.opcode || monitor.get && monitor.get('opcode'),
      targetId: monitor.targetId || monitor.get && monitor.get('targetId'),
      visible: monitor.visible || monitor.get && monitor.get('visible'),
      mode: monitor.mode || monitor.get && monitor.get('mode'),
      params: compactValue(monitor.params || monitor.get && monitor.get('params') || {})
    })),
    omitted: Math.max(0, monitors.length - CONTEXT_LIMITS.maxMonitors)
  };
};

const makeCapabilityCatalog = vm => {
  const runtime = vm && vm.runtime;
  const primitiveOpcodes = Object.keys(runtime && runtime._primitives || {}).sort();
  const opcodePrefixes = {};
  for (const opcode of primitiveOpcodes) {
    const prefix = opcode.includes('_') ? opcode.split('_')[0] : 'other';
    opcodePrefixes[prefix] = (opcodePrefixes[prefix] || 0) + 1;
  }
  const extensionManager = vm && vm.extensionManager;
  const builtinExtensions = Object.keys(extensionManager && extensionManager.builtinExtensions || {}).sort();
  const loadedExtensions = extensionManager && extensionManager._loadedExtensions ?
    Array.from(extensionManager._loadedExtensions.keys()).sort() :
    [];
  return {
    totalSkillCount: AI_OPERATION_SKILLS.length + AI_BLOCK_SCHEMA_SKILLS.length + primitiveOpcodes.length + builtinExtensions.length,
    operationSkills: AI_OPERATION_SKILLS,
    blockSchemaSkills: AI_BLOCK_SCHEMA_SKILLS,
    primitiveOpcodeCount: primitiveOpcodes.length,
    primitiveOpcodes: primitiveOpcodes.slice(0, CONTEXT_LIMITS.maxPrimitiveOpcodes),
    omittedPrimitiveOpcodes: Math.max(0, primitiveOpcodes.length - CONTEXT_LIMITS.maxPrimitiveOpcodes),
    opcodePrefixes,
    builtinExtensionCount: builtinExtensions.length,
    builtinExtensions: builtinExtensions.slice(0, CONTEXT_LIMITS.maxBuiltinExtensions),
    loadedExtensionCount: loadedExtensions.length,
    loadedExtensions: loadedExtensions.slice(0, CONTEXT_LIMITS.maxLoadedExtensions),
    omittedBuiltinExtensions: Math.max(0, builtinExtensions.length - CONTEXT_LIMITS.maxBuiltinExtensions),
    omittedLoadedExtensions: Math.max(0, loadedExtensions.length - CONTEXT_LIMITS.maxLoadedExtensions)
  };
};

const makeTargetStats = target => {
  const blocks = Object.values(getBlockMap(target)).filter(Boolean);
  const topLevelBlocks = blocks.filter(block => !block.parent && !block.shadow);
  const opcodeCounts = {};
  let shadowBlockCount = 0;
  let reporterBlockCount = 0;
  let commandBlockCount = 0;
  for (const block of blocks) {
    const opcode = block.opcode || 'unknown';
    opcodeCounts[opcode] = (opcodeCounts[opcode] || 0) + 1;
    if (block.shadow) shadowBlockCount++;
    if (block.outputShape || block.output) reporterBlockCount++;
    if (!block.shadow && !block.outputShape && !block.output) commandBlockCount++;
  }
  return {
    blockCount: blocks.length,
    nonShadowBlockCount: blocks.length - shadowBlockCount,
    shadowBlockCount,
    commandBlockCount,
    reporterBlockCount,
    topLevelScriptCount: topLevelBlocks.length,
    variableCount: Object.values(target.variables || {}).filter(variable => variable && !variable.type).length,
    listCount: Object.values(target.variables || {}).filter(variable => variable && variable.type === 'list').length,
    broadcastCount: Object.values(target.variables || {}).filter(variable => variable && variable.type === 'broadcast_msg').length,
    costumeCount: target.getCostumes ? target.getCostumes().length : target.sprite && target.sprite.costumes && target.sprite.costumes.length || 0,
    soundCount: target.getSounds ? target.getSounds().length : target.sprite && target.sprite.sounds && target.sprite.sounds.length || 0,
    commentCount: Object.keys(target.comments || {}).length,
    opcodeCounts
  };
};

const makeProjectStats = targets => {
  const stats = {
    targetCount: targets.length,
    spriteCount: targets.filter(target => !target.isStage).length,
    stageCount: targets.filter(target => target.isStage).length,
    blockCount: 0,
    nonShadowBlockCount: 0,
    shadowBlockCount: 0,
    commandBlockCount: 0,
    reporterBlockCount: 0,
    topLevelScriptCount: 0,
    variableCount: 0,
    listCount: 0,
    broadcastCount: 0,
    costumeCount: 0,
    soundCount: 0,
    commentCount: 0,
    opcodeCounts: {}
  };
  for (const target of targets) {
    const targetStats = makeTargetStats(target);
    stats.blockCount += targetStats.blockCount;
    stats.nonShadowBlockCount += targetStats.nonShadowBlockCount;
    stats.shadowBlockCount += targetStats.shadowBlockCount;
    stats.commandBlockCount += targetStats.commandBlockCount;
    stats.reporterBlockCount += targetStats.reporterBlockCount;
    stats.topLevelScriptCount += targetStats.topLevelScriptCount;
    stats.costumeCount += targetStats.costumeCount;
    stats.soundCount += targetStats.soundCount;
    stats.commentCount += targetStats.commentCount;
    for (const variable of Object.values(target.variables || {})) {
      if (variable && variable.type === 'list') stats.listCount++;
      else if (variable && variable.type === 'broadcast_msg') stats.broadcastCount++;
      else stats.variableCount++;
    }
    for (const [opcode, count] of Object.entries(targetStats.opcodeCounts)) {
      stats.opcodeCounts[opcode] = (stats.opcodeCounts[opcode] || 0) + count;
    }
  }
  return stats;
};

const makeCatalog = vm => (vm.runtime.targets || []).filter(target => target && target.sprite).map(target => {
  const blocks = Object.values(getBlockMap(target));
  const scripts = blocks.filter(block => block && !block.parent && !block.shadow);
  return {
    id: target.id,
    name: target.sprite.name,
    isStage: target.isStage,
    properties: makeTargetProperties(target),
    stats: makeTargetStats(target),
    resources: {
      costumeCount: target.getCostumes ? target.getCostumes().length : target.sprite && target.sprite.costumes && target.sprite.costumes.length || 0,
      soundCount: target.getSounds ? target.getSounds().length : target.sprite && target.sprite.sounds && target.sprite.sounds.length || 0,
      commentCount: Object.keys(target.comments || {}).length
    },
    scripts: scripts.slice(0, CONTEXT_LIMITS.maxCatalogScriptsPerTarget).map(block => ({
      id: block.id,
      opcode: block.opcode || 'unknown'
    })),
    omittedScripts: Math.max(0, scripts.length - CONTEXT_LIMITS.maxCatalogScriptsPerTarget)
  };
});

const serializeScript = (blocks, rootId, maxBlocks) => {
  const selected = [];
  const visited = new Set();
  const visit = id => {
    if (!id || visited.has(id) || selected.length >= maxBlocks) return;
    const block = blocks[id];
    if (!block) return;
    visited.add(id);
    selected.push({
      id: block.id,
      opcode: block.opcode || 'unknown',
      parent: block.parent || null,
      next: block.next || null,
      inputs: compactValue(block.inputs || {}),
      fields: compactValue(block.fields || {}),
      shadow: Boolean(block.shadow),
      topLevel: Boolean(block.topLevel),
      x: block.x,
      y: block.y,
      mutation: compactValue(block.mutation || {}),
      comment: block.comment || null
    });
    for (const input of Object.values(block.inputs || {})) {
      getInputBlockIds(input).forEach(visit);
    }
    if (block.next) visit(block.next);
  };
  visit(rootId);
  return {
    rootId,
    opcode: blocks[rootId] && blocks[rootId].opcode || 'unknown',
    blocks: selected,
    truncated: selected.length >= maxBlocks
  };
};

const serializeTarget = (target, selectedScripts, options = {}) => {
  const blocks = getBlockMap(target);
  const allRootIds = Object.values(blocks)
    .filter(block => block && !block.parent && !block.shadow)
    .map(block => block.id)
    .filter(id => !selectedScripts || selectedScripts.includes(id));
  const rootIds = allRootIds.slice(0, CONTEXT_LIMITS.maxScriptsPerTarget);
  const variables = Object.values(target.variables || {});

  return {
    id: target.id,
    name: target.sprite.name,
    isStage: target.isStage,
    properties: makeTargetProperties(target),
    stats: makeTargetStats(target),
    resources: makeTargetResources(target),
    variables: variables.slice(0, CONTEXT_LIMITS.maxVariablesPerTarget).map(variable => ({
      id: variable.id,
      name: variable.name,
      value: compactValue(variable.value),
      type: variable.type
    })),
    omittedVariables: Math.max(0, variables.length - CONTEXT_LIMITS.maxVariablesPerTarget),
    rootIds,
    omittedScripts: Math.max(0, allRootIds.length - rootIds.length),
    scripts: rootIds.map(rootId => ({
      rootId,
      opcode: blocks[rootId] && blocks[rootId].opcode || 'unknown'
    })),
    scriptDetails: options.includeScriptBodies ?
      rootIds.map(rootId => serializeScript(blocks, rootId, options.maxBlocks || CONTEXT_LIMITS.maxBlocksPerScript)) :
      []
  };
};

const makeContext = (vm, mode, selection) => {
  const catalog = makeCatalog(vm);
  const targets = (vm.runtime.targets || []).filter(target => target && target.sprite);
  let included = [];
  let detailedScripts = [];
  if (mode === 'details') {
    const requests = Array.isArray(selection && selection.detailRequests) ? selection.detailRequests : [];
    detailedScripts = requests.slice(0, CONTEXT_LIMITS.maxDetailedScripts).map(request => {
      const target = targets.find(candidate => candidate.id === request.targetId);
      const blocks = target && getBlockMap(target);
      const rootId = request.rootBlockId || request.rootId;
      if (!target || !blocks || !blocks[rootId]) {
        return {targetId: request.targetId, rootBlockId: rootId, error: 'target or script not found'};
      }
      return {
        targetId: target.id,
        targetName: target.sprite.name,
        ...serializeScript(blocks, rootId, CONTEXT_LIMITS.maxDetailedBlocksPerScript)
      };
    });
  } else if (mode === 'project') {
    included = targets.slice(0, CONTEXT_LIMITS.maxTargets).map(target => serializeTarget(target, null, {
      includeScriptBodies: true,
      maxBlocks: CONTEXT_LIMITS.maxBlocksPerScript
    }));
  } else if (mode === 'custom') {
    included = targets
      .filter(target => selection && selection.targetIds && selection.targetIds.includes(target.id))
      .slice(0, CONTEXT_LIMITS.maxTargets)
      .map(target => serializeTarget(target, selection.scriptIds && selection.scriptIds[target.id], {
        includeScriptBodies: true,
        maxBlocks: CONTEXT_LIMITS.maxBlocksPerScript
      }));
  } else {
    const target = vm.editingTarget || targets.find(candidate => candidate && !candidate.isStage);
    if (target) included = [serializeTarget(target, null, {
      includeScriptBodies: true,
      maxBlocks: CONTEXT_LIMITS.maxBlocksPerScript
    })];
  }
  return {
    mode,
    uploadedAt: Date.now(),
    compact: false,
    unrestrictedContext: true,
    limits: CONTEXT_LIMITS,
    capabilities: makeCapabilityCatalog(vm),
    stats: makeProjectStats(targets),
    monitors: makeMonitorCatalog(vm),
    runtime: {
      turboMode: Boolean(vm.runtime && vm.runtime.turboMode),
      interpolationEnabled: Boolean(vm.runtime && vm.runtime.interpolationEnabled),
      framerate: vm.runtime && vm.runtime.frameLoop && vm.runtime.frameLoop.framerate,
      editingTargetId: vm.editingTarget && vm.editingTarget.id
    },
    catalog,
    targets: included,
    detailedScripts,
    omittedTargets: Math.max(0, targets.length - included.length)
  };
};

const unwrapInputValue = value => {
  if (Array.isArray(value)) {
    return value.length > 1 ? unwrapInputValue(value[1]) : null;
  }
  if (value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value')) {
    return unwrapInputValue(value.value);
  }
  return value;
};

const shadowFieldByType = {
  math_number: 'NUM',
  math_integer: 'NUM',
  math_positive_number: 'NUM',
  math_whole_number: 'NUM',
  math_angle: 'NUM',
  text: 'TEXT',
  colour_picker: 'COLOUR'
};

const shadowTypeForValue = value => {
  if (typeof value === 'number') return 'math_number';
  if (typeof value === 'boolean') return 'text';
  if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return 'colour_picker';
  return 'text';
};

const getScriptRoot = script => {
  if (script && typeof script.opcode === 'string') return script;
  if (!script || !Array.isArray(script.blocks) || script.blocks.length === 0) {
    throw new Error('AI 脚本缺少 blocks');
  }
  const blocksById = new Map(script.blocks.filter(block => block && block.id).map(block => [block.id, block]));
  const resolveBlock = (value, visited) => {
    if (!value) return null;
    if (typeof value === 'string') return build(blocksById.get(value), -1, visited);
    if (value && typeof value === 'object' && typeof value.opcode === 'string') return build(value, -1, visited);
    return null;
  };
  const normalizeInput = (value, visited) => {
    const unwrapped = unwrapInputValue(value);
    if (typeof unwrapped === 'string' && blocksById.has(unwrapped)) return resolveBlock(unwrapped, visited);
    if (!unwrapped || typeof unwrapped !== 'object') return unwrapped;
    if (typeof unwrapped.opcode === 'string') return resolveBlock(unwrapped, visited);
    const normalized = {...unwrapped};
    if (normalized.block) normalized.block = resolveBlock(normalized.block, visited);
    if (normalized.shadow) normalized.shadow = resolveBlock(normalized.shadow, visited);
    if (normalized.statement) normalized.statement = resolveBlock(normalized.statement, visited);
    return normalized;
  };
  const build = (block, index, visited = new Set()) => {
    if (!block || typeof block.opcode !== 'string') throw new Error('AI 脚本包含无效积木');
    if (block.id && visited.has(block.id)) throw new Error('AI 脚本存在循环连接');
    const nextVisited = new Set(visited);
    if (block.id) nextVisited.add(block.id);
    let nextBlock = null;
    if (block.next && typeof block.next === 'object') nextBlock = block.next;
    else if (typeof block.next === 'string') nextBlock = blocksById.get(block.next);
    else if (index + 1 < script.blocks.length) nextBlock = script.blocks[index + 1];
    return {
      ...block,
      inputs: Object.fromEntries(Object.entries(block.inputs || {}).map(([name, value]) => [name, normalizeInput(value, nextVisited)])),
      next: nextBlock ? build(nextBlock, script.blocks.indexOf(nextBlock), nextVisited) : null
    };
  };
  const root = script.rootBlockId && blocksById.get(script.rootBlockId) || script.blocks[0];
  return build(root, script.blocks.indexOf(root));
};

const makeFieldXML = (name, value) => {
  const fieldValue = value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value') ? value.value : value;
  const id = value && typeof value === 'object' && value.id ? ` id="${escapeXML(value.id)}"` : '';
  return `<field name="${escapeXML(name)}"${id}>${escapeXML(fieldValue)}</field>`;
};

const makeShadowXML = (value, requestedType) => {
  if (value && typeof value === 'object' && typeof value.opcode === 'string') {
    return makeBlockXML(value, false, true);
  }
  const type = requestedType || shadowTypeForValue(value);
  const field = shadowFieldByType[type] || 'TEXT';
  return `<shadow type="${escapeXML(type)}"><field name="${field}">${escapeXML(value)}</field></shadow>`;
};

const makeMutationXML = mutation => {
  if (!mutation || typeof mutation !== 'object') return '';
  const attributes = Object.entries(mutation)
    .filter(([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value))
    .map(([name, value]) => ` ${escapeXML(name)}="${escapeXML(value)}"`)
    .join('');
  return `<mutation${attributes}></mutation>`;
};

const makeCommentXML = comment => {
  if (!comment) return '';
  const text = typeof comment === 'object' ? comment.text : comment;
  const attrs = typeof comment === 'object' ? Object.entries(comment)
    .filter(([name]) => name !== 'text')
    .filter(([, value]) => value === null || ['string', 'number', 'boolean'].includes(typeof value))
    .map(([name, value]) => ` ${escapeXML(name)}="${escapeXML(value)}"`)
    .join('') : '';
  return `<comment${attrs}>${escapeXML(text)}</comment>`;
};

const makeInputXML = (name, value) => {
  if (value === undefined || value === null) return '';
  const isStatement = value && typeof value === 'object' && value.statement;
  const tag = isStatement ? 'statement' : 'value';
  let inner = '';
  if (isStatement) {
    inner = makeBlockXML(value.statement, false);
  } else if (value && typeof value === 'object' && value.block) {
    inner = `${value.shadow ? makeShadowXML(value.shadow, value.type) : ''}${makeBlockXML(value.block, false)}`;
  } else if (value && typeof value === 'object' && value.shadow) {
    inner = makeShadowXML(value.shadow, value.type);
  } else if (value && typeof value === 'object' && typeof value.opcode === 'string') {
    inner = makeBlockXML(value, false);
  } else {
    const inputValue = value && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'value') ? value.value : value;
    inner = makeShadowXML(inputValue, value && value.type);
  }
  return `<${tag} name="${escapeXML(name)}">${inner}</${tag}>`;
};

const makeBlockXML = (block, isTopLevel) => {
  if (!block || typeof block.opcode !== 'string') throw new Error('脚本积木缺少 opcode');
  const position = isTopLevel ? ` x="${Number.isFinite(block.x) ? block.x : 80}" y="${Number.isFinite(block.y) ? block.y : 80}"` : '';
  let xml = `<block type="${escapeXML(block.opcode)}"${position}>`;
  xml += makeMutationXML(block.mutation);
  for (const [name, value] of Object.entries(block.fields || {})) {
    xml += makeFieldXML(name, value);
  }
  for (const [name, value] of Object.entries(block.inputs || {})) {
    xml += makeInputXML(name, value);
  }
  xml += makeCommentXML(block.comment);
  if (block.next) xml += `<next>${makeBlockXML(block.next, false)}</next>`;
  return `${xml}</block>`;
};

const normalizeBlocklyXML = xml => {
  if (typeof xml !== 'string' || !xml.trim()) throw new Error('AI XML 脚本为空');
  const trimmed = xml.trim();
  if (/<!doctype|<!entity|<script[\s>]/i.test(trimmed)) throw new Error('AI XML 包含不允许的内容');
  if (/^<xml[\s>]/i.test(trimmed)) return trimmed;
  if (/^<block[\s>]/i.test(trimmed) || /^<shadow[\s>]/i.test(trimmed)) return `<xml>${trimmed}</xml>`;
  throw new Error('AI XML 必须是 <xml> 或 <block>');
};

const makeOperationXML = operation => {
  const xml = operation.xml || operation.blocklyXml || operation.scriptXml;
  if (typeof xml === 'string') return normalizeBlocklyXML(xml);
  return `<xml>${makeBlockXML(getScriptRoot(operation.script), true)}</xml>`;
};

const getTarget = (vm, targetId) => vm && vm.runtime.targets.find(item => item.id === targetId);

const permissionForOperation = type => ({
  createVariable: 'updateVariable',
  deleteVariable: 'updateVariable',
  updateTarget: 'updateTarget',
  updateSprite: 'updateSprite',
  uploadCostume: 'updateTarget',
  uploadBackdrop: 'updateTarget',
  uploadSound: 'updateTarget',
  deleteCostume: 'updateTarget',
  deleteSound: 'updateTarget',
  selectTarget: 'updateTarget',
  duplicateTarget: 'manageTargets',
  deleteTarget: 'manageTargets',
  greenFlag: 'projectControl',
  stopAll: 'projectControl'
}[type] || type);

const hasOperationPermission = (permissions, permission) => Boolean(
  permissions && (
    permissions[permission] ||
    (permission === 'updateTarget' && permissions.updateSprite)
  )
);

const makeId = prefix => `${prefix || 'ai'}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const withEditingTarget = (vm, targetId, callback) => {
  const originalId = vm.editingTarget && vm.editingTarget.id;
  if (targetId && originalId !== targetId) {
    if (typeof vm.setEditingTarget !== 'function') throw new Error('当前 VM 不支持切换编辑目标');
    if (!getTarget(vm, targetId)) throw new Error(`目标不存在: ${targetId}`);
    vm.setEditingTarget(targetId);
  }
  try {
    return callback();
  } finally {
    if (originalId && vm.editingTarget && vm.editingTarget.id !== originalId && typeof vm.setEditingTarget === 'function') {
      vm.setEditingTarget(originalId);
    }
  }
};

const updateTargetProperties = (vm, operation) => {
  const target = getTarget(vm, operation.targetId);
  if (!target) throw new Error(`目标不存在: ${operation.targetId}`);
  if (!target.isStage && (Number.isFinite(operation.x) || Number.isFinite(operation.y))) {
    target.setXY(Number.isFinite(operation.x) ? operation.x : target.x, Number.isFinite(operation.y) ? operation.y : target.y);
  }
  if (!target.isStage && Number.isFinite(operation.direction)) target.setDirection(operation.direction);
  if (!target.isStage && Number.isFinite(operation.size)) target.setSize(operation.size);
  if (!target.isStage && typeof operation.visible === 'boolean') target.setVisible(operation.visible);
  if (!target.isStage && typeof operation.rotationStyle === 'string') target.setRotationStyle(operation.rotationStyle);
  if (!target.isStage && typeof operation.draggable === 'boolean') target.draggable = operation.draggable;
  if (Number.isFinite(operation.volume)) target.volume = operation.volume;
  if (Number.isInteger(operation.costumeIndex) && typeof target.setCostume === 'function') target.setCostume(operation.costumeIndex);
  if (typeof operation.costumeName === 'string' && typeof target.setCostume === 'function') {
    const costumes = target.getCostumes ? target.getCostumes() : [];
    const costumeIndex = costumes.findIndex(costume => costume && costume.name === operation.costumeName);
    if (costumeIndex < 0) throw new Error(`造型/背景不存在: ${operation.costumeName}`);
    target.setCostume(costumeIndex);
  }
  if (!target.isStage && typeof operation.name === 'string' && typeof vm.renameSprite === 'function') {
    vm.renameSprite(target.id, operation.name);
  }
};

const loadExtension = async (vm, operation) => {
  const manager = vm && vm.extensionManager;
  if (!manager) throw new Error('扩展管理器不可用');
  const extensionId = operation.extensionId || operation.id;
  const url = operation.url || operation.extensionURL;
  if (extensionId) {
    if (typeof manager.loadExtensionIdSync !== 'function') throw new Error('当前 VM 不支持加载内置扩展');
    manager.loadExtensionIdSync(extensionId);
    return extensionId;
  }
  if (url) {
    if (typeof manager.loadExtensionURL !== 'function') throw new Error('当前 VM 不支持加载外部扩展');
    await manager.loadExtensionURL(url);
    return url;
  }
  throw new Error('loadExtension 缺少 extensionId 或 url');
};

// 从 URL 下载资源并创建 scratch-storage asset（带 asset 属性，loadCostume 会直接用）
const createAssetFromURL = async (vm, url, {isVector, format}) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`资源下载失败: HTTP ${response.status}`);
  const data = new Uint8Array(await response.arrayBuffer());
  const storage = vm.runtime.storage;
  const assetType = isVector ? storage.AssetType.ImageVector : storage.AssetType.ImageBitmap;
  return storage.createAsset(assetType, format, data, null, true);
};

const addCostumeFromURL = async (vm, operation) => {
  const {targetId, name, url} = operation;
  if (!url) throw new Error('uploadCostume/uploadBackdrop 需要 url');
  const isVector = /\.svg(\?|$)/i.test(url);
  const format = isVector ? 'svg' : 'png';
  const asset = await createAssetFromURL(vm, url, {isVector, format});
  const md5ext = `${asset.assetId}.${format}`;
  const costumeObject = {
    name: name || 'AI 造型',
    bitmapResolution: isVector ? 1 : 2,
    dataFormat: format,
    rotationCenterX: 0,
    rotationCenterY: 0,
    asset,
    assetId: asset.assetId,
    md5ext
  };
  await vm.addCostume(md5ext, costumeObject, targetId);
  return md5ext;
};

const addSoundFromURL = async (vm, operation) => {
  const {targetId, name, url} = operation;
  if (!url) throw new Error('uploadSound 需要 url');
  const format = /\.wav(\?|$)/i.test(url) ? 'wav' : 'mp3';
  const response = await fetch(url);
  if (!response.ok) throw new Error(`资源下载失败: HTTP ${response.status}`);
  const data = new Uint8Array(await response.arrayBuffer());
  const storage = vm.runtime.storage;
  const asset = storage.createAsset(storage.AssetType.Sound, format, data, null, true);
  const md5ext = `${asset.assetId}.${format}`;
  const soundObject = {
    name: name || 'AI 声音',
    dataFormat: format,
    asset,
    assetId: asset.assetId,
    md5ext,
    format
  };
  await vm.addSound(soundObject, targetId);
  return md5ext;
};

const deleteResourceByName = (vm, operation, kind) => {
  const target = getTarget(vm, operation.targetId);
  if (!target) throw new Error(`目标不存在: ${operation.targetId}`);
  const items = kind === 'costume'
    ? (target.getCostumes ? target.getCostumes() : (target.sprite && target.sprite.costumes) || [])
    : (target.getSounds ? target.getSounds() : (target.sprite && target.sprite.sounds) || []);
  const index = items.findIndex(item => item && item.name === operation.name);
  if (index === -1) throw new Error(`${kind === 'costume' ? '造型' : '声音'}不存在: ${operation.name}`);
  if (kind === 'costume') target.deleteCostume(index);
  else target.deleteSound(index);
  return operation.name;
};

const createVariable = (vm, operation) => {
  const target = getTarget(vm, operation.targetId) || vm.editingTarget;
  if (!target) throw new Error(`目标不存在: ${operation.targetId || '当前目标'}`);
  const name = typeof operation.name === 'string' && operation.name.trim();
  if (!name) throw new Error('createVariable 缺少 name');
  const type = operation.variableType || operation.typeName || '';
  const id = operation.variableId || makeId(type === 'list' ? 'list' : 'var');
  target.createVariable(id, name, type === 'list' ? 'list' : '', Boolean(operation.isCloud));
  return id;
};

const deleteVariable = (vm, operation) => {
  const target = getTarget(vm, operation.targetId);
  if (!target) throw new Error(`目标不存在: ${operation.targetId}`);
  if (!operation.variableId || !target.variables || !target.variables[operation.variableId]) {
    throw new Error(`变量不存在: ${operation.variableId}`);
  }
  target.deleteVariable(operation.variableId);
  return operation.variableId;
};

const selectTarget = (vm, operation) => {
  if (!getTarget(vm, operation.targetId)) throw new Error(`目标不存在: ${operation.targetId}`);
  if (typeof vm.setEditingTarget !== 'function') throw new Error('当前 VM 不支持选择目标');
  vm.setEditingTarget(operation.targetId);
  return operation.targetId;
};

const duplicateTarget = async (vm, operation) => {
  const target = getTarget(vm, operation.targetId);
  if (!target || target.isStage) throw new Error(`不能复制目标: ${operation.targetId}`);
  if (typeof vm.duplicateSprite !== 'function') throw new Error('当前 VM 不支持复制角色');
  const duplicate = await vm.duplicateSprite(operation.targetId);
  return duplicate && duplicate.id || operation.targetId;
};

const deleteTarget = async (vm, operation) => {
  const target = getTarget(vm, operation.targetId);
  if (!target || target.isStage) throw new Error(`不能删除目标: ${operation.targetId}`);
  if (typeof vm.deleteSprite !== 'function') throw new Error('当前 VM 不支持删除角色');
  await vm.deleteSprite(operation.targetId);
  return operation.targetId;
};

const safeVmMethods = new Set([
  'greenFlag',
  'stopAll',
  'setTurboMode',
  'setInterpolation',
  'setFramerate',
  'setRuntimeOptions',
  'setEditingTarget'
]);

const safeTargetMethods = new Set([
  'setXY',
  'setDirection',
  'setSize',
  'setVisible',
  'setRotationStyle',
  'setCostume',
  'createVariable',
  'deleteVariable'
]);

const ensureSafeArgs = args => {
  const values = Array.isArray(args) ? args : [];
  if (values.length > 8) throw new Error('通用调用参数过多');
  for (const value of values) {
    if (value !== null && !['string', 'number', 'boolean', 'undefined'].includes(typeof value) && !Array.isArray(value) && typeof value !== 'object') {
      throw new Error('通用调用包含不安全参数');
    }
  }
  return values;
};

const callVmMethod = async (vm, operation) => {
  if (!safeVmMethods.has(operation.method) || typeof vm[operation.method] !== 'function') {
    throw new Error(`VM 方法不在白名单或不存在: ${operation.method}`);
  }
  const result = await vm[operation.method](...ensureSafeArgs(operation.args));
  return {method: operation.method, result: result && result.id ? result.id : undefined};
};

const callTargetMethod = async (vm, operation) => {
  const target = getTarget(vm, operation.targetId) || vm.editingTarget;
  if (!target) throw new Error(`目标不存在: ${operation.targetId || '当前目标'}`);
  if (!safeTargetMethods.has(operation.method) || typeof target[operation.method] !== 'function') {
    throw new Error(`目标方法不在白名单或不存在: ${operation.method}`);
  }
  const result = await target[operation.method](...ensureSafeArgs(operation.args));
  return {targetId: target.id, method: operation.method, result: result && result.id ? result.id : undefined};
};

const applyOperations = async (vm, operations, permissions) => {
  const Blockly = window.ScratchBlocks || window.Blockly;
  const workspace = Blockly && Blockly.getMainWorkspace && Blockly.getMainWorkspace();
  if (!workspace) throw new Error('积木编辑器尚未就绪');
  if (!Array.isArray(operations)) throw new Error('AI 操作不是数组');
  const group = `hiwarp-ai-${Date.now()}`;
  const results = [];
  const events = Blockly.Events;
  if (events && typeof events.setGroup === 'function') events.setGroup(group);
  try {
    for (const operation of operations) {
      const permission = operation && permissionForOperation(operation.type);
      if (!operation || !hasOperationPermission(permissions, permission)) throw new Error(`未授权的 AI 操作: ${operation && operation.type}`);
      if (operation.type === 'insertScript') {
        const xml = makeOperationXML(operation);
        const ids = withEditingTarget(vm, operation.targetId, () => Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(xml), workspace));
        results.push({type: operation.type, ids});
      } else if (operation.type === 'replaceScript') {
        const xml = makeOperationXML(operation);
        const ids = withEditingTarget(vm, operation.targetId, () => {
          const oldBlock = workspace.getBlockById(operation.rootBlockId);
          if (!oldBlock) throw new Error(`脚本已不存在: ${operation.rootBlockId}`);
          oldBlock.dispose(true);
          return Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(xml), workspace);
        });
        results.push({type: operation.type, ids});
      } else if (operation.type === 'deleteScript') {
        withEditingTarget(vm, operation.targetId, () => {
          const oldBlock = workspace.getBlockById(operation.rootBlockId);
          if (!oldBlock) throw new Error(`脚本已不存在: ${operation.rootBlockId}`);
          oldBlock.dispose(true);
        });
        results.push({type: operation.type, id: operation.rootBlockId});
      } else if (operation.type === 'updateVariable') {
        const target = getTarget(vm, operation.targetId);
        const variable = target && target.variables && target.variables[operation.variableId];
        if (!variable) throw new Error('变量不存在或目标角色已改变');
        variable.value = operation.value;
        results.push({type: operation.type, id: operation.variableId});
      } else if (operation.type === 'createVariable') {
        results.push({type: operation.type, id: createVariable(vm, operation)});
      } else if (operation.type === 'deleteVariable') {
        results.push({type: operation.type, id: deleteVariable(vm, operation)});
      } else if (operation.type === 'updateSprite' || operation.type === 'updateTarget') {
        updateTargetProperties(vm, operation);
        results.push({type: operation.type, id: operation.targetId});
      } else if (operation.type === 'selectTarget') {
        results.push({type: operation.type, id: selectTarget(vm, operation)});
      } else if (operation.type === 'duplicateTarget') {
        results.push({type: operation.type, id: await duplicateTarget(vm, operation)});
      } else if (operation.type === 'deleteTarget') {
        results.push({type: operation.type, id: await deleteTarget(vm, operation)});
      } else if (operation.type === 'loadExtension') {
        const id = await loadExtension(vm, operation);
        results.push({type: operation.type, id});
      } else if (operation.type === 'uploadCostume' || operation.type === 'uploadBackdrop') {
        const md5ext = await addCostumeFromURL(vm, operation);
        results.push({type: operation.type, id: md5ext});
      } else if (operation.type === 'uploadSound') {
        const md5ext = await addSoundFromURL(vm, operation);
        results.push({type: operation.type, id: md5ext});
      } else if (operation.type === 'deleteCostume') {
        results.push({type: operation.type, id: deleteResourceByName(vm, operation, 'costume')});
      } else if (operation.type === 'deleteSound') {
        results.push({type: operation.type, id: deleteResourceByName(vm, operation, 'sound')});
      } else if (operation.type === 'greenFlag') {
        vm.greenFlag();
        results.push({type: operation.type});
      } else if (operation.type === 'stopAll') {
        vm.stopAll();
        results.push({type: operation.type});
      } else if (operation.type === 'callVmMethod') {
        results.push({type: operation.type, ...(await callVmMethod(vm, operation))});
      } else if (operation.type === 'callTargetMethod') {
        results.push({type: operation.type, ...(await callTargetMethod(vm, operation))});
      } else {
        throw new Error(`未知 AI 操作: ${operation.type}`);
      }
    }
  } finally {
    if (events && typeof events.setGroup === 'function') events.setGroup(false);
  }
  console.info('[AI] operations applied', results);
  return {ok: true, results};
};

// 把 AI 操作汇总成可读描述（审查用）
const describeOperations = (vm, operations) => {
  const nameOf = id => {
    const target = getTarget(vm, id);
    return target ? (target.isStage ? '舞台' : target.name) : id;
  };
  return (operations || []).map(op => {
    switch (op && op.type) {
    case 'insertScript':
      return `向 ${nameOf(op.targetId)} 插入 1 条脚本`;
    case 'replaceScript':
      return `替换 ${nameOf(op.targetId)} 的脚本 ${op.rootBlockId || ''}`;
    case 'deleteScript':
      return `删除 ${nameOf(op.targetId)} 的脚本 ${op.rootBlockId || ''}`;
    case 'loadExtension':
      return `加载扩展 ${op.extensionId || op.url || ''}`;
    case 'uploadCostume':
      return `给 ${nameOf(op.targetId)} 添加造型 "${op.name || ''}"（${op.url || ''}）`;
    case 'uploadBackdrop':
      return `给舞台添加背景 "${op.name || ''}"（${op.url || ''}）`;
    case 'uploadSound':
      return `给 ${nameOf(op.targetId)} 添加声音 "${op.name || ''}"（${op.url || ''}）`;
    case 'deleteCostume':
      return `删除 ${nameOf(op.targetId)} 的造型 "${op.name || ''}"`;
    case 'deleteSound':
      return `删除 ${nameOf(op.targetId)} 的声音 "${op.name || ''}"`;
    case 'updateVariable':
      return `修改变量 ${op.variableId || ''} 的值为 ${JSON.stringify(op.value)}`;
    case 'createVariable':
      return `创建变量 ${op.name || ''}`;
    case 'deleteVariable':
      return `删除变量 ${op.variableId || ''}`;
    case 'updateSprite':
    case 'updateTarget':
      return `修改 ${nameOf(op.targetId)} 的属性`;
    case 'selectTarget':
      return `选中 ${nameOf(op.targetId)}`;
    case 'duplicateTarget':
      return `复制角色 ${nameOf(op.targetId)}`;
    case 'deleteTarget':
      return `删除角色 ${nameOf(op.targetId)}`;
    case 'greenFlag':
      return '点击绿旗';
    case 'stopAll':
      return '停止全部';
    default:
      return op && op.type ? `执行操作 ${op.type}` : '未知操作';
    }
  });
};

// 对操作涉及的目标保存积木快照 + 变量旧值（撤销用）
const snapshotForOperations = (vm, operations) => {
  const Blockly = window.ScratchBlocks || window.Blockly;
  const workspace = Blockly && Blockly.getMainWorkspace && Blockly.getMainWorkspace();
  const snapshots = new Map();
  const variableBefore = {};
  if (!workspace) return {snapshots, variableBefore};
  const targetIds = new Set((operations || []).map(op => op && op.targetId).filter(Boolean));
  for (const targetId of targetIds) {
    const target = getTarget(vm, targetId);
    if (!target) continue;
    const originalId = vm.editingTarget && vm.editingTarget.id;
    if (originalId !== targetId && typeof vm.setEditingTarget === 'function') {
      vm.setEditingTarget(targetId);
    }
    try {
      const dom = Blockly.Xml.workspaceToDom(workspace);
      snapshots.set(targetId, Blockly.Xml.domToText(dom));
    } catch (error) {
      // 快照失败不阻断操作
    }
    if (originalId && originalId !== targetId && typeof vm.setEditingTarget === 'function') {
      vm.setEditingTarget(originalId);
    }
  }
  for (const op of operations || []) {
    if (op && op.type === 'updateVariable' && op.targetId && op.variableId) {
      const target = getTarget(vm, op.targetId);
      const variable = target && target.variables && target.variables[op.variableId];
      if (variable) variableBefore[`${op.targetId}:${op.variableId}`] = variable.value;
    }
  }
  return {snapshots, variableBefore};
};

class AIChatSidebar extends React.Component {
  constructor (props) {
    super(props);
    this.state = {
      open: false,
      service: null,
      text: '',
      apiKey: '',
      isListening: false,
      speakingMessageId: null,
      customSelection: {targetIds: [], scriptIds: {}},
      tabPosition: {right: 0, topRatio: 0.42},
      freeStatusText: '',
      freeLoginWaiting: false,
      pendingReview: null,
      undoStack: []
    };
    this.tabDrag = null;
    this.speechUtterance = null;
  }

  componentDidMount () {
    this.unsubscribeState = EditorPreload.ai.onState(service => this.setState({service}));
    this.unsubscribeContext = EditorPreload.ai.onContextRequest(request => {
      try {
        EditorPreload.ai.respond({id: request.id, result: makeContext(this.props.vm, request.mode, request.selection)});
      } catch (error) {
        console.error('[AI] context export failed', error);
        EditorPreload.ai.respond({id: request.id, error: error.message});
      }
    });
    this.unsubscribeApply = EditorPreload.ai.onApplyOperations(request => {
      // 执行前审查：先展示操作清单，等用户确认/拒绝
      this.setState({pendingReview: request, open: true});
    });
    EditorPreload.ai.getState().then(service => {
      this.setState({service});
      if (service && service.config && service.config.freeDeepSeek) {
        this.checkFreeLogin();
      }
    });
    this.publishCatalog();
  }

  componentWillUnmount () {
    this.unsubscribeState && this.unsubscribeState();
    this.unsubscribeContext && this.unsubscribeContext();
    this.unsubscribeApply && this.unsubscribeApply();
    this.stopSpeaking();
    this.stopTabDrag();
  }

  publishCatalog () {
    EditorPreload.ai.setContextCatalog(makeCatalog(this.props.vm));
  }

  async confirmApply () {
    const request = this.state.pendingReview;
    if (!request) return;
    this.setState({pendingReview: null});
    const snapshot = snapshotForOperations(this.props.vm, request.operations);
    try {
      const result = await applyOperations(this.props.vm, request.operations, request.permissions);
      this.setState(state => ({
        undoStack: [...state.undoStack.slice(-9), {
          snapshots: snapshot.snapshots,
          variableBefore: snapshot.variableBefore
        }]
      }));
      EditorPreload.ai.respond({id: request.id, result});
    } catch (error) {
      console.error('[AI] operation apply failed', error);
      EditorPreload.ai.respond({id: request.id, error: error.message});
    }
  }

  rejectApply () {
    const request = this.state.pendingReview;
    if (!request) return;
    this.setState({pendingReview: null});
    EditorPreload.ai.respond({
      id: request.id,
      result: {ok: true, rejected: true, results: []}
    });
  }

  async undoLastOperation () {
    const undo = this.state.undoStack[this.state.undoStack.length - 1];
    if (!undo) return;
    const vm = this.props.vm;
    const Blockly = window.ScratchBlocks || window.Blockly;
    const workspace = Blockly && Blockly.getMainWorkspace && Blockly.getMainWorkspace();
    if (!workspace) throw new Error('积木编辑器尚未就绪');
    for (const [targetId, xml] of undo.snapshots) {
      withEditingTarget(vm, targetId, () => {
        workspace.getAllBlocks(false).forEach(block => block.dispose(true));
        Blockly.Xml.domToWorkspace(Blockly.Xml.textToDom(xml), workspace);
      });
    }
    for (const [key, value] of Object.entries(undo.variableBefore || {})) {
      const [targetId, variableId] = key.split(':');
      const target = getTarget(vm, targetId);
      const variable = target && target.variables && target.variables[variableId];
      if (variable) variable.value = value;
    }
    this.setState(state => ({
      undoStack: state.undoStack.slice(0, -1),
      freeStatusText: '已撤销最近一次 AI 操作。'
    }));
  }

  async checkFreeLogin () {
    this.setState({freeStatusText: '正在检查 DeepSeek 登录状态...'});
    try {
      const result = await EditorPreload.ai.freeCheckLogin();
      this.setState({
        freeStatusText: result && result.ok
          ? (result.hasSession ? '已登录 DeepSeek 网页版。' : '未登录，点击“登录 DeepSeek”在浏览器中完成登录。')
          : `检查失败: ${formatFreeError((result && result.error) || '未知错误')}`
      });
    } catch (error) {
      this.setState({freeStatusText: `检查失败: ${formatFreeError(error.message)}`});
    }
  }

  async freeLogin () {
    this.setState({freeLoginWaiting: true, freeStatusText: '正在打开浏览器，请在弹出的 DeepSeek 页面中完成登录（手机号/邮箱 + 验证码）...'});
    try {
      const result = await EditorPreload.ai.freeLogin();
      this.setState({
        freeStatusText: result && result.ok ? '登录完成，可以直接使用了。' : `登录未完成: ${formatFreeError((result && result.error) || '未知错误')}`
      });
    } catch (error) {
      this.setState({freeStatusText: `登录失败: ${formatFreeError(error.message)}`});
    } finally {
      this.setState({freeLoginWaiting: false});
    }
  }

  async freeClose () {
    try {
      const result = await EditorPreload.ai.freeClose();
      this.setState({
        freeStatusText: result && result.ok ? '已关闭 DeepSeek 浏览器进程。' : `关闭失败: ${(result && result.error) || '未知错误'}`
      });
    } catch (error) {
      this.setState({freeStatusText: `关闭失败: ${error.message}`});
    }
  }

  async saveConfig () {
    const config = this.state.service.config;
    await EditorPreload.ai.saveConfig({...config, apiKey: this.state.apiKey});
    this.setState({apiKey: ''});
  }

  updateConfig (name, value) {
    this.setState(state => ({
      service: {...state.service, config: {...state.service.config, [name]: value}}
    }));
  }

  updateWebSearchConfig (name, value) {
    this.setState(state => ({
      service: {
        ...state.service,
        config: {
          ...state.service.config,
          webSearch: {
            ...(state.service.config.webSearch || {}),
            [name]: value
          }
        }
      }
    }));
  }

  updatePermission (permission, enabled) {
    this.setState(state => ({
      service: {
        ...state.service,
        config: {
          ...state.service.config,
          permissions: {...state.service.config.permissions, [permission]: enabled}
        }
      }
    }));
  }

  toggleTarget (id) {
    this.setState(state => ({
      customSelection: {
        ...state.customSelection,
        targetIds: state.customSelection.targetIds.includes(id) ?
          state.customSelection.targetIds.filter(item => item !== id) :
          [...state.customSelection.targetIds, id]
      }
    }));
  }

  toggleScript (targetId, id) {
    this.setState(state => {
      const scripts = state.customSelection.scriptIds[targetId] || [];
      return {
        customSelection: {
          ...state.customSelection,
          scriptIds: {
            ...state.customSelection.scriptIds,
            [targetId]: scripts.includes(id) ? scripts.filter(item => item !== id) : [...scripts, id]
          }
        }
      };
    });
  }

  async sendText (text, selection) {
    const trimmedText = String(text || '').trim();
    if (!trimmedText) return;
    this.setState({text: ''});
    try {
      await EditorPreload.ai.sendMessage(trimmedText, selection);
    } catch (error) {
      console.error('[AI] send failed', error);
      alert(error.message);
    }
  }

  async send (selection) {
    const text = this.state.text.trim();
    if (!text) return;
    return this.sendText(text, selection);
  }

  appendVoiceText (text) {
    const trimmedText = String(text || '').trim();
    if (!trimmedText) return;
    this.setState(state => {
      const current = String(state.text || '');
      const separator = current && !/\s$/.test(current) ? ' ' : '';
      return {text: `${current}${separator}${trimmedText}`};
    });
  }

  async startVoiceInput () {
    if (this.state.isListening) return;
    if (!EditorPreload.ai || typeof EditorPreload.ai.recognizeSpeech !== 'function') {
      alert('当前版本不支持本地语音识别。');
      return;
    }
    this.setState({isListening: true});
    try {
      const text = await EditorPreload.ai.recognizeSpeech();
      this.appendVoiceText(text);
    } catch (error) {
      console.error('[AI] native speech recognition failed', error);
      alert(error.message);
    } finally {
      this.setState({isListening: false});
    }
  }

  stopSpeaking () {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.speechUtterance = null;
    this.setState({speakingMessageId: null});
  }

  toggleSpeakMessage (messageId, text) {
    if (this.state.speakingMessageId === messageId) {
      this.stopSpeaking();
      return;
    }
    if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) {
      alert('当前系统不支持朗读。');
      return;
    }
    const speechText = getSpeakableAIText(text);
    if (!speechText) return;
    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(speechText);
    utterance.lang = 'zh-CN';
    utterance.rate = 1;
    utterance.onend = () => {
      if (this.speechUtterance === utterance) {
        this.speechUtterance = null;
        this.setState({speakingMessageId: null});
      }
    };
    utterance.onerror = utterance.onend;
    this.speechUtterance = utterance;
    this.setState({speakingMessageId: messageId});
    window.speechSynthesis.speak(utterance);
  }

  async continueLastSession () {
    try {
      await EditorPreload.ai.continueLastSession();
    } catch (error) {
      console.error('[AI] continue last session failed', error);
      alert(error.message);
    }
  }

  async startNewSession () {
    try {
      await EditorPreload.ai.startNewSession();
    } catch (error) {
      console.error('[AI] start new session failed', error);
      alert(error.message);
    }
  }

  startTabDrag (event) {
    if (event.button !== 0) return;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
    const startTop = this.state.tabPosition.topRatio * viewportHeight;
    this.tabDrag = {
      startX: event.clientX,
      startY: event.clientY,
      startTop,
      moved: false
    };
    window.addEventListener('mousemove', this.handleTabDrag);
    window.addEventListener('mouseup', this.stopTabDrag);
    event.preventDefault();
  }

  handleTabDrag = event => {
    if (!this.tabDrag) return;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 1;
    const deltaX = event.clientX - this.tabDrag.startX;
    const deltaY = event.clientY - this.tabDrag.startY;
    if (Math.abs(deltaX) + Math.abs(deltaY) > 4) this.tabDrag.moved = true;
    const nextTop = Math.min(Math.max(this.tabDrag.startTop + deltaY, 24), Math.max(24, viewportHeight - 120));
    this.setState({tabPosition: {right: 0, topRatio: nextTop / viewportHeight}});
  };

  stopTabDrag = event => {
    if (!this.tabDrag) return;
    const shouldOpen = event && !this.tabDrag.moved;
    this.tabDrag = null;
    window.removeEventListener('mousemove', this.handleTabDrag);
    window.removeEventListener('mouseup', this.stopTabDrag);
    if (shouldOpen) this.setState({open: true});
  };

  render () {
    const service = this.state.service;
    const config = service && service.config;
    if (!service || !config) return null;
    const selection = this.state.customSelection;
    return <React.Fragment>
      {!this.state.open && <DockableTab tabKey="ai" label="AI 助手" side="right" onOpen={() => this.setState({open: true})} />}
      {this.state.open && <aside style={drawerStyle}>
        <header style={headerStyle}>
          <div>
            <strong style={{fontSize: '1.12rem', letterSpacing: '0.02em'}}>AI 助手</strong>
            <div style={{fontSize: '0.74rem', color: '#9cb8c4', marginTop: '0.18rem'}}>Scratch 智能编程伙伴</div>
          </div>
          <div style={headerActionsStyle}>
            {service.messages.length > 0 && <button style={subtleButtonStyle} onClick={() => this.startNewSession()}>新会话</button>}
            <button style={buttonStyle} onClick={() => EditorPreload.openAIChat()}>独立窗口</button>
            <button style={subtleButtonStyle} onClick={() => EditorPreload.openLogDirectory()}>日志</button>
            <button style={subtleButtonStyle} onClick={() => this.setState({open: false})}>关闭</button>
          </div>
        </header>
        {this.state.pendingReview && <div style={reviewCardStyle}>
          <div style={{fontWeight: 700, color: '#ffd166', marginBottom: '0.45rem'}}>AI 请求执行以下操作，请审查：</div>
          <ul style={{margin: 0, paddingLeft: '1.1rem', lineHeight: 1.7, color: '#e8f0f4'}}>
            {describeOperations(this.props.vm, this.state.pendingReview.operations).map((desc, index) => (
              <li key={index}>{desc}</li>
            ))}
          </ul>
          <div style={{display: 'flex', gap: '0.5rem', marginTop: '0.65rem'}}>
            <button style={{...buttonStyle, flex: 1}} onClick={() => this.confirmApply()}>确认执行</button>
            <button style={{...subtleButtonStyle, flex: 1}} onClick={() => this.rejectApply()}>拒绝</button>
          </div>
        </div>}
        <details style={settingsStyle}>
          <summary style={summaryStyle}>接口、权限与上下文设置</summary>
          <label style={fieldLabelStyle}><input type="checkbox" checked={Boolean(config.freeDeepSeek)} onChange={event => this.updateConfig('freeDeepSeek', event.currentTarget.checked)} />免费使用 DeepSeek（无需 API Key）</label>
          {config.freeDeepSeek && <React.Fragment>
            <label style={fieldLabelStyle}>Python 解释器（留空用系统 python）<input value={config.freeDeepSeekPython || ''} placeholder="例如 C:\Users\...\.venv\Scripts\python.exe" onChange={event => this.updateConfig('freeDeepSeekPython', event.currentTarget.value)} style={inputStyle} /></label>
            <div style={actionRowStyle}>
              <button style={subtleButtonStyle} onClick={() => this.checkFreeLogin()}>检查登录</button>
              <button style={warningButtonStyle} disabled={this.state.freeLoginWaiting} onClick={() => this.freeLogin()}>{this.state.freeLoginWaiting ? '等待登录...' : '登录 DeepSeek'}</button>
              <button style={subtleButtonStyle} onClick={() => this.freeClose()}>关闭浏览器</button>
            </div>
            <p style={{color: '#9cb8c4', fontSize: '0.78rem', margin: '0.55rem 0 0'}}>{this.state.freeStatusText || '首次使用需登录 DeepSeek 网页账号，登录态会保存在本地。'}</p>
          </React.Fragment>}
          <label style={fieldLabelStyle}>API 地址<input value={config.apiUrl} onChange={event => this.updateConfig('apiUrl', event.currentTarget.value)} style={inputStyle} /></label>
          <label style={fieldLabelStyle}>API Key<input type="password" value={this.state.apiKey} placeholder={config.hasApiKey ? '已安全保存；留空则不修改' : '请输入 API Key'} onChange={event => this.setState({apiKey: event.currentTarget.value})} style={inputStyle} /></label>
          <label style={fieldLabelStyle}>模型<input value={config.model} onChange={event => this.updateConfig('model', event.currentTarget.value)} style={inputStyle} /></label>
          <div style={actionRowStyle}><button style={buttonStyle} onClick={() => EditorPreload.ai.fetchModels().then(models => this.setState(state => ({service: {...state.service, modelChoices: models}}))).catch(error => alert(error.message))}>获取模型</button></div>
          {(service.modelChoices || []).length > 0 && <select aria-label="模型列表" value={config.model} style={inputStyle} onChange={event => this.updateConfig('model', event.currentTarget.value)}><option value="">选择模型</option>{service.modelChoices.map(model => <option key={model} value={model}>{model}</option>)}</select>}
          <label style={fieldLabelStyle}>搜索网址模板<input value={(config.webSearch && config.webSearch.urlTemplate) || ''} placeholder="https://cn.bing.com/search?q={ask}" onChange={event => this.updateWebSearchConfig('urlTemplate', event.currentTarget.value)} style={inputStyle} /></label>
          <label style={fieldLabelStyle}>选择代理<select style={inputStyle} value={(config.webSearch && config.webSearch.proxyMode) || 'system'} onChange={event => this.updateWebSearchConfig('proxyMode', event.currentTarget.value)}><option value="system">使用系统代理</option><option value="none">不使用代理</option><option value="custom">设置代理地址</option></select></label>
          {(config.webSearch && config.webSearch.proxyMode) === 'custom' && <label style={fieldLabelStyle}>代理地址<input value={(config.webSearch && config.webSearch.proxyAddress) || ''} placeholder="http://127.0.0.1:7890" onChange={event => this.updateWebSearchConfig('proxyAddress', event.currentTarget.value)} style={inputStyle} /></label>}
          <label style={fieldLabelStyle}>选择请求工具<select style={inputStyle} value={(config.webSearch && config.webSearch.requestTool) || 'curl'} onChange={event => this.updateWebSearchConfig('requestTool', event.currentTarget.value)}><option value="curl">系统的 Curl</option><option value="python-requests">Python 的 Requests</option><option value="custom">自定义指令</option></select></label>
          {(config.webSearch && config.webSearch.requestTool) === 'custom' && <label style={fieldLabelStyle}>自定义指令<input value={(config.webSearch && config.webSearch.customCommand) || ''} placeholder={'curl -L "{url}"'} onChange={event => this.updateWebSearchConfig('customCommand', event.currentTarget.value)} style={inputStyle} /></label>}
          <label style={fieldLabelStyle}>上下文<select style={inputStyle} value={config.contextMode} onChange={event => this.updateConfig('contextMode', event.currentTarget.value)}><option value="target">这个角色</option><option value="project">这个项目</option><option value="custom">自定义</option></select></label>
          {config.contextMode === 'custom' && <div style={{marginTop: '0.7rem', padding: '0.55rem', borderRadius: '0.75rem', background: 'rgba(8, 21, 29, 0.5)'}}>{service.contextCatalog.map(target => <div key={target.id}><label><input type="checkbox" checked={selection.targetIds.includes(target.id)} onChange={() => this.toggleTarget(target.id)} />{target.name}</label>{selection.targetIds.includes(target.id) && target.scripts.map(script => <label key={script.id} style={{display: 'block', marginLeft: '1rem'}}><input type="checkbox" checked={(selection.scriptIds[target.id] || []).includes(script.id)} onChange={() => this.toggleScript(target.id, script.id)} />{script.opcode}</label>)}</div>)}</div>}
          <div style={permissionGridStyle}>{Object.entries(config.permissions).map(([permission, enabled]) => <label key={permission} style={{display: 'block'}}><input type="checkbox" checked={enabled} onChange={event => this.updatePermission(permission, event.currentTarget.checked)} />{permissionNames[permission] || permission}</label>)}</div>
          <div style={actionRowStyle}><button style={buttonStyle} onClick={() => this.saveConfig()}>保存设置</button><button style={warningButtonStyle} onClick={() => { this.publishCatalog(); EditorPreload.ai.uploadContext(selection).catch(error => alert(error.message)); }}>上传上下文</button></div>
          {!config.secureStorageAvailable && <p style={{color: '#ffd166'}}>系统安全存储不可用，API Key 只会保留到本次运行结束。</p>}
        </details>
        <main style={messageListStyle}>{service.messages.map((message, index) => {
          const messageId = `message-${index}`;
          const isSpeaking = this.state.speakingMessageId === messageId;
          return <div key={index} style={messageBubbleStyle(message.role)}>
          <div style={messageHeaderStyle}>
            <b>{message.role === 'user' ? '你' : 'AI'}:</b>
            {message.role !== 'user' && <button
              aria-label="朗读这条 AI 消息"
              style={speakButtonStyle}
              onClick={() => this.toggleSpeakMessage(messageId, message.content)}
            >{isSpeaking ? '停止' : '朗读'}</button>}
          </div>
          <div style={messageTextStyle}>{message.content}</div>
          {message.error && <div style={{color: '#ff8a80'}}>{message.error}</div>}
          {message.operationResult && <div style={{color: message.operationResult.ok === false ? '#ff8a80' : '#9be7a1'}}>
            {message.operationResult.ok === false
              ? `AI 操作执行失败: ${message.operationResult.error || '未知错误'}`
              : (message.operationResult.rejected ? '已跳过（你拒绝了本次操作）。' : '已自动执行 AI 操作。')}
            {message.operationResult.ok && !message.operationResult.rejected && (
              <button style={undoButtonStyle} onClick={() => this.undoLastOperation().catch(error => alert(error.message))}>撤销</button>
            )}
          </div>}
        </div>;
        })}</main>
        {service.canContinueLastSession && <div style={sessionCardStyle}>
          <div style={{fontWeight: 700, marginBottom: '0.35rem'}}>发现上次 AI 会话</div>
          <div style={{fontSize: '0.78rem', color: '#a8c2cf', marginBottom: '0.6rem'}}>可恢复 {service.savedSessionMessageCount || 0} 条消息，当前新会话不会自动加载。</div>
          <button style={buttonStyle} onClick={() => this.continueLastSession()}>延续上次会话</button>
        </div>}
        <footer style={footerStyle}>
          <textarea value={this.state.text} disabled={service.isStreaming} onChange={event => this.setState({text: event.currentTarget.value})} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); this.send(selection); } }} style={{...inputStyle, minHeight: '3.2rem', resize: 'vertical'}} placeholder="描述要实现的 Scratch 功能" />
          <button style={subtleButtonStyle} disabled={this.state.isListening} onClick={() => this.startVoiceInput()}>{this.state.isListening ? '聆听中' : '语音'}</button>
          <button style={buttonStyle} disabled={service.isStreaming} onClick={() => this.send(selection)}>发送</button>
        </footer>
      </aside>}
    </React.Fragment>;
  }
}

export default AIChatSidebar;
