// Decodes an audio file to mono 22.05 kHz float32 PCM with ffmpeg (the same input the page's mapper sees after resampling).
export const decode = (file, rate = 22050) => {
  const r = Bun.spawnSync(["ffmpeg", "-v", "error", "-i", file, "-ac", "1", "-ar", String(rate), "-f", "f32le", "-"], { stdout: "pipe", stderr: "pipe" })
  if (r.exitCode !== 0) throw new Error("ffmpeg failed on " + file + ": " + r.stderr.toString())
  const b = r.stdout
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}
export const loadMapper = async (root) => new Function((await Bun.file(root + "/src/app/mapper.js").text()) + "; return mapSong")()
