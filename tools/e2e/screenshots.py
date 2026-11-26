"""Regenerates the README screenshots in docs/screenshots/ (run `bun tools/build.mjs` first).

    python3 tools/e2e/screenshots.py            # stills
    python3 tools/e2e/screenshots.py --gif      # also the build-to-drop animation (needs ffmpeg)
"""
import asyncio, glob, os, shutil, subprocess, sys, tempfile
from playwright.async_api import async_playwright
from harness import open_app, CLEAN, ROOT

OUT = os.path.join(ROOT, "docs", "screenshots")
# (file, scene name, phase, milliseconds to let it develop); the director is frozen, so scenes hold their phase.
STILLS = [
    ("polytope-cathedral.jpg", "Polytope chapel", 2, 3500),
    ("hero-600-cell.jpg", "Polytope chapel", 3, 5500),
    ("murmuration-orb.jpg", "Murmuration", 2, 4000),
    ("murmuration-slop.jpg", "Murmuration", 3, 3400),
    ("attractor-lorenz.jpg", "Strange attractor", 2, 4000),
    ("grimoire.jpg", "The Grimoire", 2, 4000),
    ("sloperator.jpg", "The Sloperator", 1, 4000),
    ("summoning-circle.jpg", "Summoning circle", 3, 4000),
    ("astral-city.jpg", "Astral city", 3, 4000),
    ("eclipse-temple.jpg", "Eclipse temple", 1, 4000),
    ("spectral-manifold.jpg", "Spectral manifold", 2, 4000),
    ("kinetic-type.jpg", "Kinetic type", 0, 3000),
]

async def stills(p):
    browser, ctx, page, errors = await open_app(p, 1600, 900)
    await page.click("#s-silent"); await page.wait_for_timeout(1200)
    await page.evaluate("__trance.setAuto(false); __trance.freeze(true)")  # no cuts or phase steps while we pose scenes
    for file, name, phase, wait in STILLS:
        i = await page.evaluate(f"__trance.scenes.indexOf({name!r})")
        await page.evaluate(f"__trance.cut({i})"); await page.wait_for_timeout(1500)
        await page.evaluate(f"__trance.cueNow({phase})"); await page.wait_for_timeout(wait)
        await page.evaluate(CLEAN)
        await page.screenshot(path=os.path.join(OUT, file), type="jpeg", quality=88)
        await page.evaluate("for (const id of ['dock','hud']) document.getElementById(id).style.display = ''")
        print("wrote", file)
    # The player UI with the timeline strip, on a mapped song.
    await page.evaluate("__trance.freeze(false)")
    await page.select_option("#tracks", "2"); await page.wait_for_timeout(16000)
    await page.mouse.move(800, 880); await page.wait_for_timeout(300)
    await page.screenshot(path=os.path.join(OUT, "player-timeline.jpg"), type="jpeg", quality=88)
    print("wrote player-timeline.jpg", "errors:", errors[:3])
    await browser.close()

async def gif(p):
    tmp = tempfile.mkdtemp()
    browser, ctx, page, errors = await open_app(p, 960, 540, video_dir=tmp)
    await page.click("#s-break")
    await page.evaluate(CLEAN)
    await page.wait_for_function("__trance.mapT >= 27", timeout=60000, polling=100)
    t_song0 = await page.evaluate("__trance.mapT")
    await ctx.close(); await browser.close()
    video = glob.glob(os.path.join(tmp, "*.webm"))[0]
    # The page's song clock and the video clock differ by the load time; anchor on "now" = end of the recording.
    dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video]).strip() or 0)
    start = max(0, dur - (t_song0 - 18.5))
    pal = (os.path.join(tmp, "pal.png"),)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.2f}", "-t", "6.5", "-i", video, "-vf", "fps=12,scale=600:-1:flags=lanczos,hqdn3d=6:6:6:6,palettegen=max_colors=96:stats_mode=diff", pal[0]], check=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{start:.2f}", "-t", "6.5", "-i", video, "-i", pal[0], "-lavfi", "fps=12,scale=600:-1:flags=lanczos,hqdn3d=6:6:6:6[x];[x][1:v]paletteuse=dither=none:diff_mode=rectangle", os.path.join(OUT, "build-to-drop.gif")], check=True)
    print("wrote build-to-drop.gif", os.path.getsize(os.path.join(OUT, "build-to-drop.gif")) // 1024, "KB")
    shutil.rmtree(tmp, ignore_errors=True)

async def main():
    os.makedirs(OUT, exist_ok=True)
    async with async_playwright() as p:
        await stills(p)
        if "--gif" in sys.argv: await gif(p)

asyncio.run(main())
