"""End-to-end smoke test: every bundled track maps and plays, the planned edit advances, seeking restores a scene
from a VM snapshot, scrubbing while paused moves the picture, and nothing throws. Run `bun tools/build.mjs` first.

    pip install playwright && python -m playwright install chromium
    python3 tools/e2e/smoke.py
"""
import asyncio, sys
from playwright.async_api import async_playwright
from harness import open_app

async def main():
    ok = True
    def check(cond, msg):
        nonlocal ok
        print(("  ok   " if cond else "  FAIL ") + msg); ok = ok and cond
    async with async_playwright() as p:
        browser, ctx, page, errors = await open_app(p)
        await page.click("#s-song")
        # CI runners render with software GL and can be slow, so wait on conditions rather than fixed times.
        async def until(js, ms):
            try: await page.wait_for_function(js, timeout=ms, polling=200); return True
            except Exception: return False
        await until("__trance.mapT > 2", 20000)
        rendering = await until("__trance.slots.some(s => s.frames > 20)", 30000)
        st = await page.evaluate("({mapped: __trance.mapped, t: __trance.mapT, slots: __trance.slots, fps: document.getElementById('fps').textContent})")
        print(f"  info render: {st['fps']} fps, frames per slot {[s['frames'] for s in st['slots']]}")
        check(st["mapped"], "the default song has a map")
        check(st["t"] > 2, f"playback advances (t = {st['t']:.1f} s)")
        check(rendering, "a scene is rendering frames")
        for idx, name in [(1, "Slow Burn"), (2, "Breakneck")]:
            await page.evaluate(f"(() => {{ const s = document.getElementById('tracks'); s.value = '{idx}'; s.dispatchEvent(new Event('change')) }})()")
            await page.wait_for_timeout(2500)
            check(await page.evaluate("__trance.mapped && __trance.mapT > 1"), f"{name} maps and plays")
        # Let the plan run until the first shot has a keyframe and we are well past it, then seek back into it.
        await until("__trance.keyframes.some(k => k.startsWith('0:')) && __trance.mapT > 8", 45000)
        print(f"  info keyframes: {await page.evaluate('__trance.keyframes.slice(0, 4)')}")
        # Clear the tag first: a beat-repeat stutter also says "rewound", and must not be mistaken for the seek.
        await page.evaluate("(() => { document.getElementById('vmtag').textContent = ''; const s = document.getElementById('seek'); s.value = 3; s.dispatchEvent(new Event('input')) })()")
        await until("document.getElementById('vmtag').textContent.includes('rewound to')", 8000)
        tag = await page.evaluate("document.getElementById('vmtag').textContent")
        check("rewound to" in tag, f"seeking back shows the rewind ({tag!r})")
        check("snapshot" in tag, "the scene was restored from a VM snapshot")
        await page.click("#play"); await page.wait_for_timeout(300)
        before = await page.evaluate("__trance.mapT")
        await page.evaluate("(() => { const s = document.getElementById('seek'); s.value = 60; s.dispatchEvent(new Event('input')) })()")
        await until("Math.abs(__trance.mapT - 60) < 1", 8000)
        after = await page.evaluate("__trance.mapT")
        check(abs(after - 60) < 1 and abs(before - 60) > 5, f"scrubbing while paused moves the timeline ({before:.1f} → {after:.1f} s)")
        check(not errors, "no page errors" + ("" if not errors else ": " + "; ".join(errors[:3])))
        await browser.close()
    print("\nsmoke test passed" if ok else "\nsmoke test FAILED")
    sys.exit(0 if ok else 1)

asyncio.run(main())
