#!/usr/bin/env python3
"""Write English Chrome Web Store visuals from the existing branded captures.

Does not invent product results. Host-site chrome on AliExpress captures stays
as photographed. Only Nope-authored caption panels, the popup illustration,
the supported-surfaces card, and the small promo slogan are rewritten.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "store"
OUT = SRC / "en"

PAPER = (245, 240, 227)
PAPER_CARD = (249, 246, 239)
INK = (23, 27, 47)
INK_SOFT = (17, 27, 53)
ORANGE = (239, 141, 50)
ORANGE_DEEP = (168, 68, 0)
RED = (214, 54, 50)
WHITE = (255, 254, 249)
NAVY = (17, 27, 53)
COBALT = (33, 73, 170)

FONT_REG = "/usr/share/fonts/truetype/macos/Inter-Regular.ttf"
FONT_MED = "/usr/share/fonts/truetype/macos/Inter-Medium.ttf"
FONT_SEMI = "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/macos/Inter-Bold.ttf"


def font(path, size):
    return ImageFont.truetype(path, size)


def rounded(draw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_text(draw, xy, text, face, fill, anchor="lt"):
    draw.text(xy, text, font=face, fill=fill, anchor=anchor)


def caption_card(draw, box, kicker, title, lines=None):
    rounded(draw, box, 18, PAPER_CARD, outline=(233, 226, 210), width=2)
    x0, y0, x1, y1 = box
    draw_text(draw, (x0 + 22, y0 + 18), kicker, font(FONT_SEMI, 16), ORANGE_DEEP)
    draw_text(draw, (x0 + 22, y0 + 48), title, font(FONT_BOLD, 28), INK)
    if lines:
        y = y0 + 92
        for line in lines:
            draw_text(draw, (x0 + 22, y), line, font(FONT_REG, 16), INK_SOFT)
            y += 24


def save_rgb(image, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(path, "PNG")
    print("wrote", path)


def render_screenshot_01():
    im = Image.open(SRC / "screenshot-01-placeholder.png").convert("RGB")
    draw = ImageDraw.Draw(im)
    rounded(draw, (28, 596, 470, 772), 18, PAPER_CARD, outline=(233, 226, 210), width=2)
    draw_text(draw, (50, 616), "NOPE · DEFAULT MODE", font(FONT_SEMI, 15), ORANGE_DEEP)
    draw_text(draw, (50, 646), "Replace unwanted stores", font(FONT_BOLD, 26), INK)
    draw_text(draw, (50, 682), "with the mascot", font(FONT_BOLD, 26), INK)
    save_rgb(im, OUT / "screenshot-01-placeholder.png")


def render_screenshot_02():
    im = Image.open(SRC / "screenshot-02-block-source.png").convert("RGB")
    draw = ImageDraw.Draw(im)
    rounded(draw, (28, 28, 430, 168), 18, PAPER_CARD, outline=(233, 226, 210), width=2)
    draw_text(draw, (50, 48), "NOPE · ONE CLICK", font(FONT_SEMI, 15), ORANGE_DEEP)
    draw_text(draw, (50, 80), "Block a store from", font(FONT_BOLD, 26), INK)
    draw_text(draw, (50, 114), "the product page", font(FONT_BOLD, 26), INK)

    rounded(draw, (780, 596, 1252, 772), 18, PAPER_CARD, outline=(233, 226, 210), width=2)
    draw_text(draw, (802, 618), "Control added to the live page", font(FONT_SEMI, 18), INK)
    draw_text(draw, (802, 656), "The injected action uses the browser", font(FONT_REG, 16), INK_SOFT)
    draw_text(draw, (802, 682), "language. This capture was taken on the", font(FONT_REG, 16), INK_SOFT)
    draw_text(draw, (802, 708), "Japanese AliExpress page.", font(FONT_REG, 16), INK_SOFT)
    save_rgb(im, OUT / "screenshot-02-block-source.png")


def render_screenshot_03():
    im = Image.new("RGB", (1280, 800), PAPER)
    draw = ImageDraw.Draw(im)

    # popup card
    rounded(draw, (72, 70, 430, 730), 16, WHITE, outline=(239, 229, 210), width=2)
    draw_text(draw, (96, 94), "Nope", font(FONT_BOLD, 22), INK)
    rounded(draw, (96, 136, 406, 230), 8, WHITE, outline=(251, 229, 210), width=1)
    draw_text(draw, (110, 148), "Blocked item display", font(FONT_SEMI, 12), ORANGE_DEEP)
    draw_text(draw, (110, 176), "●  Replace with placeholder", font(FONT_REG, 14), INK)
    draw_text(draw, (110, 200), "○  Hide and collapse", font(FONT_REG, 14), INK)

    draw_text(draw, (96, 252), "BLOCKED", font(FONT_SEMI, 11), ORANGE_DEEP)
    rounded(draw, (96, 274, 406, 318), 6, (251, 229, 210))
    draw_text(draw, (110, 288), "AliExpress   (1)", font(FONT_SEMI, 13), ORANGE_DEEP)
    rounded(draw, (96, 318, 406, 368), 0, WHITE)
    draw_text(draw, (110, 336), "Bestselling Makeup Store", font(FONT_REG, 13), INK)
    rounded(draw, (318, 330, 394, 354), 4, WHITE, outline=ORANGE_DEEP, width=1)
    draw_text(draw, (356, 342), "Remove", font(FONT_REG, 11), ORANGE_DEEP, anchor="mm")

    draw_text(draw, (96, 392), "KEYWORD BLOCK", font(FONT_SEMI, 11), ORANGE_DEEP)
    rounded(draw, (96, 414, 406, 446), 6, WHITE, outline=(251, 229, 210), width=1)
    draw_text(draw, (110, 430), "Yahoo News", font(FONT_REG, 13), INK)
    rounded(draw, (96, 458, 318, 490), 6, WHITE, outline=(251, 229, 210), width=1)
    draw_text(draw, (110, 474), "Keyword", font(FONT_REG, 13), (160, 160, 160))
    rounded(draw, (328, 458, 406, 490), 6, (198, 83, 0))
    draw_text(draw, (367, 474), "Add", font(FONT_SEMI, 13), WHITE, anchor="mm")
    draw_text(draw, (110, 516), "generative AI", font(FONT_REG, 13), INK)
    rounded(draw, (318, 504, 394, 528), 4, WHITE, outline=ORANGE_DEEP, width=1)
    draw_text(draw, (356, 516), "Remove", font(FONT_REG, 11), ORANGE_DEEP, anchor="mm")

    rounded(draw, (96, 560, 230, 592), 6, WHITE, outline=ORANGE_DEEP, width=1)
    draw_text(draw, (163, 576), "Clear cache", font(FONT_REG, 12), ORANGE_DEEP, anchor="mm")
    draw_text(draw, (406, 700), "kitepon.dev", font(FONT_SEMI, 12), COBALT, anchor="rb")

    draw_text(draw, (520, 180), "NOPE · MANAGE", font(FONT_SEMI, 16), ORANGE_DEEP)
    draw_text(draw, (520, 216), "Manage blocks", font(FONT_BOLD, 40), INK)
    draw_text(draw, (520, 268), "in one popup", font(FONT_BOLD, 40), INK)

    rows = [
        ("Display mode", "Placeholder / collapse"),
        ("Sources", "Review and remove by site"),
        ("Keywords", "Add and remove"),
    ]
    y = 360
    for label, value in rows:
        rounded(draw, (520, y, 1180, y + 72), 10, WHITE)
        draw_text(draw, (544, y + 36), label, font(FONT_SEMI, 16), ORANGE_DEEP, anchor="lm")
        draw_text(draw, (780, y + 36), value, font(FONT_REG, 18), INK, anchor="lm")
        y += 88
    save_rgb(im, OUT / "screenshot-03-manage.png")


def render_screenshot_04():
    im = Image.open(SRC / "screenshot-04-display-modes.png").convert("RGB")
    draw = ImageDraw.Draw(im)
    rounded(draw, (20, 16, 820, 168), 0, PAPER)
    draw_text(draw, (40, 36), "NOPE · DISPLAY MODE", font(FONT_SEMI, 15), ORANGE_DEEP)
    draw_text(draw, (40, 68), "Switch the view whenever you want", font(FONT_BOLD, 28), INK)

    # Original navy comparison headers occupy y≈175–266.
    rounded(draw, (28, 175, 628, 266), 0, NAVY)
    draw_text(draw, (52, 196), "Replace", font(FONT_SEMI, 22), ORANGE)
    draw_text(draw, (52, 230), "See where the blocked cards were", font(FONT_REG, 16), WHITE)

    rounded(draw, (652, 175, 1252, 266), 0, NAVY)
    draw_text(draw, (676, 196), "Hide and collapse", font(FONT_SEMI, 22), ORANGE)
    draw_text(draw, (676, 230), "Remove them and pack the list", font(FONT_REG, 16), WHITE)
    save_rgb(im, OUT / "screenshot-04-display-modes.png")


def render_screenshot_05():
    im = Image.new("RGB", (1280, 800), PAPER)
    draw = ImageDraw.Draw(im)
    rounded(draw, (0, 0, 360, 800), 0, NAVY)
    icon = Image.open(SRC / "store-icon-128.png").convert("RGBA").resize((160, 160))
    im.paste(icon, (100, 72), icon)
    draw = ImageDraw.Draw(im)
    draw_text(draw, (40, 268), "SUPPORTED SURFACES", font(FONT_SEMI, 14), (168, 196, 230))
    draw_text(draw, (40, 304), "7 service", font(FONT_BOLD, 36), WHITE)
    draw_text(draw, (40, 350), "groups", font(FONT_BOLD, 36), WHITE)
    draw_text(draw, (40, 410), "8 surfaces", font(FONT_BOLD, 36), ORANGE)

    chips = [
        (400, 80, 640, 150, "AliExpress"),
        (660, 80, 900, 150, "Rakuten Ichiba"),
        (920, 80, 1240, 150, "Yahoo! Shopping"),
        (400, 170, 640, 240, "Yahoo Auctions"),
        (660, 170, 900, 240, "Amazon.co.jp"),
        (920, 170, 1240, 240, "YouTube"),
        (400, 260, 1240, 330, "Yahoo News / Yahoo! JAPAN"),
    ]
    for x0, y0, x1, y1, label in chips:
        rounded(draw, (x0, y0, x1, y1), 14, WHITE)
        draw_text(draw, ((x0 + x1) / 2, (y0 + y1) / 2), label, font(FONT_SEMI, 18), INK, anchor="mm")

    rounded(draw, (400, 400, 800, 520), 16, RED)
    draw_text(draw, (600, 444), "No Nope account", font(FONT_BOLD, 22), WHITE, anchor="mm")
    draw_text(draw, (600, 478), "required", font(FONT_BOLD, 22), WHITE, anchor="mm")
    rounded(draw, (840, 400, 1240, 520), 16, COBALT)
    draw_text(draw, (1040, 444), "Not sent to a", font(FONT_BOLD, 22), WHITE, anchor="mm")
    draw_text(draw, (1040, 478), "developer server", font(FONT_BOLD, 22), WHITE, anchor="mm")

    draw_text(
        draw,
        (400, 580),
        "Source-resolution requests stay on the site you are already viewing.",
        font(FONT_REG, 16),
        (90, 90, 100),
    )
    save_rgb(im, OUT / "screenshot-05-supported-and-private.png")


def render_small_promo():
    im = Image.open(SRC / "small-promo-440x280.png").convert("RGB")
    draw = ImageDraw.Draw(im)
    # Cover the Japanese slogan on the red panel without touching the mascot.
    rounded(draw, (248, 70, 440, 230), 0, RED)
    draw_text(draw, (268, 96), "Nope", font(FONT_BOLD, 42), WHITE)
    draw_text(draw, (268, 150), "Hide what you", font(FONT_SEMI, 16), WHITE)
    draw_text(draw, (268, 174), "don't want", font(FONT_SEMI, 16), WHITE)
    draw_text(draw, (268, 198), "to see", font(FONT_SEMI, 16), WHITE)
    save_rgb(im, OUT / "small-promo-440x280.png")


def main():
    render_screenshot_01()
    render_screenshot_02()
    render_screenshot_03()
    render_screenshot_04()
    render_screenshot_05()
    render_small_promo()


if __name__ == "__main__":
    main()
