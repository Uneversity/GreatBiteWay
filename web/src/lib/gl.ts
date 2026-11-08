/**
 * Compiles a WebGL program without freezing the page.
 *
 * Shader compilation is the slow part of the dive's first load: asking for
 * COMPILE_STATUS / LINK_STATUS right after compiling makes the browser wait for
 * the GPU driver on the main thread (over a second for the deep-ocean scene).
 * With KHR_parallel_shader_compile we poll COMPLETION_STATUS_KHR each frame
 * instead, which never blocks. Without the extension we still wait for the
 * browser to be idle first, so the page has painted before any freeze.
 */

export type ProgramHandle = { prog: WebGLProgram; vs: WebGLShader; fs: WebGLShader };

type Options = {
  label: string;
  /** Wait for an idle moment before starting (for scenes that aren't visible yet). */
  deferUntilIdle?: boolean;
  onReady: (h: ProgramHandle) => void;
  onFail: () => void;
};

type Idle = (cb: () => void, opts?: { timeout: number }) => number;

function whenIdle(cb: () => void, timeout: number): () => void {
  const ric = (window as unknown as { requestIdleCallback?: Idle }).requestIdleCallback;
  if (ric) {
    const id = ric(cb, { timeout });
    return () => (window as unknown as { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id);
  }
  const id = window.setTimeout(cb, Math.min(timeout, 200));
  return () => window.clearTimeout(id);
}

/** Starts compiling; returns a cancel function. Calls onReady or onFail exactly once unless cancelled. */
export function compileProgramAsync(gl: WebGLRenderingContext, vert: string, frag: string, opts: Options): () => void {
  let cancelled = false;
  let raf = 0;
  let cancelIdle: () => void = () => {};
  const ext = gl.getExtension("KHR_parallel_shader_compile") as { COMPLETION_STATUS_KHR: number } | null;

  const fail = (what: string, log: string | null) => {
    console.error(`[${opts.label}] ${what}:`, log);
    opts.onFail();
  };

  const start = () => {
    if (cancelled) return;
    const vs = gl.createShader(gl.VERTEX_SHADER);
    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return opts.onFail();
    gl.shaderSource(vs, vert);
    gl.shaderSource(fs, frag);
    gl.compileShader(vs);
    gl.compileShader(fs);
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    const finish = () => {
      if (cancelled) return;
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) return fail("shader error", gl.getShaderInfoLog(fs));
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) return fail("shader error", gl.getShaderInfoLog(vs));
        return fail("link error", gl.getProgramInfoLog(prog));
      }
      opts.onReady({ prog, vs, fs });
    };

    if (!ext) {
      // No async compile available: at least let the page paint first.
      cancelIdle = whenIdle(finish, 1500);
      return;
    }
    const poll = () => {
      if (cancelled) return;
      if (gl.getProgramParameter(prog, ext.COMPLETION_STATUS_KHR)) finish();
      else raf = requestAnimationFrame(poll);
    };
    raf = requestAnimationFrame(poll);
  };

  if (opts.deferUntilIdle) cancelIdle = whenIdle(start, 2500);
  else start();

  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
    cancelIdle();
  };
}
