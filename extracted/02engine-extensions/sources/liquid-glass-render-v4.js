(function (Scratch) {
  'use strict';

  if (!Scratch.extensions.unsandboxed) {
    throw new Error('「WebGL 液态玻璃 V4」扩展必须以 unsandboxed 模式加载。');
  }

  const vm = Scratch.vm;
  const runtime = vm.runtime;

  const OVERLAY_CANVAS_ID = 'webgl-liquid-glass-v4-overlay-canvas';

  const VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;

uniform vec2 uCenter;
uniform vec2 uHalfSize;
uniform vec2 uHalfStage;

out vec2 v_localPos;

void main() {
  v_localPos = aPosition;
  vec2 worldPos = uCenter + aPosition * uHalfSize;
  vec2 clip = worldPos / uHalfStage;
  gl_Position = vec4(clip, 0.0, 1.0);
}
`;

  // ── V4 增强版片元着色器 ──
  // 新增：颜色叠色混合、边缘高光、外发光
  const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;

in vec2 v_localPos;

out vec4 fragColor;

uniform sampler2D uStageTexture;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform vec2 uHalfStage;
uniform vec2 uHalfSize;
uniform float uRefraction;
uniform float uDiameter;
uniform float uOpacity;
uniform float uCornerRadius;
uniform float uBlur;
uniform vec4 uTint;         // 叠色 RGBA (0-1)
uniform float uTintStrength; // 叠色强度 0-1
uniform float uEdgeHighlight; // 边缘高光强度
uniform float uGlow;        // 外发光强度

// 颜色工具函数
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0*d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec2 halfPx = uHalfSize / 1.0625;
    vec2 p = v_localPos * 2.0 * uHalfSize;

    // ════════════════════════════════════════════════════════════════
    // 归一化径向距离（用于折射/高光/暗边环等内部效果）
    // ════════════════════════════════════════════════════════════════
    // 使用方形度量 max(nrm.x, nrm.y)，确保角落附近 dist 不会过大
    // 这样 body/rim 在圆角区域不会变成 0，圆角才会有颜色
    // 形状轮廓由下方的 SDF 独立控制，与内部效果完全解耦
    vec2 nrm = abs(p) / max(halfPx, vec2(1e-3));
    float dist = 0.5 * max(nrm.x, nrm.y);  // 方形度量：0=中心，0.5=边缘

    // 球透镜折射
    vec2 center = uCenter / (2.0 * uHalfStage) + 0.5;
    vec2 screenUV = gl_FragCoord.xy / uResolution;
    vec2 tex = screenUV - center;

    float dis2x = min(dist * 2.0, 0.99);
    float sq = sqrt(max(1.0 - dis2x * dis2x, 1e-4));
    float num = uRefraction / sq - uRefraction;

    vec2 refractUV = tex * (1.0 - num) + center;
    vec2 glassHalfUV = (uHalfSize / 1.0625) / (2.0 * uHalfStage);
    vec2 rebUV = center + tex * (1.0 + num);
    rebUV = clamp(rebUV, center - glassHalfUV, center + glassHalfUV);

    // ══════════════════════════════════════
    // 高质量高斯模糊：15点加权采样，绝对丝滑
    // 完全不用mipmap，任何情况都不会马赛克/花
    // ══════════════════════════════════════
    float blurRadius = clamp(uBlur, 0.0, 1.0) * 0.018;
    vec3 col = vec3(0.0);
    
    if (blurRadius < 0.0002) {
      col = texture(uStageTexture, refractUV).rgb;
    } else {
      // 标准高斯分布权重，总和=1，中心最重，向外递减，各方向均匀覆盖
      // 中心
      col += texture(uStageTexture, refractUV).rgb * 0.20;
      // 上下左右（近圈）
      col += texture(uStageTexture, refractUV + vec2(0, blurRadius)).rgb * 0.135;
      col += texture(uStageTexture, refractUV + vec2(0, -blurRadius)).rgb * 0.135;
      col += texture(uStageTexture, refractUV + vec2(blurRadius, 0)).rgb * 0.135;
      col += texture(uStageTexture, refractUV + vec2(-blurRadius, 0)).rgb * 0.135;
      // 四个斜角
      col += texture(uStageTexture, refractUV + vec2(blurRadius*0.7, blurRadius*0.7)).rgb * 0.05;
      col += texture(uStageTexture, refractUV + vec2(-blurRadius*0.7, blurRadius*0.7)).rgb * 0.05;
      col += texture(uStageTexture, refractUV + vec2(blurRadius*0.7, -blurRadius*0.7)).rgb * 0.05;
      col += texture(uStageTexture, refractUV + vec2(-blurRadius*0.7, -blurRadius*0.7)).rgb * 0.05;
      // 远圈（更大模糊范围）
      col += texture(uStageTexture, refractUV + vec2(0, blurRadius*1.8)).rgb * 0.015;
      col += texture(uStageTexture, refractUV + vec2(0, -blurRadius*1.8)).rgb * 0.015;
      col += texture(uStageTexture, refractUV + vec2(blurRadius*1.8, 0)).rgb * 0.015;
      col += texture(uStageTexture, refractUV + vec2(-blurRadius*1.8, 0)).rgb * 0.015;
    }
    
    // 色散采样（同样清晰采样，色散边缘不糊）
    vec3 reb = texture(uStageTexture, rebUV).rgb;

    num = abs(num);
    // 亮度补偿
    col *= clamp(1.03125 - num * 0.25, 0.625, 1.0) + clamp(num * 0.125 - 0.0625, 0.0, 0.25);

    // ══════════════════════════════════════
    // 玻璃本身染色：光线穿过滤色，不会盖住折射
    // ══════════════════════════════════════
    float tintStrength = uTint.a * uTintStrength;
    if (tintStrength > 0.0) {
      vec3 tinted = col * uTint.rgb * 1.5;
      col = mix(col, tinted, tintStrength);
    }

    // 边缘色散
    col = mix(col + clamp(num * 0.25 - 0.0625, 0.0, 0.5) * 0.5,
              reb, clamp(dist * (1.0 + num) - 0.5625, 0.0, 1.0) * 0.75);

    // ══════════════════════════════════════
    // V4 新增：液态玻璃边缘高光
    // ══════════════════════════════════════
    float innerHighlight = smoothstep(0.35, 0.48, dist) * (1.0 - smoothstep(0.48, 0.52, dist));
    float rimLight = pow(1.0 - dist * 1.8, 3.0) * uEdgeHighlight;
    float topLight = smoothstep(0.1, 0.5, 0.5 - nrm.y) * (1.0 - smoothstep(0.0, 0.3, abs(nrm.x))) * 0.15 * uEdgeHighlight;
    col += vec3(1.0) * (innerHighlight * 0.3 + rimLight * 0.25 + topLight);

    // ════════════════════════════════════════════════════════════════
    // 四个角圆角：圆角矩形 SDF 形状遮罩
    // ════════════════════════════════════════════════════════════════
    // 这是真正决定"四个角圆角"形状的地方
    // 圆角只影响轮廓，不影响内部折射/高光（上面已解耦）

    // 步骤 1：限幅圆角半径 ∈ [0, 短边一半]
    //   防止圆角超过矩形尺寸导致变形
    float maxRadius = min(halfPx.x, halfPx.y);
    float cr = clamp(uCornerRadius, 0.0, maxRadius);

    // 步骤 2：圆角矩形 SDF（标准有向距离场公式）
    //   利用四象限对称（abs(p)），四个角共用同一套计算
    //   - q = abs(p) - halfPx + cr   把原点平移到圆角圆心
    //   - min(max(q.x,q.y), 0.0)     处理内部矩形区域
    //   - length(max(q, 0.0))        处理四个角的外部圆角区域
    //   sd < 0 内部，sd = 0 边缘，sd > 0 外部
    vec2 q = abs(p) - halfPx + cr;
    float sd = min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - cr;

    // 步骤 3：形状遮罩（2 像素宽抗锯齿过渡带）
    //   sd < -1 → 完全在内部 → mask = 1
    //   sd > +1 → 完全在外部 → mask = 0
    float shapeMask = 1.0 - smoothstep(-1.0, 1.0, sd);

    // 步骤 4：外发光（复用同一个 SDF，向外扩展更大范围）
    float glowMask = 1.0 - smoothstep(-3.0, 8.0, sd);
    float glow = glowMask * uGlow * 0.3;
    col += uTint.rgb * glow;

    // 玻璃体 + 暗边环
    float rim = clamp(0.53125 - dist, 0.0, 1.0);
    float body = clamp((0.5 - dist) * uDiameter * 0.5, 0.0, 1.0);
    float glassA = rim * (1.0 - body) + body;

    float finalAlpha = glassA * shapeMask * uOpacity;
    fragColor = vec4(col * body * shapeMask, finalAlpha);
}
`;

  // 全屏背景着色器
  const BACKGROUND_VERTEX_SHADER_SOURCE = `#version 300 es
precision highp float;
layout(location = 0) in vec2 aPosition;
out vec2 v_uv;
void main() {
  v_uv = aPosition + 0.5;
  gl_Position = vec4(aPosition * 2.0, 0.0, 1.0);
}`;

  const BACKGROUND_FRAGMENT_SHADER_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D uStageTexture;
void main() {
  fragColor = texture(uStageTexture, v_uv);
}`;

  function toSafeNumber(value) {
    if (Scratch.Cast && typeof Scratch.Cast.toNumber === 'function') {
      return Scratch.Cast.toNumber(value);
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  // Scratch颜色转RGB (0-1)
  function scratchColorToRGB(color) {
    const hex = Scratch.Cast.toString(color);
    let r = 1, g = 1, b = 1;
    if (hex.startsWith('#') && hex.length >= 7) {
      r = parseInt(hex.substr(1, 2), 16) / 255;
      g = parseInt(hex.substr(3, 2), 16) / 255;
      b = parseInt(hex.substr(5, 2), 16) / 255;
    } else {
      const num = Number(hex);
      if (Number.isFinite(num)) {
        r = ((num >> 16) & 0xFF) / 255;
        g = ((num >> 8) & 0xFF) / 255;
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
          try { self._boundDrawFrame(); } catch (err) { console.error('[液态玻璃V4] 绘制失败:', err); }
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
        blocks: [
          {
            opcode: 'createGlass',
            blockType: Scratch.BlockType.COMMAND,
            text: '✨ 创建编号 [ID] 的液态玻璃',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 }
            }
          },
          {
            opcode: 'deleteGlass',
            blockType: Scratch.BlockType.COMMAND,
            text: '🗑️ 删除液态玻璃 [ID]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 }
            }
          },
          {
            opcode: 'deleteAllGlasses',
            blockType: Scratch.BlockType.COMMAND,
            text: '🗑️ 删除全部液态玻璃'
          },
          '---',
          {
            opcode: 'setPosition',
            blockType: Scratch.BlockType.COMMAND,
            text: '📍 将玻璃 [ID] 位置设为 x: [X] y: [Y]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              X: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
              Y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
            }
          },
          {
            opcode: 'setSize',
            blockType: Scratch.BlockType.COMMAND,
            text: '📐 将玻璃 [ID] 大小设为 宽: [W] 高: [H]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              W: { type: Scratch.ArgumentType.NUMBER, defaultValue: 120 },
              H: { type: Scratch.ArgumentType.NUMBER, defaultValue: 80 }
            }
          },
          '---',
          {
            opcode: 'setPreset',
            blockType: Scratch.BlockType.COMMAND,
            text: '🎨 将玻璃 [ID] 设为 [PRESET] 样式',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              PRESET: { type: Scratch.ArgumentType.STRING, menu: 'presetMenu', defaultValue: '默认玻璃' }
            }
          },
          {
            opcode: 'setRefraction',
            blockType: Scratch.BlockType.COMMAND,
            text: '🔍 将玻璃 [ID] 折射强度设为 [VALUE]%',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              VALUE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 25 }
            }
          },
          {
            opcode: 'setOpacity',
            blockType: Scratch.BlockType.COMMAND,
            text: '👁️ 将玻璃 [ID] 不透明度设为 [VALUE]%',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              VALUE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 90 }
            }
          },
          {
            opcode: 'setCorner',
            blockType: Scratch.BlockType.COMMAND,
            text: '⭕ 将玻璃 [ID] 圆角半径设为 [RADIUS]',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              RADIUS: { type: Scratch.ArgumentType.NUMBER, defaultValue: 20 }
            }
          },
          {
            opcode: 'setBlur',
            blockType: Scratch.BlockType.COMMAND,
            text: '🌫️ 将玻璃 [ID] 模糊度设为 [VALUE]%',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              VALUE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
            }
          },
          '---',
          {
            opcode: 'setColor',
            blockType: Scratch.BlockType.COMMAND,
            text: '🎨 将玻璃 [ID] 颜色设为 [COLOR] 强度 [STRENGTH]%',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              COLOR: { type: Scratch.ArgumentType.COLOR, defaultValue: '#80DEEA' },
              STRENGTH: { type: Scratch.ArgumentType.NUMBER, defaultValue: 50 }
            }
          },
          {
            opcode: 'setHighlight',
            blockType: Scratch.BlockType.COMMAND,
            text: '✨ 将玻璃 [ID] 高光强度设为 [VALUE]%',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              VALUE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 80 }
            }
          },
          {
            opcode: 'setGlow',
            blockType: Scratch.BlockType.COMMAND,
            text: '💡 将玻璃 [ID] 外发光强度设为 [VALUE]%',
            arguments: {
              ID: { type: Scratch.ArgumentType.NUMBER, defaultValue: 1 },
              VALUE: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
            }
          },
          {
            opcode: 'renderAllGlasses',
            blockType: Scratch.BlockType.COMMAND,
            text: '🔄 强制刷新所有玻璃'
          }
        ],
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

      try { this._initGL(); } catch (error) {
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
      try { this._initGL(); } catch (error) { return; }
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
      this.bgUniforms = { uStageTexture: gl.getUniformLocation(bgProgram, 'uStageTexture') };

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
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, 0.5
      ]), gl.STATIC_DRAW);
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
      
      switch(preset) {
        case '默认玻璃':
          g.targetRefraction = 0.25;
          g.opacity = 0.9;
          g.blur = 0;
          g.tint = [1,1,1,0];
          g.tintStrength = 0.5;
          g.edgeHighlight = 0.8;
          g.glow = 0;
          g.cornerRadius = Math.min(g.width, g.height) * 0.2;
          break;
        case '圆形玻璃':
          g.targetRefraction = 0.3;
          g.opacity = 0.95;
          g.blur = 0;
          g.tint = [1,1,1,0];
          g.tintStrength = 0.5;
          g.edgeHighlight = 1.0;
          g.glow = 0;
          g.cornerRadius = 9999;
          break;
        case '方形玻璃':
          g.targetRefraction = 0.2;
          g.opacity = 0.85;
          g.blur = 0;
          g.tint = [1,1,1,0];
          g.tintStrength = 0.5;
          g.edgeHighlight = 0.6;
          g.glow = 0;
          g.cornerRadius = 5;
          break;
        case '毛玻璃':
          g.targetRefraction = 0.1;
          g.opacity = 0.95;
          g.blur = 50;
          g.tint = [1,1,1,0.2];
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
          g.tint = [1,1,1,0];
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

  Scratch.extensions.register(new WebGLLiquidGlassV4(runtime));
})(Scratch);
