/**
 * ScratchText —— Scratch Project for HiWarp（.sp）语言核心
 *
 * 一个 .sp 文件描述整个项目：项目标题、项目级设置（帧率/编译器/扩展等）、
 * 以及舞台与多个角色的脚本。
 *
 * 示例：
 *
 *   项目: 我的项目
 *   设置 帧率 60
 *   设置 补帧 开启
 *   导入扩展 pen
 *
 *   舞台:
 *     当绿旗被点击
 *       说 你好
 *
 *   角色: 角色1
 *     当绿旗被点击
 *       重复 999 次
 *         移动 10 步
 *
 * 本模块提供：
 *   parse(text)              —— 文本 → AST
 *   compileToXML(ast, index) —— 单个目标 → Blockly XML（插入模式）
 *   compileToProjectJSON(ast)—— 整个项目 → project.json（加载模式）
 */

// ---------------------------------------------------------------------------
// 1. 语法定义
// ---------------------------------------------------------------------------

// 帽子积木
const HATS = {
  '当绿旗被点击': {type: 'event_whenflagclicked'},
  '当角色被点击': {type: 'event_whenthisspriteclicked'}
};

// 普通语句
const STATEMENTS = [
  {
    test: /^说\s+(.+?)(?:\s+持续\s+([0-9.]+)\s*秒)?$/,
    build: m => (m[2] ? {
      type: 'looks_sayforsecs',
      inputs: {MESSAGE: m[1], SECS: m[2]}
    } : {
      type: 'looks_say',
      inputs: {MESSAGE: m[1]}
    })
  },
  {
    test: /^思考\s+(.+)$/,
    build: m => ({type: 'looks_think', inputs: {MESSAGE: m[1]}})
  },
  {
    test: /^移动\s+(-?[0-9.]+)\s*步$/,
    build: m => ({type: 'motion_movesteps', inputs: {STEPS: m[1]}})
  },
  {
    test: /^(左|右)转\s+(-?[0-9.]+)\s*度$/,
    build: m => ({type: m[1] === '右' ? 'motion_turnright' : 'motion_turnleft', inputs: {DEGREES: m[2]}})
  },
  {
    test: /^面向\s+(-?[0-9.]+)\s*度$/,
    build: m => ({type: 'motion_pointindirection', inputs: {DIRECTION: m[1]}})
  },
  {
    test: /^移到\s*x:(-?[0-9.]+)\s*y:(-?[0-9.]+)$/,
    build: m => ({type: 'motion_gotoxy', inputs: {X: m[1], Y: m[2]}})
  },
  {
    test: /^等待\s+([0-9.]+)\s*秒$/,
    build: m => ({type: 'control_wait', inputs: {DURATION: m[1]}})
  },
  {
    test: /^重复\s+([0-9]+)\s*次$/,
    build: m => ({type: 'control_repeat', inputs: {TIMES: m[1]}})
  },
  {
    test: /^重复无限次$/,
    build: () => ({type: 'control_forever'})
  },
  {
    test: /^如果\s+(.+?)\s*那么$/,
    build: m => ({type: 'control_if_else', conditionText: m[1]})
  },
  {
    test: /^停止\s+(全部|这个脚本)$/,
    build: m => ({type: 'control_stop', fields: {STOP_OPTION: m[1] === '全部' ? 'all' : 'this script'}})
  },
  {
    test: /^(显示|隐藏)$/,
    build: m => ({type: m[1] === '显示' ? 'looks_show' : 'looks_hide'})
  },
  {
    test: /^广播\s+(.+)$/,
    build: m => ({type: 'event_broadcast', inputs: {BROADCAST_INPUT: m[1]}})
  },
  {
    test: /^换成\s+(.+?)\s*造型$/,
    build: m => ({type: 'looks_switchcostumeto', inputs: {COSTUME: m[1]}})
  },
  {
    test: /^将\s+(.+?)\s*设为\s+(.+)$/,
    build: m => ({type: 'data_setvariableto', fields: {VARIABLE: m[1]}, inputs: {VALUE: m[2]}})
  },
  {
    test: /^将\s+(.+?)\s*增加\s+(-?[0-9.]+)$/,
    build: m => ({type: 'data_changevariableby', fields: {VARIABLE: m[1]}, inputs: {VALUE: m[2]}})
  },
  {
    test: /^播放声音\s+(.+)$/,
    build: m => ({type: 'sound_play', inputs: {SOUND_MENU: m[1]}})
  }
];

// 条件表达式
const CONDITIONS = [
  {
    test: /^按下鼠标[？?]$/,
    build: () => ({type: 'sensing_mousedown'})
  },
  {
    test: /^按下\s+(.+?)\s*键[？?]$/,
    build: m => ({type: 'sensing_keypressed', fields: {KEY_OPTION: m[1]}})
  },
  {
    test: /^(.+?)\s*(大于|小于|等于)\s*(.+)$/,
    build: m => ({
      type: m[2] === '大于' ? 'operator_gt' : m[2] === '小于' ? 'operator_lt' : 'operator_equals',
      inputs: {OPERAND1: m[1], OPERAND2: m[3]}
    })
  }
];

// 项目级设置指令：键 → 归一化（供面板应用）
const SETTINGS = {
  '帧率': {key: 'framerate', type: 'number'},
  'fps': {key: 'framerate', type: 'number'},
  '补帧': {key: 'interpolation', type: 'boolean'},
  '高清画笔': {key: 'highQualityPen', type: 'boolean'},
  '无限克隆': {key: 'infiniteClones', type: 'boolean'},
  '移除围栏': {key: 'removeFencing', type: 'boolean'},
  '移除杂项限制': {key: 'removeMiscLimits', type: 'boolean'},
  '编译器快速计时器': {key: 'warpTimer', type: 'boolean'},
  '编译器': {key: 'compiler', type: 'boolean'},
  'Turbo模式': {key: 'turboMode', type: 'boolean'},
  '兼容模式': {key: 'compatibilityMode', type: 'boolean'},
  '舞台尺寸': {key: 'stageSize', type: 'stageSize'}
};

// 输入名 → shadow 类型
const SHADOW_FOR_INPUT = {
  STEPS: 'math_number',
  DEGREES: 'math_number',
  DIRECTION: 'math_number',
  X: 'math_number',
  Y: 'math_number',
  DURATION: 'math_positive_number',
  TIMES: 'math_positive_number',
  SECS: 'math_number',
  MESSAGE: 'text',
  VALUE: 'text',
  OPERAND1: 'math_number',
  OPERAND2: 'math_number',
  CONDITION: 'logic_boolean',
  BROADCAST_INPUT: 'broadcast',
  COSTUME: 'costume',
  SOUND_MENU: 'sound'
};

const SHADOW_FIELD = {
  math_number: 'NUM',
  math_positive_number: 'NUM',
  math_whole_number: 'NUM',
  text: 'TEXT',
  logic_boolean: 'BOOL',
  broadcast: 'BROADCAST_OPTION',
  costume: 'COSTUME',
  sound: 'SOUND_MENU'
};

// ---------------------------------------------------------------------------
// 2. 解析器
// ---------------------------------------------------------------------------

const matchHat = content => {
  const keyMatch = content.match(/^当按下\s+(.+?)\s*键$/);
  if (keyMatch) return {type: 'event_whenkeypressed', fields: {KEY_OPTION: keyMatch[1]}};
  if (HATS[content]) return {...HATS[content]};
  return null;
};

const matchCondition = text => {
  const content = String(text || '').trim();
  for (const rule of CONDITIONS) {
    const m = content.match(rule.test);
    if (m) return rule.build(m);
  }
  return null;
};

const matchStatement = content => {
  if (content === '否则') return {type: 'else_marker'};
  for (const rule of STATEMENTS) {
    const m = content.match(rule.test);
    if (m) return rule.build(m);
  }
  return null;
};

const canNest = statement =>
  statement.type === 'control_repeat' ||
  statement.type === 'control_forever' ||
  statement.type === 'control_if_else';

// 解析项目级设置/导入指令
const matchDirective = (content, lineNo) => {
  const projectMatch = content.match(/^项目:\s*(.+)$/);
  if (projectMatch) return {kind: 'title', value: projectMatch[1].trim()};

  const settingMatch = content.match(/^设置\s+(.+?)\s+(\S+)$/);
  if (settingMatch) {
    const def = SETTINGS[settingMatch[1]];
    if (!def) throw new Error(`第 ${lineNo} 行未知设置项: ${settingMatch[1]}`);
    let value;
    if (def.type === 'boolean') {
      if (/^(开启|启用|开|true|on|是)$/i.test(settingMatch[2])) value = true;
      else if (/^(关闭|禁用|关|false|off|否)$/i.test(settingMatch[2])) value = false;
      else throw new Error(`第 ${lineNo} 行设置"${settingMatch[1]}"的值必须是 开启/关闭`);
    } else if (def.type === 'number') {
      value = Number(settingMatch[2]);
      if (!isFinite(value)) throw new Error(`第 ${lineNo} 行设置"${settingMatch[1]}"的值必须是数字`);
    } else if (def.type === 'stageSize') {
      const sizeMatch = settingMatch[2].match(/^([0-9]+)x([0-9]+)$/i);
      if (!sizeMatch) throw new Error(`第 ${lineNo} 行舞台尺寸格式应为 宽x高，例如 960x720`);
      value = {width: Number(sizeMatch[1]), height: Number(sizeMatch[2])};
    }
    return {kind: 'setting', key: def.key, value};
  }

  const importMatch = content.match(/^导入扩展\s+(.+)$/);
  if (importMatch) {
    const ref = importMatch[1].trim();
    return {kind: 'extension', value: ref};
  }

  return null;
};

/**
 * 解析 .sp 文本为 AST。
 * @param {string} text
 * @param {{defaultTargetName?: string}} [options] 无目标段时的默认角色名
 * @returns {{title: string, settings: Array, targets: Array}}
 */
const parse = (text, options = {}) => {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((raw, index) => ({raw, index}))
    .filter(line => line.raw.trim() !== '');

  const ast = {
    title: '',
    settings: [],
    targets: [],
    hasSections: false
  };

  let currentTarget = null;
  let stack = [];

  const indentOf = line => {
    const match = line.raw.match(/^(\s*)/);
    return match ? match[1].length : 0;
  };

  const startTarget = (name, isStage, indent, explicit) => {
    currentTarget = {name, isStage, scripts: []};
    ast.targets.push(currentTarget);
    if (explicit) ast.hasSections = true;
    stack = [{statement: null, body: null, scripts: currentTarget.scripts, indent}];
  };

  for (const line of lines) {
    const indent = indentOf(line);
    const content = line.raw.trim();

    // 项目级指令（仅在未进入目标段前处理；进入后报错）
    if (currentTarget === null) {
      const directive = matchDirective(content, line.index + 1);
      if (directive) {
        if (directive.kind === 'title') ast.title = directive.value;
        else if (directive.kind === 'setting') ast.settings.push({key: directive.key, value: directive.value});
        else if (directive.kind === 'extension') ast.settings.push({key: 'extension', value: directive.value});
        continue;
      }
    }

    // 目标段标记
    const stageMatch = content.match(/^舞台:$/);
    const roleMatch = content.match(/^角色:\s*(.+)$/);
    if (stageMatch) {
      startTarget('Stage', true, indent, true);
      continue;
    }
    if (roleMatch) {
      startTarget(roleMatch[1].trim(), false, indent, true);
      continue;
    }

    // 帽子积木 → 新脚本
    const hat = matchHat(content);
    if (hat) {
      if (currentTarget === null) {
        startTarget(options.defaultTargetName || '角色1', false, indent, false);
      }
      const script = {hat, body: []};
      currentTarget.scripts.push(script);
      stack = [{statement: null, body: script.body, indent}];
      continue;
    }

    // "否则"
    if (content === '否则') {
      if (currentTarget === null) throw new Error(`第 ${line.index + 1} 行 "否则" 前面没有目标段或脚本`);
      let ifIdx = -1;
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i].statement && stack[i].statement.type === 'control_if_else') {
          ifIdx = i;
          break;
        }
      }
      if (ifIdx === -1) {
        throw new Error(`第 ${line.index + 1} 行 "否则" 前面没有对应的"如果 ... 那么"`);
      }
      stack = stack.slice(0, ifIdx + 1);
      const frame = stack[ifIdx];
      frame.statement.elseBody = [];
      frame.body = frame.statement.elseBody;
      continue;
    }

    // 普通语句
    const statement = matchStatement(content);
    if (!statement) {
      throw new Error(`第 ${line.index + 1} 行无法识别: ${content}`);
    }
    if (currentTarget === null) {
      startTarget(options.defaultTargetName || '角色1', false, indent, false);
    }

    if (statement.type === 'control_if_else') {
      const conditionText = statement.conditionText;
      statement.condition = matchCondition(conditionText);
      delete statement.conditionText;
      if (!statement.condition) {
        throw new Error(`第 ${line.index + 1} 行的条件无法识别: "${conditionText}"`);
      }
    }

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1];
    parent.body.push(statement);

    if (canNest(statement)) {
      statement.body = [];
      statement.elseBody = null;
      stack.push({statement, body: statement.body, indent});
    }
  }

  return ast;
};

// ---------------------------------------------------------------------------
// 3. 编译器：AST → Blockly XML（插入模式）
// ---------------------------------------------------------------------------

const escapeXML = value => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const compileInputXML = (name, value, childBlock) => {
  const shadowType = SHADOW_FOR_INPUT[name] || 'text';
  const fieldName = SHADOW_FIELD[shadowType] || 'TEXT';
  const fieldValue = shadowType === 'logic_boolean' ? 'TRUE' : value;
  return `<value name="${name}"><shadow type="${shadowType}"><field name="${fieldName}">${escapeXML(fieldValue)}</field></shadow>${childBlock || ''}</value>`;
};

const compileConditionXML = condition => {
  if (!condition) return '';
  const parts = [`<block type="${condition.type}">`];
  if (condition.fields) {
    for (const [name, value] of Object.entries(condition.fields)) {
      parts.push(`<field name="${name}">${escapeXML(value)}</field>`);
    }
  }
  if (condition.inputs) {
    for (const [name, value] of Object.entries(condition.inputs)) {
      parts.push(compileInputXML(name, value));
    }
  }
  parts.push('</block>');
  return parts.join('');
};

const compileStatementXML = (stmt, x, y) => {
  if (stmt.type === 'else_marker') return '';
  const parts = [`<block type="${stmt.type}" x="${x}" y="${y}">`];
  if (stmt.fields) {
    for (const [name, value] of Object.entries(stmt.fields)) {
      parts.push(`<field name="${name}">${escapeXML(value)}</field>`);
    }
  }
  if (stmt.inputs) {
    for (const [name, value] of Object.entries(stmt.inputs)) {
      parts.push(compileInputXML(name, value));
    }
  }
  if (stmt.type === 'control_if_else') {
    parts.push(compileInputXML('CONDITION', null, compileConditionXML(stmt.condition)));
  }
  if (stmt.body && stmt.body.length) {
    parts.push('<statement name="SUBSTACK">');
    let py = 0;
    for (const child of stmt.body) {
      parts.push(compileStatementXML(child, 0, py));
      py += 40;
    }
    parts.push('</statement>');
  }
  if (stmt.elseBody && stmt.elseBody.length) {
    parts.push('<statement name="SUBSTACK2">');
    let ey = 0;
    for (const child of stmt.elseBody) {
      parts.push(compileStatementXML(child, 0, ey));
      ey += 40;
    }
    parts.push('</statement>');
  }
  parts.push('</block>');
  return parts.join('');
};

/**
 * 单个目标 → Blockly XML。
 * @param {{scripts: Array}} target
 * @returns {string}
 */
const compileToXML = (target) => {
  const blocks = [];
  let y = 80;
  for (const script of target.scripts || []) {
    blocks.push(`<block type="${script.hat.type}" x="80" y="${y}">`);
    if (script.hat.fields) {
      for (const [name, value] of Object.entries(script.hat.fields)) {
        blocks.push(`<field name="${name}">${escapeXML(value)}</field>`);
      }
    }
    if (script.body && script.body.length) {
      blocks.push('<next>');
      let py = 0;
      for (const child of script.body) {
        blocks.push(compileStatementXML(child, 0, py));
        py += 40;
      }
      blocks.push('</next>');
    }
    blocks.push('</block>');
    y += 120;
  }
  return `<xml>${blocks.join('')}</xml>`;
};

// ---------------------------------------------------------------------------
// 4. 编译器：AST → project.json（加载模式）
// ---------------------------------------------------------------------------

let blockIdCounter = 0;
const nextId = prefix => `${prefix || 'b'}_${Date.now().toString(36)}_${(blockIdCounter++).toString(36)}`;

// 数字/文本 shadow 的 inputs 内联表示
const inlineShadow = (name, value) => {
  const shadowType = SHADOW_FOR_INPUT[name] || 'text';
  // Scratch 3 的 inputs 数组：[模式, ...]，模式 1 = 带 shadow；内联 primitive 需包一层
  if (shadowType === 'text') return [1, [10, String(value)]];
  if (shadowType === 'logic_boolean') return [1, [7, value === false ? 'false' : 'true']];
  return [1, [4, String(value)]];
};

// 递归构建一个语句的 blocks（返回 {id, blocks, inputs}，从内到外）
const buildStatementBlocks = (stmt, parentId, idCounter) => {
  const id = nextId('blk');
  const blocks = {};
  const inputs = {};
  const fields = {};

  for (const [name, value] of Object.entries(stmt.fields || {})) {
    // 变量字段：VARIABLE 需要变量 id，第一版用名字直接映射（调用方处理变量表）
    fields[name] = value;
  }

  for (const [name, value] of Object.entries(stmt.inputs || {})) {
    if (value === null || value === undefined) continue;
    inputs[name] = inlineShadow(name, value);
  }

  if (stmt.type === 'control_if_else') {
    const cond = stmt.condition;
    if (cond) {
      const condResult = buildConditionBlocks(cond, id);
      Object.assign(blocks, condResult.blocks);
      inputs.CONDITION = [1, condResult.id];
    } else {
      inputs.CONDITION = [7, 'true'];
    }
  }
  // 广播 shadow 块
  if (stmt._broadcast) {
    const shadowId = nextId('bcast');
    blocks[shadowId] = {
      opcode: 'broadcast',
      next: null,
      parent: id,
      inputs: {},
      fields: {BROADCAST_OPTION: stmt._broadcast.bid},
      shadow: true,
      topLevel: false,
      x: 0,
      y: 0
    };
    inputs.BROADCAST_INPUT = [1, shadowId];
  }

  if (stmt.body && stmt.body.length) {
    const childIds = [];
    let prevId = null;
    for (let i = stmt.body.length - 1; i >= 0; i--) {
      const result = buildStatementBlocks(stmt.body[i], id, idCounter);
      Object.assign(blocks, result.blocks);
      blocks[result.id].next = prevId;
      prevId = result.id;
      childIds.unshift(result.id);
    }
    inputs.SUBSTACK = [2, childIds[0]];
  }
  if (stmt.elseBody && stmt.elseBody.length) {
    const childIds = [];
    let prevId = null;
    for (let i = stmt.elseBody.length - 1; i >= 0; i--) {
      const result = buildStatementBlocks(stmt.elseBody[i], id, idCounter);
      Object.assign(blocks, result.blocks);
      blocks[result.id].next = prevId;
      prevId = result.id;
      childIds.unshift(result.id);
    }
    inputs.SUBSTACK2 = [2, childIds[0]];
  }

  blocks[id] = {
    opcode: stmt.type,
    next: null,
    parent: parentId || null,
    inputs,
    fields,
    shadow: false,
    topLevel: false,
    x: 0,
    y: 0
  };
  return {id, blocks};
};

const buildConditionBlocks = (cond, parentId) => {
  const id = nextId('cond');
  const inputs = {};
  const fields = {};
  for (const [name, value] of Object.entries(cond.fields || {})) {
    fields[name] = value;
  }
  for (const [name, value] of Object.entries(cond.inputs || {})) {
    inputs[name] = inlineShadow(name, value);
  }
  return {
    id,
    blocks: {
      [id]: {
        opcode: cond.type,
        next: null,
        parent: parentId || null,
        inputs,
        fields,
        shadow: false,
        topLevel: false,
        x: 0,
        y: 0
      }
    }
  };
};

// 构建一个目标的 blocks（脚本 → JSON blocks）
const buildTargetBlocks = (target) => {
  const blocks = {};
  const variables = {};
  const broadcasts = {};
  const collectRefs = (stmt) => {
    if (!stmt) return;
    if (stmt.fields && stmt.fields.VARIABLE) {
      const name = stmt.fields.VARIABLE;
      const vid = `var_${name}`;
      stmt.fields.VARIABLE = vid;
      variables[vid] = [name, 'number', false];
    }
    if (stmt.inputs && stmt.inputs.BROADCAST_INPUT) {
      const name = stmt.inputs.BROADCAST_INPUT;
      const bid = `bcast_${name}`;
      stmt.inputs.BROADCAST_INPUT = null; // 由 shadow 块承载
      stmt._broadcast = {name, bid};
      broadcasts[bid] = name;
    }
    if (stmt.body) stmt.body.forEach(collectRefs);
    if (stmt.elseBody) stmt.elseBody.forEach(collectRefs);
  };
  for (const script of target.scripts || []) {
    script.body.forEach(collectRefs);
  }

  for (const script of target.scripts || []) {
    const hatId = nextId('hat');
    const fields = {};
    const inputs = {};
    for (const [name, value] of Object.entries(script.hat.fields || {})) {
      fields[name] = value;
    }
    let prevId = null;
    const childIds = [];
    for (let i = script.body.length - 1; i >= 0; i--) {
      const result = buildStatementBlocks(script.body[i], hatId);
      Object.assign(blocks, result.blocks);
      blocks[result.id].next = prevId;
      prevId = result.id;
      childIds.unshift(result.id);
    }
    blocks[hatId] = {
      opcode: script.hat.type,
      next: childIds.length ? childIds[0] : null,
      parent: null,
      inputs,
      fields,
      shadow: false,
      topLevel: true,
      x: 80,
      y: 80
    };
  }
  return {blocks, variables, broadcasts};
};

/**
 * 整个 AST → project.json。
 * @param {{title: string, targets: Array}} ast
 * @returns {object}
 */
const compileToProjectJSON = (ast) => {
  const targets = [];
  const monitors = [];
  const extensions = [];
  const extensionURLs = {};
  const assets = {}; // md5ext -> 文件内容（占位造型）

  // 收集扩展设置
  for (const setting of ast.settings || []) {
    if (setting.key !== 'extension') continue;
    const ref = setting.value;
    if (/^https?:\/\//.test(ref)) {
      const id = `custom_${extensions.length + 1}`;
      extensions.push(id);
      extensionURLs[id] = ref;
    } else {
      extensions.push(ref);
    }
  }

  let layerOrder = 0;
  for (const target of ast.targets || []) {
    const {blocks, variables, broadcasts} = buildTargetBlocks(target);
    const blankCostume = {
      name: '空白',
      bitmapResolution: 1,
      dataFormat: 'svg',
      assetId: '00000000000000000000000000000000',
      md5ext: '00000000000000000000000000000000.svg',
      rotationCenterX: 0,
      rotationCenterY: 0
    };
    assets['00000000000000000000000000000000.svg'] =
      assets['00000000000000000000000000000000.svg'] ||
      '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';
    targets.push({
      isStage: Boolean(target.isStage),
      name: target.isStage ? 'Stage' : (target.name || '角色1'),
      variables,
      lists: {},
      broadcasts,
      blocks,
      comments: {},
      currentCostume: 0,
      costumes: [blankCostume],
      sounds: [],
      volume: 100,
      layerOrder: layerOrder++,
      tempo: 60,
      videoTransparency: 50,
      videoState: 'on',
      textToSpeechLanguage: null
    });
  }

  return {
    targets,
    monitors,
    extensions,
    extensionURLs,
    _assets: assets,
    meta: {
      semver: '3.0.0',
      vm: '0.2.0',
      agent: 'HiWarp',
      ...(ast.title ? {title: ast.title} : {})
    }
  };
};

/**
 * 整个 AST → .sb3 压缩包（含占位造型资源），供 vm.loadProject 直接加载。
 * @param {{title: string, targets: Array}} ast
 * @returns {Promise<ArrayBuffer>}
 */
const compileToSB3 = async (ast) => {
  const project = compileToProjectJSON(ast);
  const assets = project._assets || {};
  delete project._assets;
  // eslint-disable-next-line global-require
  const JSZip = require('@turbowarp/jszip');
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(project));
  for (const [md5ext, content] of Object.entries(assets)) {
    zip.file(md5ext, content);
  }
  return zip.generateAsync({
    type: 'nodebuffer',
    mimeType: 'application/x.scratch.sb3'
  });
};

// 便捷入口
const textToXML = (text, options) => {
  const ast = parse(text, options);
  return {
    ast,
    xml: compileToXML(ast.targets[0] || {scripts: []}),
    projectJSON: compileToProjectJSON(ast)
  };
};

module.exports = {
  parse,
  compileToXML,
  compileToProjectJSON,
  compileToSB3,
  textToXML,
  HATS,
  STATEMENTS,
  CONDITIONS,
  SETTINGS
};
