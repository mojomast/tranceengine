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
        await page.wait_for_timeout(4000)
        st = await page.evaluate("({mapped: __trance.mapped, t: __trance.mapT, shot: __trance.shot, slots: __trance.slots})")
        check(st["mapped"], "the default song has a map")
        check(st["t"] > 2, f"playback advances (t = {st['t']:.1f} s)")
        check(any(s["frames"] > 30 for s in st["slots"]), "a scene is rendering frames")
        for idx, name in [(1, "Slow Burn"), (2, "Breakneck")]:
            await page.evaluate(f"(() => {{ const s = document.getElementById('tracks'); s.value = '{idx}'; s.dispatchEvent(new Event('change')) }})()")
            await page.wait_for_timeout(2500)
            check(await page.evaluate("__trance.mapped && __trance.mapT > 1"), f"{name} maps and plays")
        # Let the plan run past a couple of shots, then seek back into a shot that has keyframes.
        await page.wait_for_timeout(9000)
        await page.evaluate("(() => { const s = document.getElementById('seek'); s.value = 3; s.dispatchEvent(new Event('input')) })()")
        await page.wait_for_timeout(1500)
        tag = await page.evaluate("document.getElementById('vmtag').textContent")
        check("rewound" in tag, f"seeking back shows the rewind ({tag!r})")
        check("snapshot" in tag, "the scene was restored from a VM snapshot")
        await page.click("#play"); await page.wait_for_timeout(300)
        before = await page.evaluate("__trance.mapT")
        await page.evaluate("(() => { const s = document.getElementById('seek'); s.value = 60; s.dispatchEvent(new Event('input')) })()")
        await page.wait_for_timeout(1200)
        after = await page.evaluate("__trance.mapT")
        check(abs(after - 60) < 1 and abs(before - 60) > 5, f"scrubbing while paused moves the timeline ({before:.1f} → {after:.1f} s)")
        check(not errors, "no page errors" + ("" if not errors else ": " + "; ".join(errors[:3])))
        await browser.close()
    print("\nsmoke test passed" if ok else "\nsmoke test FAILED")
    sys.exit(0 if ok else 1)

asyncio.run(main())
