"""Inspect the actual Chromium PDF, not print-CSS strings (pypdf==6.15.0)."""

import json
import re
import sys
import unicodedata
from pathlib import Path
from urllib.parse import urlsplit

from pypdf import PdfReader
from pypdf.generic import ContentStream

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "dist" / "commons-collective.pdf"
MANIFEST = Path(f"{PDF}.checks.json")
FOOTER = "Commons Collective | Ethical Tech CoLab"
HEADER = "Commons Collective"


def normalized(text):
    return "".join(
        char for char in unicodedata.normalize("NFKD", text).casefold()
        if char.isalnum()
    )


def require(condition, message):
    if not condition:
        raise AssertionError(message)


def inspect():
    reader = PdfReader(PDF)
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    total = len(reader.pages)
    require(total > 2, "Expected cover, abstract, and research pages.")
    page_spans = []
    body_text = []
    text_colors = set()
    image_objects = set()
    image_placements = []
    heading_pages = {}
    uri_links = 0

    for index, page in enumerate(reader.pages, 1):
        width, height = float(page.mediabox.width), float(page.mediabox.height)
        require(abs(width - 595) < 2 and abs(height - 842) < 2, f"Page {index} is not A4.")
        for annotation in page.get("/Annots", []):
            action = annotation.get_object().get("/A")
            if action and action.get("/URI"):
                target = urlsplit(str(action["/URI"]))
                require(target.scheme in {"https", "http", "mailto"}
                        and target.hostname not in {"127.0.0.1", "localhost", "::1"},
                        f"PDF contains an invalid or preview-only hyperlink on page {index}.")
                uri_links += 1
        spans = []

        def visit(text, cm, tm, _font, size):
            if text.strip():
                spans.append({
                    "text": text.strip(),
                    "x": tm[4] * cm[0] + tm[5] * cm[2] + cm[4],
                    "y": tm[4] * cm[1] + tm[5] * cm[3] + cm[5],
                    "size": size * abs(cm[0]),
                })

        def visit_operator(operator, args, cm, _tm):
            if operator != b"Do":
                return
            obj = page["/Resources"].get("/XObject", {}).get(args[0])
            obj = obj.get_object() if obj else None
            if not obj or obj.get("/Subtype") != "/Image":
                return
            corners = [
                (cm[0] * x + cm[2] * y + cm[4], cm[1] * x + cm[3] * y + cm[5])
                for x, y in ((0, 0), (1, 0), (0, 1), (1, 1))
            ]
            bounds = (
                min(x for x, _ in corners), min(y for _, y in corners),
                max(x for x, _ in corners), max(y for _, y in corners),
            )
            require(bounds[0] >= 47 and bounds[2] <= width - 47
                    and bounds[1] >= 55 and bounds[3] <= height - 50,
                    f"Image crosses the print content/margin boundary on page {index}: {bounds}")
            image_placements.append({"page": index, "bounds": bounds})

        text = page.extract_text(visitor_text=visit, visitor_operand_before=visit_operator)
        page_spans.append(spans)
        margin_bottom = [span for span in spans if 0 < span["y"] < 40]
        footer_left = " ".join(span["text"] for span in margin_bottom if span["x"] < width / 2)
        footer_right = "".join(span["text"] for span in margin_bottom if span["x"] > width / 2)
        require(footer_left == FOOTER, f"Wrong left footer on page {index}: {footer_left!r}")
        require(footer_right == f"{index}/{total}", f"Wrong page counter on page {index}: {footer_right!r}")
        margin_top = [span["text"] for span in spans if height - 43 < span["y"] < height]
        require(margin_top == ([] if index == 1 else [HEADER]),
                f"Wrong running header on page {index}: {margin_top!r}")

        # Remove only the first margin occurrences; paragraphs may continue across pages.
        # Visitor coordinates for some Chromium table text are unreliable in pypdf.
        clean = text.replace(FOOTER, "", 1).replace(f"{index}/{total}", "", 1)
        if index > 1:
            clean = clean.replace(HEADER, "", 1)
        body_text.append(clean)

        large_text = normalized(" ".join(span["text"] for span in spans if span["size"] >= 19))
        for heading in manifest["headings"]:
            if normalized(heading["text"]) == large_text:
                require(heading["id"] not in heading_pages, f"Duplicate heading: {heading['text']}")
                heading_pages[heading["id"]] = index
                first_heading = next(span for span in spans if span["size"] >= 19)
                require(height - 90 < first_heading["y"] < height - 45,
                        f"Heading is not at page start: {heading['text']} (page {index})")
                require(normalized(clean).startswith(normalized(heading["text"])),
                        f"Content precedes heading on page {index}: {heading['text']}")

        color = (0.0, 0.0, 0.0)
        stack = []
        for args, operator in ContentStream(page.get_contents(), reader).operations:
            if operator == b"q":
                stack.append(color)
            elif operator == b"Q":
                color = stack.pop() if stack else (0.0, 0.0, 0.0)
            elif operator == b"rg":
                color = tuple(round(float(value), 3) for value in args)
            elif operator == b"g":
                color = (round(float(args[0]), 3),) * 3
            elif operator in (b"Tj", b"TJ", b"'", b'"'):
                text_colors.add(color)
        for reference in page["/Resources"].get("/XObject", {}).values():
            if reference.get_object().get("/Subtype") == "/Image":
                image_objects.add(reference.idnum)

    expected_headings = manifest["headings"]
    numbered = [heading for heading in expected_headings if re.match(r"^\d+\.", heading["text"])]
    require(numbered, "No numbered report sections found.")
    require(len(heading_pages) == len(expected_headings),
            f"Missing page-start headings: {[h['text'] for h in expected_headings if h['id'] not in heading_pages]}")
    require(heading_pages.get("abstract") == 2, "Abstract must start on page 2.")
    require(len(set(heading_pages.values())) == len(expected_headings), "Sections share a starting page.")
    sequence = [heading_pages[heading["id"]] for heading in expected_headings]
    require(sequence == sorted(sequence), "Report headings are out of order.")
    require("abstract" not in normalized(body_text[0]), "Abstract leaked onto the cover.")

    combined = normalized("".join(body_text))
    missing_text = [text for text in manifest["text"] if normalized(text) not in combined]
    require(not missing_text, f"Missing report/source text: {[text[:120] for text in missing_text[:8]]}")
    for source_id in manifest["sourceIds"]:
        require(normalized(source_id.removeprefix("ref-")) in combined, f"Source missing: {source_id}")

    expected_colors = {
        "cover lime": (0.784, 0.941, 0.294),
        "print green accent": (0.255, 0.380, 0.035),
        "violet source/header": (0.380, 0.255, 0.604),
    }
    for name, expected in expected_colors.items():
        require(any(all(abs(a - b) < 0.005 for a, b in zip(color, expected)) for color in text_colors),
                f"{name} text color missing; PDF may have been monochromized.")
    require(all(image["width"] > 0 and image["height"] > 0 for image in manifest["images"]),
            "An HTML image did not load before export.")
    raster_sources = {image["src"] for image in manifest["images"]
                      if Path(image["src"]).suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}}
    require(len(image_objects) >= len(raster_sources),
            f"Expected at least {len(raster_sources)} embedded raster images, got {len(image_objects)}.")
    require(len(image_placements) >= len(raster_sources),
            "Not every raster image has a verified visible placement inside the page bounds.")
    require(PDF.stat().st_mtime >= (ROOT / "dist" / "index.html").stat().st_mtime,
            "PDF predates the built report; regenerate it after the site build.")
    require(manifest.get("canonicalUrl", "").startswith("https://ethical-tech-colab.github.io/commons-collective/"),
            "PDF canonical publication URL is missing.")
    require(manifest.get("rewrittenProjectLinks", 0) > 0, "Project PDF links were not rewritten to the public site.")
    summary = {
        "pages": total,
        "abstractPage": heading_pages["abstract"],
        "numberedSectionsStartingFreshPages": len(numbered),
        "footerPagesVerified": total,
        "coverHeaderAbsent": True,
        "publicUriLinksVerified": uri_links,
        "preservedTextItems": len(manifest["text"]),
        "sourceCards": len(manifest["sourceIds"]),
        "loadedImages": len(manifest["images"]),
        "embeddedRasterImages": len(image_objects),
        "rasterImagePlacementsWithinMargins": len(image_placements),
        "semanticTextColorsVerified": list(expected_colors),
        "sectionPages": {heading["text"]: heading_pages[heading["id"]] for heading in expected_headings},
    }
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    try:
        inspect()
    except (AssertionError, FileNotFoundError) as error:
        print(f"PDF validation failed: {error}", file=sys.stderr)
        sys.exit(1)
