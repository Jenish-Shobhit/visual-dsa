"""Static link and exercise check for the no-build GitHub Pages site."""

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.ids = []
        self.practice_depth = 0
        self.practice_items = 0

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag in {"a", "link"} and values.get("href"):
            self.links.append(values["href"])
        if tag in {"script", "img"} and values.get("src"):
            self.links.append(values["src"])
        if values.get("id"):
            self.ids.append(values["id"])
        if tag == "section" and "problems" in values.get("class", "").split():
            self.practice_depth += 1
        elif self.practice_depth and tag == "section":
            self.practice_depth += 1
        if self.practice_depth and tag == "li":
            self.practice_items += 1

    def handle_endtag(self, tag):
        if tag == "section" and self.practice_depth:
            self.practice_depth -= 1


def main():
    pages = {}
    for path in ROOT.rglob("*.html"):
        if ".git" in path.parts:
            continue
        page = Page()
        page.feed(path.read_text(encoding="utf-8"))
        pages[path.resolve()] = page

    errors = []
    for path, page in pages.items():
        duplicates = sorted({value for value in page.ids if page.ids.count(value) > 1})
        if duplicates:
            errors.append(f"{path.relative_to(ROOT)}: duplicate IDs {duplicates}")
        if path.parent.name == "chapters" and page.practice_items != 3:
            errors.append(f"{path.relative_to(ROOT)}: expected 3 practice prompts, found {page.practice_items}")
        for link in page.links:
            split = urlsplit(link)
            if split.scheme or split.netloc or link.startswith("//"):
                continue
            target = (path.parent / unquote(split.path)).resolve() if split.path else path
            if not target.is_relative_to(ROOT):
                errors.append(f"{path.relative_to(ROOT)}: link escapes site: {link}")
            elif not target.exists():
                errors.append(f"{path.relative_to(ROOT)}: missing {link}")
            elif split.fragment and target in pages and unquote(split.fragment) not in pages[target].ids:
                errors.append(f"{path.relative_to(ROOT)}: missing anchor {link}")

    for error in errors:
        print(error)
    print(f"Checked {len(pages)} HTML pages; {len(errors)} issue(s).")
    raise SystemExit(bool(errors))


if __name__ == "__main__":
    main()
