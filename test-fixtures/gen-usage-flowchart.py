# -*- coding: utf-8 -*-
"""生成「倍轻松 N6 mini 使用流程图」（带中文文字标签，贴近真实说明书）。

节点：开机 → 选择按摩模式 → 佩戴设备 → 开始按摩 → 结束并充电
横向流程图，圆角矩形节点 + 中文标签 + 箭头。
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 900, 240
IMG = "C:/Users/ChenJiang/Desktop/langchain-rag/test-fixtures/使用流程图-倍轻松N6mini.png"

img = Image.new("RGB", (W, H), "#ffffff")
d = ImageDraw.Draw(img)

# 背景圆角框
d.rounded_rectangle([12, 12, W - 12, H - 12], radius=18, fill="#f7f9fc", outline="#dfe5ec", width=2)

try:
    font = ImageFont.truetype("C:/Windows/Fonts/simhei.ttf", 22)
    font_small = ImageFont.truetype("C:/Windows/Fonts/simhei.ttf", 15)
except Exception:
    font = ImageFont.load_default()
    font_small = ImageFont.load_default()

nodes = [
    ("开机", "#cfe8ff", "#2f6fb3"),
    ("选择按摩模式", "#d8f5e0", "#3a8f5f"),
    ("佩戴设备", "#ffe9c9", "#b3742a"),
    ("开始按摩", "#e3d9ff", "#6b4fa0"),
    ("结束并充电", "#ffe0e0", "#c23b3b"),
]
node_w, node_h = 112, 64
gap = 48
start_x = 40
y = (H - node_h) // 2 + 6

x = start_x
for i, (label, fill, stroke) in enumerate(nodes):
    # 圆角矩形节点
    d.rounded_rectangle([x, y, x + node_w, y + node_h], radius=14, fill=fill, outline=stroke, width=3)
    # 文字居中（超 4 字自动分两行，避免节点内截断）
    lines = [label] if len(label) <= 4 else [label[:4], label[4:]]
    text_h = len(lines) * 26
    ty = y + (node_h - text_h) // 2 + 2
    for line in lines:
        tw = d.textlength(line, font=font)
        d.text((x + (node_w - tw) / 2, ty), line, fill="#1f2329", font=font)
        ty += 26
    # 箭头（最后一个节点后不画）
    if i < len(nodes) - 1:
        ax = x + node_w
        ay = y + node_h // 2
        d.line([ax + 4, ay, ax + gap - 8, ay], fill="#5b7d9e", width=4)
        d.polygon([(ax + gap - 14, ay - 8), (ax + gap - 2, ay), (ax + gap - 14, ay + 8)], fill="#5b7d9e")
    x += node_w + gap

# 底部序号（①②③④⑤ 图形符号，加强"无文字也能懂"的可读性）
nums = ["\u2460", "\u2461", "\u2462", "\u2463", "\u2464"]
x = start_x + node_w // 2
for n in nums:
    nw = d.textlength(n, font=font_small)
    d.text((x - nw / 2, y + node_h + 14), n, fill="#8a94a6", font=font_small)
    x += node_w + gap

img.save(IMG)
print("已生成:", IMG)
