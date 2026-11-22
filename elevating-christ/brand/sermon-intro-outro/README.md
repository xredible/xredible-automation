# Elevating CHRIST sermon intro + outro (YouTube, 1920x1080, 30 fps)
Made by Claude 22 Nov 2026 (wordmark updated to 3D platinum + gold Raleway the same day): charcoal #1C1C1C, gold, platinum; logo from
elevatingchrist.com (`public/elevating-christ-logo-transparent.webp`); fonts Raleway (wordmark, labels) + Baloo 2 (Hindi).
- `ElevatingCHRIST-sermon-intro.mp4` (6 s): fade in, logo glow reveal, gold rule, "Elevating CHRIST", fade to black.
- `ElevatingCHRIST-sermon-outro.mp4` (20 s): देखने के लिए धन्यवाद / Thank you for watching, परमेश्वर आपको आशीष दे ·
  God bless you, Subscribe line, elevatingchrist.com; right side = two 16:9 "Watch next" slots for YouTube end-screen
  elements (place end screen videos on them, start the end screen at the outro start; it is exactly 20 s).
- `-silent` versions have no audio. Audio in the others is a soft synthesized pad (original, no licence issues).
Re-render: `source/scene.html` (renderAt(t), `#intro` / `#outro`), `python3 source/render.py intro 6 out.mp4`
(needs the fonts + logo next to scene.html: Cinzel woff2 from @fontsource/cinzel, Baloo 2 from ref/fonts/ec-hindi).
