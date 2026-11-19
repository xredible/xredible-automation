# Hindi + English fonts for Elevating CHRIST reels, covers and carousels

**Use only these files for any Elevating CHRIST text that has Hindi.** Baloo 2 (full, with Devanagari), SIL Open Font
License, from `@expo-google-fonts/baloo-2@0.4.2`. Each file has 128 Devanagari characters + Latin.

**Do NOT use `tools/reels/assets/Baloo2-*.ttf` or `lib/printables/assets/Baloo2-*.ttf` (main branch) for Hindi.**
Those are English-only subsets (0 Devanagari characters): Hindi comes out as empty boxes. That happened on the
20 Nov 2026 Emmanuel Decostra testimony reel and cover.

## How to render Hindi correctly
Hindi needs text *shaping* (vowel signs like ि, conjuncts with ्). Pick one:
1. **Subtitles / captions (preferred): ASS via libass**
   `ffmpeg -i in.mp4 -vf "subtitles=subs.ass:fontsdir=ref/fonts/ec-hindi" ...`
   Font names inside the .ass: `Baloo 2 ExtraBold`, `Baloo 2 SemiBold`, `Baloo 2 Bold`, `Baloo 2 Medium`, `Baloo 2`.
   Start from `subtitle-template.ass` (1080x1920: Hindi line white, English translation gold under it).
2. **Cover / title cards drawn as images**: Pillow with Raqm (`python3 -c "from PIL import features; print(features.check('raqm'))"`
   must print True; on Debian / Raspberry Pi: `sudo apt install libraqm0`), or HTML in Chromium/Playwright with
   `@font-face` pointing at these files.
3. Do not use ffmpeg `drawtext` for Hindi on ffmpeg older than 6.1: it does not shape Devanagari.

## Check before saving (required)
Extract the cover and 3 frames with Hindi on screen and look at them: no boxes, vowel signs in the right place.
`test-frame.jpg` shows the expected result. EC rules still apply: on every reel/short the Hindi line as spoken
(Devanagari) with the English translation under it; Bible verses exact Hindi O.V. + KJV; no city names; credit
"Brother CM" only on his own work.
