// The game's own picture, drawn on a canvas. A page in the game cannot ask for a screenshot, but it
// can be handed the frame the game has just drawn as a WebGL texture: a texture whose wrap mode is
// set in one particular order is swapped, by the game's browser, for the game's picture - live, and
// without the page (the picture is what is under every page). Nothing here works in a plain
// browser: there the texture stays the one dot it was made as.
//
// The swap is not to be relied on blind (all of this measured in the game, FiveM's Chromium 103):
//   - it is lost if the canvas is resized between the asking and the first draw, so the texture is
//     asked for by draw() itself, in the same breath as it is first used and after the caller has
//     sized the canvas;
//   - a second canvas asking while another holds the picture may get nothing, so whoever is done
//     with it lets go (release) - and letting go only counts once the browser has carried it out;
//   - so every frame drawn is looked at until one is the game's, and while none is the texture is
//     thrown away and asked for again.

/** What the texture holds until the game takes it over: a colour no frame of the game is all of. */
const SEED = [3, 1, 2] as const;
/** Frames drawn without the game's picture before the texture is asked for again. */
const ASK_AGAIN = 3;
/** Frames between two looks at a picture that has been the game's: it should stay so. */
const LOOK_AGAIN = 120;

const VERTEX = 'attribute vec2 a; varying vec2 v; void main() { v = a * 0.5 + 0.5; gl_Position = vec4(a, 0.0, 1.0); }';
// Four taps a quarter of a pixel apart: the picture is usually drawn far smaller than the game
// draws it, and one tap for each pixel of it would shimmer.
const FRAGMENT = `precision mediump float;
varying vec2 v;
uniform sampler2D t;
uniform vec2 px;
void main() {
  vec3 c = texture2D(t, v + px * vec2(-0.25, -0.25)).rgb + texture2D(t, v + px * vec2(0.25, -0.25)).rgb
    + texture2D(t, v + px * vec2(-0.25, 0.25)).rgb + texture2D(t, v + px * vec2(0.25, 0.25)).rgb;
  gl_FragColor = vec4(c * 0.25, 1.0);
}`;

export interface GameView {
  /**
   * Draw the frame the game is showing now over the whole canvas, at the size the canvas has now.
   * @returns whether what was drawn is the game's picture (it may take a few frames to be)
   */
  draw(): boolean;
  /** Let go of the game's picture, for another canvas to have. What was drawn last stays where it is kept. */
  release(): void;
  /** Give the canvas's drawing context back. The canvas cannot be used again. */
  dispose(): void;
}

/**
 * Set a canvas up to show the game's picture.
 * @param keep whether what is drawn stays on the canvas once drawing stops (a still)
 * @returns null where the page has no WebGL to draw with
 */
export function gameView(canvas: HTMLCanvasElement, keep = false): GameView | null {
  const gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, alpha: false, preserveDrawingBuffer: keep });
  if (!gl) return null;

  const shader = (type: number, source: string): WebGLShader | null => {
    const s = gl.createShader(type);
    if (!s) return null;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
  };
  const program = gl.createProgram();
  const vs = shader(gl.VERTEX_SHADER, VERTEX);
  const fs = shader(gl.FRAGMENT_SHADER, FRAGMENT);
  if (!program || !vs || !fs) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const at = gl.getAttribLocation(program, 'a');
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  const px = gl.getUniformLocation(program, 'px');

  let texture: WebGLTexture | null = null;
  let live = false;
  let frames = 0; // drawn since the picture was last asked for (while it is not live) or looked at (while it is)
  const dot = new Uint8Array(4);

  const release = () => {
    live = false;
    frames = 0;
    if (!texture) return;
    gl.deleteTexture(texture);
    texture = null;
    gl.finish(); // (carried out now, not whenever the browser next gets to it: someone may be waiting for the picture)
  };

  const ask = () => {
    texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([...SEED, 255]));
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    // The order that asks for the game's picture: clamp, mirrored repeat, repeat - then the other
    // axis clamped, which is what says the three before it were meant.
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.MIRRORED_REPEAT);
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameterf(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  };

  /** Whether the frame just drawn is the game's: one that is still the dot is that dot all over. */
  const looksLive = (): boolean => {
    gl.readPixels(canvas.width >> 1, canvas.height >> 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, dot);
    return dot[0] !== SEED[0] || dot[1] !== SEED[1] || dot[2] !== SEED[2];
  };

  return {
    draw() {
      if (gl.isContextLost()) return false;
      if (!texture) ask();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(px, 1 / Math.max(1, canvas.width), 1 / Math.max(1, canvas.height));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      frames++;
      if (live) {
        if (frames < LOOK_AGAIN) return true;
        frames = 0;
        live = looksLive();
        if (!live) release(); // (taken from under this canvas: asked for again with the next frame)
        return live;
      }
      live = looksLive();
      if (live) frames = 0;
      else if (frames >= ASK_AGAIN) release();
      return live;
    },
    release,
    dispose() {
      release();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}

/** The shape of the game's picture: the display's, which the page holding the OS covers all of. */
export function displayAspect(): number {
  try {
    const top = window.parent;
    if (top.innerWidth > 0 && top.innerHeight > 0) return top.innerWidth / top.innerHeight;
  } catch {
    // (a parent of another origin: not the game)
  }
  return 16 / 9;
}
