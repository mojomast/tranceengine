const $ = (s) => document.querySelector(s)
const TAU = Math.PI * 2, VOID = "#07050a", BLENDS = ["lighter", "screen", "difference", "source-over"]
const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches
const num = (v, d) => (typeof v === "number" && Number.isFinite(v) ? v : d)
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch {} } }
const fmt = (sec) => { sec = Math.max(0, sec || 0); return Math.floor(sec / 60) + ":" + String(Math.floor(sec % 60)).padStart(2, "0") }
const smooth01 = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x) }

// ---------- Render pipelines: one 2D feedback buffer per VM slot, then a WebGL post pass ----------
const view = $("#scene")
const gl = view.getContext("webgl", { alpha: false, antialias: false, premultipliedAlpha: false })
const vctx = gl ? null : view.getContext("2d")
const makePipe = () => {
  const buf = document.createElement("canvas"), prev = document.createElement("canvas"), layer = document.createElement("canvas")
  return { buf, ctx: buf.getContext("2d"), prev, pctx: prev.getContext("2d"), layer, lctx: layer.getContext("2d") }
}
const pipes = { a: makePipe(), b: makePipe() }
const hasFilter = typeof pipes.a.ctx.filter === "string"

let post = null
if (gl) {
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s }
  const prog = gl.createProgram()
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 p;varying vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}"))
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, `precision mediump float;varying vec2 uv;
uniform sampler2D T,T2;uniform vec2 R,shake;
uniform float time,kick,flash,ab,grain,vig,bar,bloom,slice,seed,sparkle,tint,tintHue,desat,shock,shockR,stut,mixv,ttype,fork,build,rew;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
vec3 hue(float h){return clamp(abs(fract(h+vec3(0.,2./3.,1./3.))*6.-3.)-1.,0.,1.);}
vec3 samp(sampler2D t,vec2 p,vec2 d){return vec3(texture2D(t,p+d).r,texture2D(t,p).g,texture2D(t,p-d).b);}
void main(){
vec2 c=uv-.5;float asp=R.x/R.y;
vec2 p=.5+c*(1.-kick*.05-build*.07)+shake;float tm=mod(time,10.);
if(rew>.01){float tear=step(.84,hash(vec2(floor((uv.y+tm*.37)*22.),floor(tm*24.))));p.x+=(tear*.07+.005*sin(uv.y*80.+tm*40.))*rew;}
if(slice>.01){float band=floor(uv.y*24.);float r=hash(vec2(band,seed));if(r>.86)p.x+=(r-.93)*.3*slice;}
if(stut>.01){p.x+=(hash(vec2(floor(uv.y*R.y/4.),seed+time))-.5)*.012*stut;p.y+=(hash(vec2(seed,floor(time*20.)))-.5)*.01*stut;}
if(shock>.01){float d=length(c*vec2(asp,1.));float w=exp(-pow((d-shockR)*12.,2.));p+=normalize(c+1e-5)*w*.03*shock;}
vec2 d=c*ab;
vec3 col=samp(T,p,d);
if(build>.01){vec3 zb=vec3(0.);for(int i=1;i<6;i++){zb+=texture2D(T,.5+(p-.5)*(1.-float(i)*.014*build)).rgb;}col=mix(col,zb/5.,build*.6);col*=1.+build*build*build*.16;}
vec3 b=vec3(0.);vec2 px=1./R;
for(int i=0;i<8;i++){float a=float(i)*.785398;b+=max(texture2D(T,p+vec2(cos(a),sin(a))*px*10.).rgb-.42,0.);}
col+=b*bloom*.16;
if(mixv>.001){
 vec2 q=p;float m=0.;
 if(ttype<.5){float n=hash(floor(uv*R/7.));m=smoothstep(n-.12,n+.12,mixv*1.24-.12);}
 else if(ttype<1.5){float dd=length(c*vec2(asp,1.));float r=mixv*(.5*sqrt(asp*asp+1.))+.02;m=1.-smoothstep(r-.03,r,dd);}
 else if(ttype<2.5){m=step(fract(uv.y*9.),mixv);}
 else if(ttype<3.5){float x=(uv.x+uv.y)*.5;m=1.-smoothstep(mixv*1.2-.12,mixv*1.2,x);}
 else if(ttype<4.5){vec3 lb=texture2D(T2,p).rgb;float l=dot(lb,vec3(.3,.59,.11));m=max(smoothstep(1.-mixv*1.5,1.15-mixv*1.5,l),step(.97,mixv));}
 else if(ttype<5.5){float z=max(.001,mixv);q=.5+c/z;m=step(abs(c.x),z*.5)*step(abs(c.y),z*.5);}
 else{m=step(.999,mixv);}
 vec3 cb=samp(T2,q,d);
 col=mix(col,cb,m);
}
if(fork>.01){col+=samp(T2,vec2(1.-p.x,p.y),-d)*fork*.45;}
col=mix(col,col*(.6+hue(tintHue)*.8),tint);
col=mix(col,vec3(dot(col,vec3(.3,.59,.11))),desat);
col*=.955+.045*sin(uv.y*R.y*1.6);
col*=1.-vig*smoothstep(.3,.95,length(c*vec2(asp,1.))*.9);
col+=(hash(uv*R+time)-.5)*(grain+sparkle*.14);
if(rew>.01){col=mix(col,vec3(dot(col,vec3(.3,.59,.11)))*vec3(.85,1.,1.15),rew*.55);col+=vec3(.07,-.02,.09)*rew*sin(uv.y*R.y*.6+tm*30.);}
col=mix(col,vec3(1.),flash);
if(uv.y<bar||uv.y>1.-bar)col=vec3(0.);
gl_FragColor=vec4(col,1.);}`))
  gl.linkProgram(prog)
  if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    gl.useProgram(prog)
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const mkTex = (unit) => {
      const tex = gl.createTexture(); gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex)
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v)
      return tex
    }
    const texs = [mkTex(0), mkTex(1)]
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    const u = { texs }
    for (const n of ["T", "T2", "R", "shake", "time", "kick", "flash", "ab", "grain", "vig", "bar", "bloom", "slice", "seed", "sparkle", "tint", "tintHue", "desat", "shock", "shockR", "stut", "mixv", "ttype", "fork", "build", "rew"]) u[n] = gl.getUniformLocation(prog, n)
    gl.uniform1i(u.T, 0); gl.uniform1i(u.T2, 1)
    post = u
  }
}

let W = 0, H = 0, S = 1, barBase = 0, barPx = 0, barNow = 0
const resize = () => {
  W = innerWidth; H = innerHeight
  S = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(2.2e6 / Math.max(1, W * H)))
  for (const c of [view, pipes.a.buf, pipes.a.prev, pipes.a.layer, pipes.b.buf, pipes.b.prev, pipes.b.layer]) { c.width = Math.round(W * S); c.height = Math.round(H * S) }
  for (const p of [pipes.a, pipes.b]) { p.ctx.fillStyle = VOID; p.ctx.fillRect(0, 0, p.buf.width, p.buf.height) }
  if (gl) gl.viewport(0, 0, view.width, view.height)
  barBase = W / H > 1.25 ? Math.max(0, (1 - W / H / 2.0) / 2) : 0
  barPx = Math.round(barBase * H)
  barNow = barBase
  document.documentElement.style.setProperty("--bar", barPx + "px")
}
resize()
addEventListener("resize", resize)
new ResizeObserver(() => document.documentElement.style.setProperty("--dockh", $("#dock").offsetHeight + "px")).observe($("#dock"))

const colour = (o) => "hsla(" + num(o.h, 0) + "," + clamp(num(o.s, 90), 0, 100) + "%," + clamp(num(o.l, 60), 0, 100) + "%," + clamp(num(o.a, 1), 0, 1) + ")"
const drawShapes = (P, shapes) => {
  const lctx = P.lctx
  const paint = (o, fill) => {
    if (fill) { lctx.fillStyle = colour(o); lctx.fill() }
    else { lctx.strokeStyle = colour(o); lctx.lineWidth = clamp(num(o.lw, 2), 0.1, 80); lctx.stroke() }
  }
  lctx.setTransform(1, 0, 0, 1, 0, 0); lctx.clearRect(0, 0, P.layer.width, P.layer.height)
  lctx.setTransform(S, 0, 0, S, 0, barPx * S); lctx.lineCap = "round"; lctx.lineJoin = "round"
  let points = 0
  for (const o of shapes.slice(0, 6000)) {
    if (!o || typeof o !== "object") continue
    if (o.k === "c") {
      const r = num(o.r, 4); if (!(r > 0)) continue
      lctx.beginPath(); lctx.arc(num(o.x, 0), num(o.y, 0), Math.min(r, 5000), 0, TAU); paint(o, o.fill !== false)
    } else if (o.k === "p") {
      const p = o.pts; if (!Array.isArray(p) || p.length < 4 || points > 60000) continue
      points += p.length
      lctx.beginPath(); lctx.moveTo(num(p[0], 0), num(p[1], 0))
      for (let i = 2; i + 1 < p.length; i += 2) lctx.lineTo(num(p[i], 0), num(p[i + 1], 0))
      if (o.close !== false) lctx.closePath()
      paint(o, o.fill === true)
    } else if (o.k === "l") {
      lctx.beginPath(); lctx.moveTo(num(o.x1, 0), num(o.y1, 0)); lctx.lineTo(num(o.x2, 0), num(o.y2, 0)); paint(o, false)
    } else if (o.k === "w") {
      drawKinetic(lctx, o, A)
    } else if (o.k === "t") {
      lctx.font = clamp(num(o.size, 32), 6, 400) + "px Shrikhand, Georgia, serif"; lctx.textAlign = "center"; lctx.textBaseline = "middle"
      lctx.fillStyle = colour(o); lctx.fillText(String(o.text).slice(0, 200), num(o.x, 0), num(o.y, 0))
    }
  }
}
// One frame of a scene into its pipe: feedback (trail, zoom, spin, hue drift), new shapes (pumped by
// kick hits), then the kaleidoscope fold.
const render = (P, shapes, fx, pump) => {
  fx = fx || {}
  const { ctx, pctx, buf, prev, layer } = P
  const trail = clamp(num(fx.trail, 0.9), 0, 0.995), spin = clamp(num(fx.spin, 0), -0.5, 0.5)
  const zoom = clamp(num(fx.zoom, 1), 0.8, 1.25)
  const hue = clamp(num(fx.hue, 0), -45, 45), blend = BLENDS.includes(fx.blend) ? fx.blend : "lighter"
  let mirror = Math.round(clamp(num(fx.mirror, 0), 0, 32)); if (mirror % 2) mirror++
  const cx = buf.width / 2, cy = buf.height / 2
  pctx.globalCompositeOperation = "copy"; pctx.drawImage(buf, 0, 0)
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = "source-over"; ctx.fillStyle = VOID; ctx.fillRect(0, 0, buf.width, buf.height)
  ctx.globalAlpha = trail
  if (hasFilter && hue) ctx.filter = "hue-rotate(" + hue + "deg)"
  ctx.translate(cx, cy); ctx.rotate(spin); ctx.scale(zoom, zoom); ctx.translate(-cx, -cy)
  ctx.drawImage(prev, 0, 0); ctx.restore()
  drawShapes(P, shapes)
  const k = 1 + pump
  ctx.save(); ctx.globalCompositeOperation = blend
  if (mirror >= 2) {
    const seg = TAU / mirror, R = Math.hypot(cx, cy) + 4
    for (let i = 0; i < mirror; i++) {
      ctx.save(); ctx.translate(cx, cy)
      if (i % 2) { ctx.rotate((i + 1) * seg); ctx.scale(1, -1) } else ctx.rotate(i * seg)
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, -0.003, seg + 0.003); ctx.closePath(); ctx.clip()
      ctx.scale(k, k); ctx.drawImage(layer, -cx, -cy); ctx.restore()
    }
  } else { ctx.translate(cx, cy); ctx.scale(k, k); ctx.drawImage(layer, -cx, -cy) }
  ctx.restore()
}
const copyPipe = (from, to) => {
  to.ctx.save(); to.ctx.setTransform(1, 0, 0, 1, 0, 0); to.ctx.globalCompositeOperation = "copy"; to.ctx.globalAlpha = 1
  to.ctx.drawImage(from.buf, 0, 0); to.ctx.restore()
}
