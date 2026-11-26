# FIREpath marketing

- `SCRIPTS.md`: 10 short-video scripts (Reels/Shorts), captions, hashtags and a posting plan.
- `video/`: the video maker. It turns the specs in `video/videos.mjs` into 1080×1920 MP4s plus a shorter `-ad` cut for paid ads.

## Make videos

```bash
cd marketing/video
npm install          # first time only
npm run still        # quick check: one PNG per scene in out/stills
npm run render       # all videos → out/*.mp4 (about 1–3 minutes per video)
npm run render -- 02 # only videos whose id contains "02"
```

To add a video, copy one entry in `videos.mjs` and change the text. Calculate amounts with `sip()` and show them with `inr()`; don't type numbers by hand. Scene types: `hook`, `text` (optional `eyebrow`, `big`), `compare`, `bars`, `list`, `big`, `cta`. Mark scenes with `ad: true` to include them in the short ad cut.

The videos have a silent soundtrack on purpose. Add music or a voiceover in Instagram, YouTube or CapCut. This folder is separate from the website and doesn't affect the app build.
