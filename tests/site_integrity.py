"""Static integrity check for the no-build GitHub Pages site.

Checks every HTML page for broken local links, missing anchors and duplicate IDs,
and checks every published lesson against the curriculum registry:
- each lesson listed as live in js/curriculum.js has a page, and every page is listed as live;
- each lesson has at least three practice prompts (<section class="practice"> list items);
- each lesson declares its id on <body data-lesson="...">.
"""

import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {".git", "node_modules", "Computer-Science"}


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self.ids = []
        self.body_attrs = {}
        self.practice_depth = 0
        self.practice_items = 0

    def handle_starttag(self, tag, attrs):
        values = dict(attrs)
        if tag in {"a", "link"} and values.get("href"):
            self.links.append(values["href"])
        if tag in {"script", "img", "source"} and values.get("src"):
            self.links.append(values["src"])
        if values.get("id"):
            self.ids.append(values["id"])
        if tag == "body":
            self.body_attrs = values
        classes = (values.get("class") or "").split()
        if tag in {"section", "div", "ol", "ul"} and ("practice" in classes or "problems" in classes):
            self.practice_depth += 1
        elif self.practice_depth and tag in {"section", "div", "ol", "ul"}:
            self.practice_depth += 1
        if self.practice_depth and tag == "li":
            self.practice_items += 1

    def handle_endtag(self, tag):
        if tag in {"section", "div", "ol", "ul"} and self.practice_depth:
            self.practice_depth -= 1


def live_lessons():
    source = (ROOT / "js" / "curriculum.js").read_text(encoding="utf-8")
    match = re.search(r"api\.markLive\(\[(.*?)\]\)", source, re.S)
    return set(re.findall(r"'([^']+)'", match.group(1))) if match else set()


def main():
    pages = {}
    for path in ROOT.rglob("*.html"):
        if SKIP_DIRS.intersection(path.relative_to(ROOT).parts):
            continue
        page = Page()
        page.feed(path.read_text(encoding="utf-8"))
        pages[path.resolve()] = page

    errors = []
    for path, page in pages.items():
        rel = path.relative_to(ROOT)
        duplicates = sorted({value for value in page.ids if page.ids.count(value) > 1})
        if duplicates:
            errors.append(f"{rel}: duplicate IDs {duplicates}")
        for link in page.links:
            split = urlsplit(link)
            if split.scheme or split.netloc or link.startswith("//") or link.startswith("#") and not split.fragment:
                continue
            target = (path.parent / unquote(split.path)).resolve() if split.path else path
            if not target.is_relative_to(ROOT):
                errors.append(f"{rel}: link escapes site: {link}")
            elif not target.exists():
                errors.append(f"{rel}: missing {link}")
            elif split.fragment and target in pages and unquote(split.fragment) not in pages[target].ids:
                errors.append(f"{rel}: missing anchor {link}")

    live = live_lessons()
    lesson_pages = {p.stem: pages[p.resolve()] for p in (ROOT / "lessons").glob("*.html") if not p.stem.startswith("_")} if (ROOT / "lessons").exists() else {}
    for lesson_id, page in lesson_pages.items():
        if lesson_id not in live:
            errors.append(f"lessons/{lesson_id}.html exists but is not marked live in js/curriculum.js")
        if page.body_attrs.get("data-lesson") != lesson_id:
            errors.append(f"lessons/{lesson_id}.html: <body data-lesson> should be '{lesson_id}'")
        if page.practice_items < 3:
            errors.append(f"lessons/{lesson_id}.html: expected at least 3 practice prompts, found {page.practice_items}")
    for lesson_id in sorted(live - set(lesson_pages)):
        errors.append(f"js/curriculum.js marks '{lesson_id}' live but lessons/{lesson_id}.html is missing")

    for error in errors:
        print(error)
    print(f"Checked {len(pages)} HTML pages and {len(lesson_pages)} lessons; {len(errors)} issue(s).")
    raise SystemExit(bool(errors))


if __name__ == "__main__":
    main()
