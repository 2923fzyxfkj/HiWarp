'use strict';

const ArgumentType = require('../extension-support/argument-type');
const BlockType = require('../extension-support/block-type');
const Cast = require('../util/cast');
const OVERLAY_CANVAS_ID = 'webgl-liquid-glass-v4-overlay-canvas';
const VERTEX_SHADER_SOURCE = "#version 300 es\nprecision highp float;\nlayout(location = 0) in vec2 aPosition;\n\nuniform vec2 uCenter;\nuniform vec2 uHalfSize;\nuniform vec2 uHalfStage;\n\nout vec2 v_localPos;\n\nvoid main() {\n  v_localPos = aPosition;\n  vec2 worldPos = uCenter + aPosition * uHalfSize;\n  vec2 clip = worldPos / uHalfStage;\n  gl_Position = vec4(clip, 0.0, 1.0);\n}\n";

// ── V4 增强版片元着色器 ──
// 新增：颜色叠色混合、边缘高光、外发光
const FRAGMENT_SHADER_SOURCE = "#version 300 es\nprecision highp float;\n\nin vec2 v_localPos;\n\nout vec4 fragColor;\n\nuniform sampler2D uStageTexture;\nuniform vec2 uResolution;\nuniform vec2 uCenter;\nuniform vec2 uHalfStage;\nuniform vec2 uHalfSize;\nuniform float uRefraction;\nuniform float uDiameter;\nuniform float uOpacity;\nuniform float uCornerRadius;\nuniform float uBlur;\nuniform vec4 uTint;         // \u53E0\u8272 RGBA (0-1)\nuniform float uTintStrength; // \u53E0\u8272\u5F3A\u5EA6 0-1\nuniform float uEdgeHighlight; // \u8FB9\u7F18\u9AD8\u5149\u5F3A\u5EA6\nuniform float uGlow;        // \u5916\u53D1\u5149\u5F3A\u5EA6\n\n// \u989C\u8272\u5DE5\u5177\u51FD\u6570\nvec3 rgb2hsv(vec3 c) {\n  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);\n  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));\n  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));\n  float d = q.x - min(q.w, q.y);\n  float e = 1.0e-10;\n  return vec3(abs(q.z + (q.w - q.y) / (6.0*d + e)), d / (q.x + e), q.x);\n}\n\nvec3 hsv2rgb(vec3 c) {\n  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);\n  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);\n  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);\n}\n\nvoid main() {\n    vec2 halfPx = uHalfSize / 1.0625;\n    vec2 p = v_localPos * 2.0 * uHalfSize;\n\n    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n    // \u5F52\u4E00\u5316\u5F84\u5411\u8DDD\u79BB\uFF08\u7528\u4E8E\u6298\u5C04/\u9AD8\u5149/\u6697\u8FB9\u73AF\u7B49\u5185\u90E8\u6548\u679C\uFF09\n    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n    // \u4F7F\u7528\u65B9\u5F62\u5EA6\u91CF max(nrm.x, nrm.y)\uFF0C\u786E\u4FDD\u89D2\u843D\u9644\u8FD1 dist \u4E0D\u4F1A\u8FC7\u5927\n    // \u8FD9\u6837 body/rim \u5728\u5706\u89D2\u533A\u57DF\u4E0D\u4F1A\u53D8\u6210 0\uFF0C\u5706\u89D2\u624D\u4F1A\u6709\u989C\u8272\n    // \u5F62\u72B6\u8F6E\u5ED3\u7531\u4E0B\u65B9\u7684 SDF \u72EC\u7ACB\u63A7\u5236\uFF0C\u4E0E\u5185\u90E8\u6548\u679C\u5B8C\u5168\u89E3\u8026\n    vec2 nrm = abs(p) / max(halfPx, vec2(1e-3));\n    float dist = 0.5 * max(nrm.x, nrm.y);  // \u65B9\u5F62\u5EA6\u91CF\uFF1A0=\u4E2D\u5FC3\uFF0C0.5=\u8FB9\u7F18\n\n    // \u7403\u900F\u955C\u6298\u5C04\n    vec2 center = uCenter / (2.0 * uHalfStage) + 0.5;\n    vec2 screenUV = gl_FragCoord.xy / uResolution;\n    vec2 tex = screenUV - center;\n\n    float dis2x = min(dist * 2.0, 0.99);\n    float sq = sqrt(max(1.0 - dis2x * dis2x, 1e-4));\n    float num = uRefraction / sq - uRefraction;\n\n    vec2 refractUV = tex * (1.0 - num) + center;\n    vec2 glassHalfUV = (uHalfSize / 1.0625) / (2.0 * uHalfStage);\n    vec2 rebUV = center + tex * (1.0 + num);\n    rebUV = clamp(rebUV, center - glassHalfUV, center + glassHalfUV);\n\n    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n    // \u9AD8\u8D28\u91CF\u9AD8\u65AF\u6A21\u7CCA\uFF1A15\u70B9\u52A0\u6743\u91C7\u6837\uFF0C\u7EDD\u5BF9\u4E1D\u6ED1\n    // \u5B8C\u5168\u4E0D\u7528mipmap\uFF0C\u4EFB\u4F55\u60C5\u51B5\u90FD\u4E0D\u4F1A\u9A6C\u8D5B\u514B/\u82B1\n    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n    float blurRadius = clamp(uBlur, 0.0, 1.0) * 0.018;\n    vec3 col = vec3(0.0);\n    \n    if (blurRadius < 0.0002) {\n      col = texture(uStageTexture, refractUV).rgb;\n    } else {\n      // \u6807\u51C6\u9AD8\u65AF\u5206\u5E03\u6743\u91CD\uFF0C\u603B\u548C=1\uFF0C\u4E2D\u5FC3\u6700\u91CD\uFF0C\u5411\u5916\u9012\u51CF\uFF0C\u5404\u65B9\u5411\u5747\u5300\u8986\u76D6\n      // \u4E2D\u5FC3\n      col += texture(uStageTexture, refractUV).rgb * 0.20;\n      // \u4E0A\u4E0B\u5DE6\u53F3\uFF08\u8FD1\u5708\uFF09\n      col += texture(uStageTexture, refractUV + vec2(0, blurRadius)).rgb * 0.135;\n      col += texture(uStageTexture, refractUV + vec2(0, -blurRadius)).rgb * 0.135;\n      col += texture(uStageTexture, refractUV + vec2(blurRadius, 0)).rgb * 0.135;\n      col += texture(uStageTexture, refractUV + vec2(-blurRadius, 0)).rgb * 0.135;\n      // \u56DB\u4E2A\u659C\u89D2\n      col += texture(uStageTexture, refractUV + vec2(blurRadius*0.7, blurRadius*0.7)).rgb * 0.05;\n      col += texture(uStageTexture, refractUV + vec2(-blurRadius*0.7, blurRadius*0.7)).rgb * 0.05;\n      col += texture(uStageTexture, refractUV + vec2(blurRadius*0.7, -blurRadius*0.7)).rgb * 0.05;\n      col += texture(uStageTexture, refractUV + vec2(-blurRadius*0.7, -blurRadius*0.7)).rgb * 0.05;\n      // \u8FDC\u5708\uFF08\u66F4\u5927\u6A21\u7CCA\u8303\u56F4\uFF09\n      col += texture(uStageTexture, refractUV + vec2(0, blurRadius*1.8)).rgb * 0.015;\n      col += texture(uStageTexture, refractUV + vec2(0, -blurRadius*1.8)).rgb * 0.015;\n      col += texture(uStageTexture, refractUV + vec2(blurRadius*1.8, 0)).rgb * 0.015;\n      col += texture(uStageTexture, refractUV + vec2(-blurRadius*1.8, 0)).rgb * 0.015;\n    }\n    \n    // \u8272\u6563\u91C7\u6837\uFF08\u540C\u6837\u6E05\u6670\u91C7\u6837\uFF0C\u8272\u6563\u8FB9\u7F18\u4E0D\u7CCA\uFF09\n    vec3 reb = texture(uStageTexture, rebUV).rgb;\n\n    num = abs(num);\n    // \u4EAE\u5EA6\u8865\u507F\n    col *= clamp(1.03125 - num * 0.25, 0.625, 1.0) + clamp(num * 0.125 - 0.0625, 0.0, 0.25);\n\n    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n    // \u73BB\u7483\u672C\u8EAB\u67D3\u8272\uFF1A\u5149\u7EBF\u7A7F\u8FC7\u6EE4\u8272\uFF0C\u4E0D\u4F1A\u76D6\u4F4F\u6298\u5C04\n    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n    float tintStrength = uTint.a * uTintStrength;\n    if (tintStrength > 0.0) {\n      vec3 tinted = col * uTint.rgb * 1.5;\n      col = mix(col, tinted, tintStrength);\n    }\n\n    // \u8FB9\u7F18\u8272\u6563\n    col = mix(col + clamp(num * 0.25 - 0.0625, 0.0, 0.5) * 0.5,\n              reb, clamp(dist * (1.0 + num) - 0.5625, 0.0, 1.0) * 0.75);\n\n    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n    // V4 \u65B0\u589E\uFF1A\u6DB2\u6001\u73BB\u7483\u8FB9\u7F18\u9AD8\u5149\n    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n    float innerHighlight = smoothstep(0.35, 0.48, dist) * (1.0 - smoothstep(0.48, 0.52, dist));\n    float rimLight = pow(1.0 - dist * 1.8, 3.0) * uEdgeHighlight;\n    float topLight = smoothstep(0.1, 0.5, 0.5 - nrm.y) * (1.0 - smoothstep(0.0, 0.3, abs(nrm.x))) * 0.15 * uEdgeHighlight;\n    col += vec3(1.0) * (innerHighlight * 0.3 + rimLight * 0.25 + topLight);\n\n    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n    // \u56DB\u4E2A\u89D2\u5706\u89D2\uFF1A\u5706\u89D2\u77E9\u5F62 SDF \u5F62\u72B6\u906E\u7F69\n    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n    // \u8FD9\u662F\u771F\u6B63\u51B3\u5B9A\"\u56DB\u4E2A\u89D2\u5706\u89D2\"\u5F62\u72B6\u7684\u5730\u65B9\n    // \u5706\u89D2\u53EA\u5F71\u54CD\u8F6E\u5ED3\uFF0C\u4E0D\u5F71\u54CD\u5185\u90E8\u6298\u5C04/\u9AD8\u5149\uFF08\u4E0A\u9762\u5DF2\u89E3\u8026\uFF09\n\n    // \u6B65\u9AA4 1\uFF1A\u9650\u5E45\u5706\u89D2\u534A\u5F84 \u2208 [0, \u77ED\u8FB9\u4E00\u534A]\n    //   \u9632\u6B62\u5706\u89D2\u8D85\u8FC7\u77E9\u5F62\u5C3A\u5BF8\u5BFC\u81F4\u53D8\u5F62\n    float maxRadius = min(halfPx.x, halfPx.y);\n    float cr = clamp(uCornerRadius, 0.0, maxRadius);\n\n    // \u6B65\u9AA4 2\uFF1A\u5706\u89D2\u77E9\u5F62 SDF\uFF08\u6807\u51C6\u6709\u5411\u8DDD\u79BB\u573A\u516C\u5F0F\uFF09\n    //   \u5229\u7528\u56DB\u8C61\u9650\u5BF9\u79F0\uFF08abs(p)\uFF09\uFF0C\u56DB\u4E2A\u89D2\u5171\u7528\u540C\u4E00\u5957\u8BA1\u7B97\n    //   - q = abs(p) - halfPx + cr   \u628A\u539F\u70B9\u5E73\u79FB\u5230\u5706\u89D2\u5706\u5FC3\n    //   - min(max(q.x,q.y), 0.0)     \u5904\u7406\u5185\u90E8\u77E9\u5F62\u533A\u57DF\n    //   - length(max(q, 0.0))        \u5904\u7406\u56DB\u4E2A\u89D2\u7684\u5916\u90E8\u5706\u89D2\u533A\u57DF\n    //   sd < 0 \u5185\u90E8\uFF0Csd = 0 \u8FB9\u7F18\uFF0Csd > 0 \u5916\u90E8\n    vec2 q = abs(p) - halfPx + cr;\n    float sd = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - cr;\n\n    // \u6B65\u9AA4 3\uFF1A\u5F62\u72B6\u906E\u7F69\uFF082 \u50CF\u7D20\u5BBD\u6297\u952F\u9F7F\u8FC7\u6E21\u5E26\uFF09\n    //   sd < -1 \u2192 \u5B8C\u5168\u5728\u5185\u90E8 \u2192 mask = 1\n    //   sd > +1 \u2192 \u5B8C\u5168\u5728\u5916\u90E8 \u2192 mask = 0\n    float shapeMask = 1.0 - smoothstep(-1.0, 1.0, sd);\n\n    // \u6B65\u9AA4 4\uFF1A\u5916\u53D1\u5149\uFF08\u590D\u7528\u540C\u4E00\u4E2A SDF\uFF0C\u5411\u5916\u6269\u5C55\u66F4\u5927\u8303\u56F4\uFF09\n    float glowMask = 1.0 - smoothstep(-3.0, 8.0, sd);\n    float glow = glowMask * uGlow * 0.3;\n    col += uTint.rgb * glow;\n\n    // \u73BB\u7483\u4F53 + \u6697\u8FB9\u73AF\n    float rim = clamp(0.53125 - dist, 0.0, 1.0);\n    float body = clamp((0.5 - dist) * uDiameter * 0.5, 0.0, 1.0);\n    float glassA = rim * (1.0 - body) + body;\n\n    float finalAlpha = glassA * shapeMask * uOpacity;\n    fragColor = vec4(col * body * shapeMask, finalAlpha);\n}\n";

// 全屏背景着色器
const BACKGROUND_VERTEX_SHADER_SOURCE = "#version 300 es\nprecision highp float;\nlayout(location = 0) in vec2 aPosition;\nout vec2 v_uv;\nvoid main() {\n  v_uv = aPosition + 0.5;\n  gl_Position = vec4(aPosition * 2.0, 0.0, 1.0);\n}";
const BACKGROUND_FRAGMENT_SHADER_SOURCE = "#version 300 es\nprecision highp float;\nin vec2 v_uv;\nout vec4 fragColor;\nuniform sampler2D uStageTexture;\nvoid main() {\n  fragColor = texture(uStageTexture, v_uv);\n}";
function toSafeNumber(value) {
  if (Cast && typeof Cast.toNumber === 'function') {
    return Cast.toNumber(value);
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

// Scratch颜色转RGB (0-1)
function scratchColorToRGB(color) {
  const hex = Cast.toString(color);
  let r = 1,
    g = 1,
    b = 1;
  if (hex.startsWith('#') && hex.length >= 7) {
    r = parseInt(hex.substr(1, 2), 16) / 255;
    g = parseInt(hex.substr(3, 2), 16) / 255;
    b = parseInt(hex.substr(5, 2), 16) / 255;
  } else {
    const num = Number(hex);
    if (Number.isFinite(num)) {
      r = (num >> 16 & 0xFF) / 255;
      g = (num >> 8 & 0xFF) / 255;
      b = (num & 0xFF) / 255;
    }
  }
  return [r, g, b];
}
function createGlassState(id) {
  return {
    id: id,
    x: 0,
    y: 0,
    width: 120,
    height: 80,
    refraction: 0.25,
    targetRefraction: 0.25,
    opacity: 0.9,
    cornerRadius: 20,
    tint: [1, 1, 1, 0],
    tintStrength: 0.5,
    edgeHighlight: 0.8,
    glow: 0,
    blur: 0
  };
}
class WebGLLiquidGlassV4 {
  constructor(runtimeRef) {
    this.runtime = runtimeRef;
    this.glasses = [];
    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.bgProgram = null;
    this.bgUniforms = {};
    this.vao = null;
    this.vertexBuffer = null;
    this.stageTexture = null;
    this.uniformLocations = {};
    this._warmupFrames = 0;
    this._lastStageWidth = 0;
    this._lastStageHeight = 0;
    this._textureUploadOk = false;
    this._originalRendererDraw = null;
    this._wrappedRendererDraw = null;
    this._isDrawingFrame = false;
    this._onContextLost = this._onContextLost.bind(this);
    this._onContextRestored = this._onContextRestored.bind(this);
    this._boundDrawFrame = this._drawFrame.bind(this);
    this._boundOnResize = this._onWindowResize.bind(this);
    this._hookRendererDraw();
    this._ensureCanvas();
    window.addEventListener('resize', this._boundOnResize, false);
  }
  _onWindowResize() {
    if (!this.gl || !this.canvas || this.glasses.length === 0) return;
    this._lastStageWidth = 0;
    this._lastStageHeight = 0;
    this._warmupFrames = Math.max(this._warmupFrames, 5);
    this._textureUploadOk = false;
    requestAnimationFrame(() => {
      const renderer = this.runtime && this.runtime.renderer;
      if (renderer && typeof renderer.draw === 'function') renderer.draw();
    });
  }
  _hookRendererDraw() {
    const renderer = this.runtime && this.runtime.renderer;
    if (!renderer || typeof renderer.draw !== 'function') return;
    if (renderer.draw === this._wrappedRendererDraw) return;
    if (!this._originalRendererDraw || renderer.draw !== this._originalRendererDraw) {
      this._originalRendererDraw = renderer.draw;
    }
    const self = this;
    this._wrappedRendererDraw = function () {
      if (self.glasses.length > 0 && self.gl && this.dirty !== undefined) {
        this.dirty = true;
      }
      const result = self._originalRendererDraw.apply(this, arguments);
      if (self.glasses.length > 0 && self.gl) {
        try {
          self._boundDrawFrame();
        } catch (err) {
          console.error('[液态玻璃V4] 绘制失败:', err);
        }
      }
      return result;
    };
    renderer.draw = this._wrappedRendererDraw;
  }
  _unhookRendererDraw() {
    const renderer = this.runtime && this.runtime.renderer;
    if (renderer && this._originalRendererDraw) {
      renderer.draw = this._originalRendererDraw;
      this._originalRendererDraw = null;
      this._wrappedRendererDraw = null;
    }
  }
  getInfo() {
    return {
      id: 'webglLiquidGlassV4',
      name: '液态玻璃 V4',
      color1: '#80DEEA',
      color2: '#26C6DA',
      color3: '#00ACC1',
      blocks: [{
        opcode: 'createGlass',
        blockType: BlockType.COMMAND,
        text: '✨ 创建编号 [ID] 的液态玻璃',
        arguments: {
          ID: {
            type: ArgumentType.NUMBER,
            defaultValue: 1
          }
        }
      }, {
        opcode: 'deleteGlass',
        blockType: BlockType.COMMAND,
        text: '🗑️ 删除液态玻璃 [ID]',
        arguments: {
          ID: {
            type: ArgumentType.NUMBER,
            defaultValue: 1
          }
        }
      }, {
        opcode: 'deleteAllGlasses',
        blockType: BlockType.COMMAND,
        text: '🗑️ 删除全部液态玻璃'
      }, '---', {
        opcode: 'setPosition',
        blockType: BlockType.COMMAND,
        text: '📍 将玻璃 [ID] 位置设为 x: [X] y: [Y]',
        arguments: {
          ID: {
            type: ArgumentType.NUMBER,
            defaultValue: 1
          },
          X: {
            type: ArgumentType.NUMBER,
            defaultValue: 0
          },
          Y: {
            type: ArgumentType.NUMBER,
            defaultValue: 0
          }
        }
      }, {
        opcode: 'setSize',
        blockType: BlockType.COMMAND,
        text: '📐 将玻璃 [ID] 大小设为 宽: [W] 高: [H]',
        arguments: {
          ID: {
            type: ArgumentType.NUMBER,
            defaultValue: 1
          },
          W: {
            type: ArgumentType.NUMBER,
            defaultValue: 120
          },
          H: {
            type: ArgumentType.NUMBER,
            defaultValue: 80
          }
        }
      }, '---', {
        opcode: 'setPreset',
        blockType: BlockType.COMMAND,
        text: '🎨 将玻璃 [ID] 设为 [PRESET] 样式',
        arguments: {
          ID: {
            type: ArgumentType.NUMBER,
            defaultValue: 1
          },
          PRESET: {
            type: ArgumentType.STRING,
            menu: 'presetMenu',
            defaultValue: '默认玻璃'
          }
        }
      }, {
        opcode: 'setRefraction',
        blockType: BlockType.COMMAND,
        text: '🔍 将玻璃 [ID] 折射强度设为 [VALUE]%',
        arguments: {
          ID: {
            type: ArgumentType.NUMBER,
            defaultValue: 1
          },
          VALUE: {
            type: ArgumentType.NUMBER,
            defaultValue: 25
          }
        }
      }, {
        opcode: 'setOpacity',
        blockType: BlockType.COMMAND,
        text: '👁️ 将玻璃 [ID] 不透明度设为 [VALUE]%',
        arguments: {
          ID: {
            type: ArgumentType.NUMBER,
            defaultValue: 1
          },
          VALUE: {
            type: ArgumentType.NUMBER,
            defaultValue: 90
          }
        }
      }, {
        opcode: 'setCorner',
        blockType: BlockType.COMMAND,
        text: '⭕ 将玻璃 [ID] 圆角半径设为 [RADIUS]',
        arguments: {
          ID: {
            type: ArgumentType.NUMBER,
            defaultValue: 1
          },
          RADIUS: {
            type: ArgumentType.NUMBER,
            defaultValue: 20
          }
        }
      }, {
        opcode: 'setBlur',
        blockType: BlockType.COMMAND,
        text: '🌫️ 将玻璃 [ID] 模糊度设为 [VALUE]%',
        arguments: {
          ID: {
            type: ArgumentType.NUMBER,
            defaultValue: 1
          },
          VALUE: {
            type: ArgumentType.NUMBER,
            defaultValue: 0
          }
        }
      }, '---', {
        opcode: 'setColor',
        blockType: BlockType.COMMAND,
        text: '🎨 将玻璃 [ID] 颜色设为 [COLOR] 强度 [STRENGTH]%',
        arguments: {
          ID: {
            type: ArgumentType.NUMBER,
            defaultValue: 1
          },
          COLOR: {
            type: ArgumentType.COLOR,
            defaultValue: '#80DEEA'
          },
          STRENGTH: {
            type: ArgumentType.NUMBER,
            defaultValue: 50
          }
        }
      }, {
        opcode: 'setHighlight',
        blockType: BlockType.COMMAND,
        text: '✨ 将玻璃 [ID] 高光强度设为 [VALUE]%',
        arguments: {
          ID: {
            type: ArgumentType.NUMBER,
            defaultValue: 1
          },
          VALUE: {
            type: ArgumentType.NUMBER,
            defaultValue: 80
          }
        }
      }, {
        opcode: 'setGlow',
        blockType: BlockType.COMMAND,
        text: '💡 将玻璃 [ID] 外发光强度设为 [VALUE]%',
        arguments: {
          ID: {
            type: ArgumentType.NUMBER,
            defaultValue: 1
          },
          VALUE: {
            type: ArgumentType.NUMBER,
            defaultValue: 0
          }
        }
      }, {
        opcode: 'renderAllGlasses',
        blockType: BlockType.COMMAND,
        text: '🔄 强制刷新所有玻璃'
      }],
      menus: {
        presetMenu: {
          items: ['默认玻璃', '圆形玻璃', '方形玻璃', '毛玻璃', '彩色玻璃', '发光玻璃', '清水晶']
        }
      }
    };
  }
  _findGlass(id) {
    const numId = Math.round(toSafeNumber(id));
    return this.glasses.find(g => g.id === numId) || null;
  }
  _ensureCanvas() {
    if (this.canvas) return;
    const stageCanvas = this.runtime.renderer && this.runtime.renderer.canvas;
    if (!stageCanvas || !stageCanvas.parentElement) {
      setTimeout(() => this._ensureCanvas(), 100);
      return;
    }
    const container = stageCanvas.parentElement;
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    const existing = container.querySelector('#' + OVERLAY_CANVAS_ID);
    if (existing) existing.remove();
    const canvas = document.createElement('canvas');
    canvas.id = OVERLAY_CANVAS_ID;
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';
    container.appendChild(canvas);
    this.canvas = canvas;
    canvas.addEventListener('webglcontextlost', this._onContextLost, false);
    canvas.addEventListener('webglcontextrestored', this._onContextRestored, false);
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: false
    });
    if (!gl) {
      console.error('[液态玻璃V4] 当前环境不支持 WebGL2');
      return;
    }
    this.gl = gl;
    try {
      this._initGL();
    } catch (error) {
      console.error('[液态玻璃V4] 初始化失败:', error);
    }
    this._hookRendererDraw();
  }
  _onContextLost(event) {
    event.preventDefault();
    // 标记所有玻璃的 aboveFB/aboveTex 失效（GL context 丢失后资源不可用）
    for (const g of this.glasses) {
      g.aboveFB = null;
      g.aboveTex = null;
    }
  }
  _onContextRestored() {
    try {
      this._initGL();
    } catch (error) {
      return;
    }
    // aboveFB/aboveTex 在 _onContextLost 已被置 null，下次渲染会自动重建
    this._warmupFrames = 5;
    this._textureUploadOk = false;
    requestAnimationFrame(() => {
      if (this.runtime.renderer && this.runtime.renderer.draw) this.runtime.renderer.draw();
    });
  }
  _compileShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('着色器编译失败: ' + info);
    }
    return shader;
  }
  _initGL() {
    const gl = this.gl;
    if (!gl) return;
    const vertexShader = this._compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
    const fragmentShader = this._compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('着色器程序链接失败: ' + gl.getProgramInfoLog(program));
    }
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    this.program = program;

    // 背景程序
    if (this.bgProgram) gl.deleteProgram(this.bgProgram);
    const bgVertexShader = this._compileShader(gl, gl.VERTEX_SHADER, BACKGROUND_VERTEX_SHADER_SOURCE);
    const bgFragmentShader = this._compileShader(gl, gl.FRAGMENT_SHADER, BACKGROUND_FRAGMENT_SHADER_SOURCE);
    const bgProgram = gl.createProgram();
    gl.attachShader(bgProgram, bgVertexShader);
    gl.attachShader(bgProgram, bgFragmentShader);
    gl.linkProgram(bgProgram);
    gl.deleteShader(bgVertexShader);
    gl.deleteShader(bgFragmentShader);
    this.bgProgram = bgProgram;
    this.bgUniforms = {
      uStageTexture: gl.getUniformLocation(bgProgram, 'uStageTexture')
    };
    this.uniformLocations = {
      uCenter: gl.getUniformLocation(program, 'uCenter'),
      uHalfSize: gl.getUniformLocation(program, 'uHalfSize'),
      uHalfStage: gl.getUniformLocation(program, 'uHalfStage'),
      uStageTexture: gl.getUniformLocation(program, 'uStageTexture'),
      uResolution: gl.getUniformLocation(program, 'uResolution'),
      uRefraction: gl.getUniformLocation(program, 'uRefraction'),
      uDiameter: gl.getUniformLocation(program, 'uDiameter'),
      uOpacity: gl.getUniformLocation(program, 'uOpacity'),
      uCornerRadius: gl.getUniformLocation(program, 'uCornerRadius'),
      uBlur: gl.getUniformLocation(program, 'uBlur'),
      uTint: gl.getUniformLocation(program, 'uTint'),
      uTintStrength: gl.getUniformLocation(program, 'uTintStrength'),
      uEdgeHighlight: gl.getUniformLocation(program, 'uEdgeHighlight'),
      uGlow: gl.getUniformLocation(program, 'uGlow')
    };
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.vao = vao;
    this.vertexBuffer = vertexBuffer;
    this.stageTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.stageTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXT_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXT_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXT_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXT_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
  }
  _getStageSize() {
    return [this.runtime.stageWidth || 480, this.runtime.stageHeight || 360];
  }
  _syncCanvasResolution() {
    const stageCanvas = this.runtime.renderer && this.runtime.renderer.canvas;
    if (!stageCanvas || !this.canvas) return false;
    if (this.canvas.width !== stageCanvas.width || this.canvas.height !== stageCanvas.height) {
      this.canvas.width = stageCanvas.width;
      this.canvas.height = stageCanvas.height;
      return true;
    }
    return false;
  }

  // 内部绘制方法：上传 stageCanvas 纹理并绘制玻璃列表
  // isLayerAware=true 时跳过 bgProgram 全屏铺底（玻璃外区域保持透明，供层级感知复用）
  _drawGlassesInternal(glasses, canvasW, canvasH, stageW, stageH, stageCanvas, isLayerAware) {
    const gl = this.gl;
    if (!gl || !this.program) return;
    gl.viewport(0, 0, canvasW, canvasH);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.stageTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, stageCanvas);
    gl.generateMipmap(gl.TEXTURE_2D);

    // isLayerAware=true 时跳过 bgProgram 全屏铺底
    if (!isLayerAware && this.bgProgram) {
      gl.useProgram(this.bgProgram);
      gl.bindVertexArray(this.vao);
      gl.uniform1i(this.bgUniforms.uStageTexture, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);
    gl.uniform1i(this.uniformLocations.uStageTexture, 0);
    gl.uniform2f(this.uniformLocations.uResolution, canvasW, canvasH);
    gl.uniform2f(this.uniformLocations.uHalfStage, stageW / 2, stageH / 2);
    for (const g of glasses) {
      const halfW = g.width / 2.0;
      const halfH = g.height / 2.0;
      const diameter = Math.min(g.width, g.height);
      gl.uniform2f(this.uniformLocations.uCenter, g.x, g.y);
      gl.uniform2f(this.uniformLocations.uHalfSize, halfW, halfH);
      gl.uniform1f(this.uniformLocations.uDiameter, diameter);
      gl.uniform1f(this.uniformLocations.uRefraction, g.refraction);
      gl.uniform1f(this.uniformLocations.uOpacity, g.opacity);
      gl.uniform1f(this.uniformLocations.uCornerRadius, g.cornerRadius);
      gl.uniform1f(this.uniformLocations.uBlur, g.blur / 100.0);
      gl.uniform4f(this.uniformLocations.uTint, g.tint[0], g.tint[1], g.tint[2], g.tint[3]);
      gl.uniform1f(this.uniformLocations.uTintStrength, g.tintStrength);
      gl.uniform1f(this.uniformLocations.uEdgeHighlight, g.edgeHighlight);
      gl.uniform1f(this.uniformLocations.uGlow, g.glow);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    gl.bindVertexArray(null);
  }
  _drawFrame() {
    if (this._isDrawingFrame) return;
    this._isDrawingFrame = true;
    try {
      const gl = this.gl;
      if (!gl || !this.program || gl.isContextLost() || this.glasses.length === 0) return;
      const stageCanvas = this.runtime.renderer && this.runtime.renderer.canvas;
      if (!stageCanvas || stageCanvas.width <= 0) return;
      const sizeChanged = this._syncCanvasResolution();
      if (sizeChanged) {
        this._warmupFrames = Math.max(this._warmupFrames, 5);
        this._textureUploadOk = false;
      }
      const canvasW = this.canvas.width;
      const canvasH = this.canvas.height;
      const [stageW, stageH] = this._getStageSize();

      // 折射强度平滑过渡
      for (const g of this.glasses) {
        g.refraction += (g.targetRefraction - g.refraction) * 0.3;
      }

      // 所有玻璃统一批量渲染
      if (this.glasses.length > 0) {
        this._drawGlassesInternal(this.glasses, canvasW, canvasH, stageW, stageH, stageCanvas, false);
      } else {
        gl.viewport(0, 0, canvasW, canvasH);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      if (this._warmupFrames > 0) this._warmupFrames--;
    } finally {
      this._isDrawingFrame = false;
    }
  }
  createGlass(args) {
    const id = Math.round(toSafeNumber(args.ID));
    const existingIdx = this.glasses.findIndex(g => g.id === id);
    if (existingIdx !== -1) this.glasses.splice(existingIdx, 1);
    this.glasses.push(createGlassState(id));
    if (!this.gl) this._ensureCanvas();
    this._hookRendererDraw();
    this._warmupFrames = 5;
    requestAnimationFrame(() => {
      if (this.runtime.renderer && this.runtime.renderer.draw) this.runtime.renderer.draw();
    });
  }
  deleteGlass(args) {
    const id = Math.round(toSafeNumber(args.ID));
    const idx = this.glasses.findIndex(g => g.id === id);
    if (idx !== -1) {
      this.glasses.splice(idx, 1);
    }
    this._onGlassesChanged();
  }
  deleteAllGlasses() {
    this.glasses = [];
    this._onGlassesChanged();
  }
  _onGlassesChanged() {
    const gl = this.gl;
    if (gl && this.canvas) {
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    if (this.glasses.length === 0) {
      this._unhookRendererDraw();
      this._warmupFrames = 0;
    }
  }
  setPosition(args) {
    const g = this._findGlass(args.ID);
    if (g) {
      g.x = toSafeNumber(args.X);
      g.y = toSafeNumber(args.Y);
    }
  }
  setSize(args) {
    const g = this._findGlass(args.ID);
    if (g) {
      g.width = Math.max(1, toSafeNumber(args.W));
      g.height = Math.max(1, toSafeNumber(args.H));
    }
  }
  setPreset(args) {
    const g = this._findGlass(args.ID);
    if (!g) return;
    const preset = String(args.PRESET);
    switch (preset) {
      case '默认玻璃':
        g.targetRefraction = 0.25;
        g.opacity = 0.9;
        g.blur = 0;
        g.tint = [1, 1, 1, 0];
        g.tintStrength = 0.5;
        g.edgeHighlight = 0.8;
        g.glow = 0;
        g.cornerRadius = Math.min(g.width, g.height) * 0.2;
        break;
      case '圆形玻璃':
        g.targetRefraction = 0.3;
        g.opacity = 0.95;
        g.blur = 0;
        g.tint = [1, 1, 1, 0];
        g.tintStrength = 0.5;
        g.edgeHighlight = 1.0;
        g.glow = 0;
        g.cornerRadius = 9999;
        break;
      case '方形玻璃':
        g.targetRefraction = 0.2;
        g.opacity = 0.85;
        g.blur = 0;
        g.tint = [1, 1, 1, 0];
        g.tintStrength = 0.5;
        g.edgeHighlight = 0.6;
        g.glow = 0;
        g.cornerRadius = 5;
        break;
      case '毛玻璃':
        g.targetRefraction = 0.1;
        g.opacity = 0.95;
        g.blur = 50;
        g.tint = [1, 1, 1, 0.2];
        g.tintStrength = 0.3;
        g.edgeHighlight = 0.3;
        g.glow = 0;
        g.cornerRadius = Math.min(g.width, g.height) * 0.15;
        break;
      case '彩色玻璃':
        g.targetRefraction = 0.35;
        g.opacity = 0.85;
        g.blur = 0;
        g.tint = [0.5, 0.8, 1.0, 0.6];
        g.tintStrength = 0.7;
        g.edgeHighlight = 1.0;
        g.glow = 0.3;
        g.cornerRadius = Math.min(g.width, g.height) * 0.25;
        break;
      case '发光玻璃':
        g.targetRefraction = 0.25;
        g.opacity = 0.9;
        g.blur = 10;
        g.tint = [0.3, 0.7, 1.0, 0.4];
        g.tintStrength = 0.6;
        g.edgeHighlight = 1.2;
        g.glow = 0.8;
        g.cornerRadius = Math.min(g.width, g.height) * 0.3;
        break;
      case '清水晶':
        g.targetRefraction = 0.4;
        g.opacity = 1.0;
        g.blur = 0;
        g.tint = [1, 1, 1, 0];
        g.tintStrength = 0;
        g.edgeHighlight = 1.5;
        g.glow = 0.1;
        g.cornerRadius = Math.min(g.width, g.height) * 0.4;
        break;
    }
  }
  setRefraction(args) {
    const g = this._findGlass(args.ID);
    if (g) g.targetRefraction = Math.max(0, toSafeNumber(args.VALUE)) / 100.0;
  }
  setOpacity(args) {
    const g = this._findGlass(args.ID);
    if (g) g.opacity = Math.min(100, Math.max(0, toSafeNumber(args.VALUE))) / 100.0;
  }
  setCorner(args) {
    const g = this._findGlass(args.ID);
    if (!g) return;
    g.cornerRadius = Math.min(500, Math.max(0, toSafeNumber(args.RADIUS)));
  }
  setBlur(args) {
    const g = this._findGlass(args.ID);
    if (g) g.blur = Math.min(100, Math.max(0, toSafeNumber(args.VALUE)));
  }
  setColor(args) {
    const g = this._findGlass(args.ID);
    if (g) {
      const [r, gB, b] = scratchColorToRGB(args.COLOR);
      g.tint = [r, gB, b, 1.0];
      g.tintStrength = Math.min(100, Math.max(0, toSafeNumber(args.STRENGTH))) / 100.0;
    }
  }
  setHighlight(args) {
    const g = this._findGlass(args.ID);
    if (g) g.edgeHighlight = Math.min(200, Math.max(0, toSafeNumber(args.VALUE))) / 100.0;
  }
  setGlow(args) {
    const g = this._findGlass(args.ID);
    if (g) g.glow = Math.min(200, Math.max(0, toSafeNumber(args.VALUE))) / 100.0;
  }
  renderAllGlasses() {
    if (this.gl && this.glasses.length > 0) this._boundDrawFrame();
  }
}
module.exports = WebGLLiquidGlassV4;