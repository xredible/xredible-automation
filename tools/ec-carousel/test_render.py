"""Content safety regressions; no network or external fonts required."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).parent
spec = importlib.util.spec_from_file_location('ec_carousel', HERE / 'render.py')
ec = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ec)


class ContentSafety(unittest.TestCase):
    def test_bad_bilingual_verse_rejects_entire_job_before_images(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'john-3.htm').write_text('<span class="verse" id="16">16</span> परमेश्वर ने जगत से प्रेम रखा।')
            job = {'title': 'test', 'slides': [
                {'hi': 'सच्ची आशा', 'en': 'True hope'},
                {'hi': '“गढ़ा हुआ वचन” — यूहन्ना 3:16', 'en': 'Invented verse'}]}
            (root / 'job.json').write_text(json.dumps(job))
            result = subprocess.run([sys.executable, str(HERE / 'render.py'), '--job', str(root / 'job.json'),
                                     '--out', str(root / 'out'), '--ov-dir', tmp, '--fonts', '/missing-fonts'],
                                    capture_output=True, text=True)
            self.assertEqual(result.returncode, 2)
            self.assertIn('does not match the O.V.', json.loads(result.stdout)['error'])
            self.assertEqual(list((root / 'out').glob('*.jpg')), [])

    def test_bilingual_preserves_pipe_and_newline_in_source(self):
        hi, en = 'आगमन\nसच्ची आशा', 'Advent | True hope'
        raw, parsed = ec.job_slides({'slides': [{'hi': hi, 'en': en}]})[0]
        self.assertEqual((raw, parsed['en']), (hi, en))
        from PIL import Image, ImageDraw, ImageFont
        draw = ImageDraw.Draw(Image.new('RGB', (100, 100)))
        self.assertEqual(ec.wrap(draw, 'one\ntwo', ImageFont.load_default(), 100), ['one two'])

    def test_invalid_bilingual_field_is_content_error(self):
        with self.assertRaises(ec.ContentError):
            ec.job_slides({'slides': [{'hi': 'आशा', 'en': 123}]})

    def test_verse_commentary_cannot_be_silently_dropped(self):
        with self.assertRaises(ec.ContentError):
            ec.job_slides({'slides': [{'hi': 'भूमिका: “वचन” — यूहन्ना 3:16', 'en': 'Commentary and verse'}]})


if __name__ == '__main__':
    unittest.main()
