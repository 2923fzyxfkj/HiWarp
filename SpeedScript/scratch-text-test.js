const st = require('../src-renderer-webpack/editor/scratch-text/scratch-text.js');

const demo = `项目: 画板演示
设置 帧率 60
设置 补帧 开启
设置 无限克隆 开启
导入扩展 pen

舞台:
  当绿旗被点击
    说 欢迎来到画板

角色: 角色1
  当绿旗被点击
    重复无限次
      如果 按下鼠标？ 那么
        移动 10 步
      否则
        说 松开
  当按下 空格 键
    说 你好 持续 2 秒
`;

console.log('===== 解析 =====');
const ast = st.parse(demo);
console.log('标题:', ast.title);
console.log('设置:', JSON.stringify(ast.settings));
console.log('目标数:', ast.targets.length, '->', ast.targets.map(t => `${t.isStage ? '舞台' : t.name}`).join(', '));
console.log('角色1脚本数:', ast.targets[1].scripts.length);

console.log('\n===== 插入模式 XML（角色1） =====');
console.log(st.compileToXML(ast.targets[1]).slice(0, 400) + '...');

console.log('\n===== 加载模式 project.json =====');
const project = st.compileToProjectJSON(ast);
console.log('extensions:', JSON.stringify(project.extensions));
console.log('targets:', project.targets.map(t => `${t.name}(${Object.keys(t.blocks).length}块)`).join(', '));
console.log('变量表:', JSON.stringify(project.targets[1].variables));
console.log('广播表:', JSON.stringify(project.targets[1].broadcasts));

// 用 scratch-parser 校验 project.json
console.log('\n===== scratch-parser 校验 =====');
const parser = require('scratch-parser');
parser(JSON.stringify(project), false, (error, res) => {
  if (error) {
    console.log('校验失败:', error.message || error);
    console.log(JSON.stringify(error.sb3Errors || [], null, 1).slice(0, 800));
  } else {
    console.log('校验通过 ✓');
  }
});

// 校验 sb3 打包
console.log('\n===== sb3 打包 =====');
st.compileToSB3(ast).then(buffer => {
  console.log('sb3 大小:', buffer.length, '字节');
  // 用 scratch-parser 从 zip 校验
  const parser2 = require('scratch-parser');
  parser2(buffer, false, (error2) => {
    if (error2) {
      console.log('sb3 校验失败:', JSON.stringify(error2.sb3Errors || []).slice(0, 400));
    } else {
      console.log('sb3 校验通过 ✓');
    }
  });
});
