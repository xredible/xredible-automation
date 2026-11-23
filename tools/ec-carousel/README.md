# Elevating CHRIST carousel renderer

Outputs 1080×1350 JPEG slides in the final light house style. Every slide uses the bundled canonical horizontal
logo/wordmark lockup and website footer; covers also use the standalone logo. The assets are copied unchanged from
`media:elevating-christ/brand/`, as specified by the owner's 23 November 2026 template. The footer matches
`carousel_v2.py`: 112 px lockup height and a soft navy shadow under the platinum lettering.

The existing `slideText` job format remains compatible. For bilingual content, provide a `slides` array instead:

```json
{"title":"Advent","slides":[
  {"hi":"आगमन: सच्ची आशा\nयशायाह 9:6","en":"Advent: True Hope\nIsaiah 9:6"},
  {"label":"सच्ची आशा","hi":"मसीह में हमारी आशा कभी नहीं डिगती।","en":"Our hope in Christ never wavers."}
]}
```

Hindi is navy; English is smaller soft grey after a short gold rule. A supplied `label` becomes a navy/gold pill.
The last bilingual slide has a white CTA card. Quoted Hindi verses use the existing O.V. check before **any** image
is drawn, with English beneath the verse card. Put verse commentary on separate slides so nothing is omitted.
The supplied fonts may use the Expo package directory structure or the flat `media:ref/fonts/ec-hindi/` structure.
Folded-hands emoji use the bundled licensed Noto glyph, avoiding a missing-glyph box while preserving source text.

```sh
python tools/ec-carousel/render.py --job tools/ec-carousel/samples/bilingual-advent.json \
  --out /tmp/ec-advent --fonts /path/to/full-baloo-2 --ov-dir /path/to/ref/hindi-bible
python -m unittest discover -s tools/ec-carousel -p 'test_*.py'
```

`samples/final-style/` contains before/after contact sheets from the unchanged `plan-vs-gods-plan.json` and a bilingual
contact sheet. These are review artifacts, not published posts. The workflow still requires the owner's normal approvals.
