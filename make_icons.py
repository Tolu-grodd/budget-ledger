from PIL import Image, ImageDraw

NAVY = (27, 42, 74, 255)
GOLD = (201, 162, 39, 255)
CREAM = (250, 247, 240, 255)

def draw_mark(draw, cx, cy, s):
    w, h = s * 0.62, s * 0.44
    x0, y0 = cx - w / 2, cy - h / 2
    x1, y1 = cx + w / 2, cy + h / 2
    r = s * 0.07
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, outline=CREAM, width=max(2, int(s * 0.045)))
    ly = y0 + h * 0.36
    draw.line([x0 + w * 0.16, ly, x1 - w * 0.16, ly], fill=CREAM, width=max(2, int(s * 0.03)))
    coin_r = s * 0.14
    coin_cx, coin_cy = x1 - coin_r * 0.2, y0 + coin_r * 0.2
    draw.ellipse([coin_cx - coin_r, coin_cy - coin_r, coin_cx + coin_r, coin_cy + coin_r], fill=GOLD)

def make_icon(size, maskable=False, path="icon.png"):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    if maskable:
        draw.rectangle([0, 0, size, size], fill=NAVY)
        draw_mark(draw, size / 2, size / 2, size * 0.62)
    else:
        pad = size * 0.08
        draw.rounded_rectangle([pad, pad, size - pad, size - pad], radius=size * 0.22, fill=NAVY)
        draw_mark(draw, size / 2, size / 2, size * 0.84)
    img.save(path)

make_icon(192, False, "public/icon-192.png")
make_icon(512, False, "public/icon-512.png")
make_icon(512, True, "public/icon-maskable.png")
print("icons written")
