"""Plain-text paragraphs, preserving order and visible words without external I/O."""
import re
from html import unescape
from html.parser import HTMLParser


class VisibleText(HTMLParser):
    BLOCKS = {"p", "div", "section", "article", "h1", "h2", "h3", "h4", "li", "blockquote", "tr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.hidden = 0

    def handle_starttag(self, tag, attrs):
        if tag in {"script", "style", "head"}:
            self.hidden += 1
        if not self.hidden and tag in self.BLOCKS:
            self.parts.append("\n\n")
        if not self.hidden and tag == "br":
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in {"script", "style", "head"}:
            self.hidden = max(0, self.hidden - 1)
        if not self.hidden and tag in self.BLOCKS:
            self.parts.append("\n\n")

    def handle_data(self, data):
        if not self.hidden:
            self.parts.append(data)


def paragraphs(value: str) -> list[str]:
    # Avoid interpreting a plain-text comparison like "5 < 10" as an HTML document.
    if re.search(r"</?[A-Za-z][^>]*>", value):
        parser = VisibleText()
        parser.feed(value)
        parser.close()
        value = "".join(parser.parts)
    value = re.sub(r"\[/?[A-Za-z_][\w-]*(?:\s[^\]\n]*)?\]", "", value)
    value = unescape(value).replace("\r\n", "\n").replace("\r", "\n")
    return [re.sub(r"\s+", " ", part).strip() for part in re.split(r"\n\s*\n", value) if part.strip()]


def first_words(value: str) -> str:
    return " ".join(value.split()[:12])[:140]
