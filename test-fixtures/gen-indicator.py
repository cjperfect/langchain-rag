# -*- coding: utf-8 -*-
"""生成「充电指示灯状态图」（纯图形+颜色、无文字）。

三列状态：绿圆+满格电池=充满 / 红圆+半格电池+闪电=充电中 / 橙圆+感叹号+闪电=故障。
"""
from PIL import Image, ImageDraw

W, H = 560, 300
OUT = "C:/Users/ChenJiang/Desktop/langchain-rag/test-fixtures/充电指示灯状态图示例-无文本.png"

img = Image.new("RGB", (W, H), "#ffffff")
d = ImageDraw.Draw(img)
d.rounded_rectangle([15, 15, W - 15, H - 15], radius=16, fill="#f7f9fc", outline="#dfe5ec", width=2)


def battery(x, y, fill, stroke, level=1.0, flash=False, alert=False):
    """画电池图标：外框 + 正极 + 内部填充（level 0~1）+ 可选闪电/感叹号"""
    d.rounded_rectangle([x, y, x + 60, y + 34], radius=5, outline=stroke, width=4)
    d.rounded_rectangle([x + 60, y + 9, x + 68, y + 25], radius=2, fill=stroke)
    inner_w = 52 * level
    if inner_w > 0:
        d.rounded_rectangle([x + 4, y + 4, x + 4 + inner_w, y + 30], radius=3, fill=fill)
    if flash:
        d.polygon(
            [(x + 30, y - 8), (x + 20, y + 12), (x + 28, y + 12), (x + 22, y + 24), (x + 38, y + 8), (x + 28, y + 8)],
            fill="#ffe066", outline=stroke, width=1,
        )
    if alert:
        d.ellipse([x + 27, y + 9, x + 33, y + 15], fill=stroke)
        d.rounded_rectangle([x + 29.5, y + 18, x + 30.5, y + 24], radius=1, fill=stroke)


# 状态一：绿色 充满
cx, cy = 110, 90
d.ellipse([cx - 34, cy - 34, cx + 34, cy + 34], fill="#3ddc84", outline="#1f9d57", width=4)
d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill="#ffffff", outline=None)
battery(80, 170, "#3ddc84", "#3aa76d", level=1.0)

# 状态二：红色 充电中
cx, cy = 280, 90
d.ellipse([cx - 34, cy - 34, cx + 34, cy + 34], fill="#ff5b5b", outline="#c23b3b", width=4)
d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill="#ffffff", outline=None)
battery(250, 170, "#ff5b5b", "#c04a4a", level=0.5, flash=True)

# 状态三：橙色 故障
cx, cy = 450, 90
d.ellipse([cx - 34, cy - 34, cx + 34, cy + 34], fill="#ffaa33", outline="#b3742a", width=4)
d.ellipse([cx - 14, cy - 14, cx + 14, cy + 14], fill="#ffffff", outline=None)
d.polygon(
    [(450, 30), (436, 52), (446, 52), (438, 70), (464, 46), (452, 46), (462, 30)],
    fill="#b3742a",
)
battery(420, 170, "#ffd9a3", "#b3742a", level=1.0, alert=True)

# 分隔虚线
for yy in range(40, 260, 12):
    d.line([196, yy, 196, yy + 6], fill="#dfe5ec", width=2)
    d.line([356, yy, 356, yy + 6], fill="#dfe5ec", width=2)

img.save(OUT)
print("已生成:", OUT)
