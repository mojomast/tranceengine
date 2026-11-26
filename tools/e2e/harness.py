"""Shared Playwright harness: serves dist/ through a route (no server process needed) and opens the app."""
import mimetypes, os
from playwright.async_api import async_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..")
DIST = os.path.join(ROOT, "dist")
# Software GL so it runs on CI boxes; autoplay so songs start without a click.
ARGS = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"]
CHROME = os.environ.get("CHROME")  # optional path to a Chrome binary; Playwright's Chromium is used otherwise
CLEAN = "for (const id of ['dock','hud','caption','vmtag','title','toast']) { const e = document.getElementById(id); if (e) e.style.display = 'none' }"

async def serve(route):
    path = route.request.url.split("trance.test/")[1].split("?")[0] or "index.html"
    f = os.path.join(DIST, path)
    if not os.path.isfile(f):
        return await route.fulfill(status=404, body="")
    data = open(f, "rb").read()
    ctype = mimetypes.guess_type(f)[0] or "application/octet-stream"
    rng = route.request.headers.get("range")
    if rng and rng.startswith("bytes="):  # media elements seek with range requests
        a, b = rng[6:].split("-"); a = int(a); b = int(b) if b else len(data) - 1
        return await route.fulfill(status=206, body=data[a:b + 1], headers={"Content-Type": ctype, "Content-Range": f"bytes {a}-{b}/{len(data)}", "Accept-Ranges": "bytes"})
    await route.fulfill(status=200, body=data, headers={"Content-Type": ctype, "Accept-Ranges": "bytes"})

async def open_app(p, width=1280, height=720, video_dir=None):
    kw = {"executable_path": CHROME} if CHROME else {}
    browser = await p.chromium.launch(args=ARGS, **kw)
    ctx = await browser.new_context(viewport={"width": width, "height": height}, record_video_dir=video_dir, record_video_size={"width": width, "height": height} if video_dir else None)
    page = await ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" and "fonts" not in m.text and "ERR_" not in m.text else None)
    await page.route("http://trance.test/**", serve)
    await page.goto("http://trance.test/index.html")
    await page.wait_for_timeout(800)
    return browser, ctx, page, errors
