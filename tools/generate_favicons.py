from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "img" / "favicons"
OUT.mkdir(parents=True, exist_ok=True)
SIZES = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def font(size: int, bold: bool = True):
    name = "segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / name), size)


def save(image: Image.Image, name: str):
    image.convert("RGBA").save(OUT / f"{name}.ico", format="ICO", sizes=SIZES)


def app_icon(source: str, name: str):
    image = Image.open(ROOT / source).convert("RGBA")
    side = min(image.size)
    left = (image.width - side) // 2
    top = (image.height - side) // 2
    image = image.crop((left, top, left + side, top + side)).resize((256, 256), Image.Resampling.LANCZOS)
    save(image, name)


def monogram(name: str, label: str, bg: str, fg: str, accent: str | None = None):
    image = Image.new("RGBA", (256, 256), bg)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((8, 8, 248, 248), radius=54, outline=accent or fg, width=7)
    if accent:
        draw.rectangle((36, 38, 48, 218), fill=accent)
    face = font(92 if len(label) <= 2 else 70)
    box = draw.textbbox((0, 0), label, font=face)
    draw.text(((256 - (box[2] - box[0])) / 2, (256 - (box[3] - box[1])) / 2 - box[1]), label, font=face, fill=fg)
    save(image, name)


def tingjian():
    image = Image.new("RGBA", (256, 256), "#0b0906")
    draw = ImageDraw.Draw(image)
    gold, orange = "#d5b278", "#ff6a2a"
    draw.ellipse((60, 60, 196, 196), outline=gold, width=8)
    draw.line((70, 128, 186, 128), fill=gold, width=6)
    draw.arc((98, 60, 158, 196), 90, 270, fill=gold, width=5)
    draw.arc((98, 60, 158, 196), 270, 90, fill=gold, width=5)
    draw.rectangle((121, 46, 135, 92), fill=orange)
    draw.rounded_rectangle((115, 116, 141, 142), radius=4, fill=orange)
    save(image, "tingjian")


def book():
    image = Image.new("RGBA", (256, 256), "#f2eadb")
    draw = ImageDraw.Draw(image)
    ink, red = "#17212b", "#b83b34"
    draw.rounded_rectangle((26, 26, 230, 230), radius=45, fill=ink)
    draw.polygon(((49, 72), (121, 84), (121, 194), (49, 180)), fill="#fffaf0")
    draw.polygon(((135, 84), (207, 72), (207, 180), (135, 194)), fill="#fffaf0")
    draw.line((128, 82, 128, 198), fill=red, width=8)
    save(image, "literature")


def detective():
    image = Image.new("RGBA", (256, 256), "#14100d")
    draw = ImageDraw.Draw(image)
    gold, paper = "#c99b4a", "#f2e7d2"
    draw.rounded_rectangle((10, 10, 246, 246), radius=52, outline=gold, width=7)
    draw.ellipse((56, 48, 166, 158), outline=paper, width=18)
    draw.line((151, 145, 210, 207), fill=gold, width=24)
    draw.ellipse((91, 83, 131, 123), fill=gold)
    save(image, "detective")


app_icon("img/quliu-icon.png", "quliu")
app_icon("img/sufei/icon.webp", "sufei")
app_icon("img/shiying/icon.png", "shiying")
app_icon("img/yosu/icon.png", "yosu")
app_icon("img/paperstudio/icon.png", "paperstudio")
tingjian()
book()
detective()
monogram("index", "M24", "#f2eee6", "#191816", "#c84b31")
monogram("notes", "N", "#f5f0e7", "#24211d", "#bd573d")
monogram("resume", "CV", "#1c2732", "#f5ead7", "#d6a84e")
monogram("homepage-preview", "M", "#efe9dc", "#22201c", "#5d7d6c")
monogram("admin-notes", "A", "#20242a", "#f3eee5", "#7e9aac")
