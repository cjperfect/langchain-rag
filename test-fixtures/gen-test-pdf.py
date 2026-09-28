# -*- coding: utf-8 -*-
"""
生成 PDF 解析管线测试文档（表格 + 流程图/状态图）。

覆盖链路：
  1. 中文文本层页（Unstructured 版面分析：Title/NarrativeText）
  2. 表格（Unstructured Table 元素 → 行列结构化）
  3. 内嵌无文本位图（mupdf DisplayList 探测 → sharp 裁剪 → 豆包视觉语义化）
  4. 图注（FigureCaption → 作为 VLM 图题信号）
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak,
)

FONT = "C:/Windows/Fonts/simhei.ttf"
pdfmetrics.registerFont(TTFont("SimHei", FONT))

OUT = "C:/Users/ChenJiang/Desktop/langchain-rag/test-fixtures/测试PDF-表格与流程图.pdf"
FLOWCHART = "C:/Users/ChenJiang/Desktop/langchain-rag/test-fixtures/使用流程图-倍轻松N6mini.png"
INDICATOR = "C:/Users/ChenJiang/Desktop/langchain-rag/test-fixtures/充电指示灯状态图示例-无文本.png"

title_st = ParagraphStyle("title", fontName="SimHei", fontSize=20, leading=26, alignment=1)
h1_st = ParagraphStyle("h1", fontName="SimHei", fontSize=14, leading=20, spaceBefore=14)
body_st = ParagraphStyle("body", fontName="SimHei", fontSize=10.5, leading=16)
caption_st = ParagraphStyle("caption", fontName="SimHei", fontSize=9, leading=13, alignment=1, textColor=colors.HexColor("#666666"))

def caption(text: str):
    return Paragraph(f"图注：{text}", caption_st)

doc = SimpleDocTemplate(OUT, pagesize=A4, topMargin=18 * mm, bottomMargin=18 * mm, leftMargin=16 * mm, rightMargin=16 * mm)
story = []

story.append(Paragraph("倍轻松 N6 mini 使用测试文档", title_st))
story.append(Spacer(1, 6))
story.append(Paragraph("（本文件用于测试 PDF 解析管线：Unstructured 版面分析 / 表格提取 / mupdf 图片定位 / 豆包视觉语义化）", caption_st))
story.append(Spacer(1, 10))

# ---------- 一、产品参数（表格） ----------
story.append(Paragraph("一、产品参数", h1_st))
story.append(Paragraph("N6 mini 是一款便携式颈部按摩仪，核心参数如下表所示：", body_st))
story.append(Spacer(1, 6))

table_data = [
    ["参数项", "规格", "备注"],
    ["产品名称", "倍轻松 N6 mini 颈部按摩仪", "便携款"],
    ["产品型号", "N6 mini", "2026 款"],
    ["输入电压", "5V / 1A", "USB-C 供电"],
    ["电池容量", "1800 mAh", "锂离子电池"],
    ["充电时间", "约 2.5 小时", "充满后指示灯变绿"],
    ["续航时长", "约 8 次（每次 15 分钟）", "满电状态"],
    ["净重", "约 210 g", "不含充电线"],
    ["按摩模式", "6 档强度可调", "脉冲 + 热敷"],
]
tbl = Table(table_data, colWidths=[36 * mm, 72 * mm, 42 * mm])
tbl.setStyle(TableStyle([
    ("FONTNAME", (0, 0), (-1, -1), "SimHei"),
    ("FONTSIZE", (0, 0), (-1, -1), 9),
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#e8f0fa")),
    ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#9bb3cc")),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
]))
story.append(tbl)
story.append(PageBreak())

# ---------- 二、产品简介 ----------
story.append(Paragraph("二、产品简介", h1_st))
story.append(Paragraph(
    "倍轻松 N6 mini 采用 U 型环抱式设计，贴合颈部曲线。产品内置 6 档脉冲强度与三档热敷温度，"
    "可通过机身按键或手机 App 进行调节。设备支持语音播报，电量低时会有提示音。"
    "本产品适用于久坐办公、长途出行等场景，单次使用建议不超过 15 分钟。", body_st))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "首次使用前请先将电池充满，充电时指示灯显示红色，充满后变为绿色。若指示灯呈橙色并闪烁，"
    "表示设备出现故障，请参照第四章处理。", body_st))

# ---------- 三、使用流程（流程图） ----------
story.append(Paragraph("三、使用流程", h1_st))
story.append(Paragraph("倍轻松 N6 mini 的使用流程如下图所示：", body_st))
story.append(Spacer(1, 6))
img1 = Image(FLOWCHART, width=135 * mm, height=135 * mm * 240 / 900)
story.append(img1)
story.append(Spacer(1, 4))
story.append(caption("图 3-1 使用流程说明（开机 → 选择模式 → 佩戴 → 按摩 → 充电）"))
story.append(PageBreak())

# ---------- 四、充电指示灯（状态图） ----------
story.append(Paragraph("四、充电指示灯", h1_st))
story.append(Paragraph("充电指示灯状态说明如下图所示：", body_st))
story.append(Spacer(1, 6))
img2 = Image(INDICATOR, width=130 * mm, height=130 * mm * 300 / 560)
story.append(img2)
story.append(Spacer(1, 4))
story.append(caption("图 4-1 充电指示灯状态说明"))
story.append(Spacer(1, 10))
story.append(Paragraph(
    "指示灯颜色与设备状态对应关系如下：绿色表示电量已充满；红色表示正在充电；橙色闪烁表示设备故障，"
    "此时请停止使用并联系售后。若充电超过四小时指示灯仍为红色，请检查充电线与接口是否接触良好。", body_st))

# ---------- 五、保养与注意事项 ----------
story.append(Paragraph("五、保养与注意事项", h1_st))
story.append(Paragraph(
    "请使用干软布清洁设备表面，勿将设备浸入水中。避免在高温、潮湿环境下存放。"
    "长期不使用时，请保持每三个月充电一次，以延长电池寿命。", body_st))
story.append(Paragraph(
    "本产品不适用于孕妇、体内植有心脏起搏器等医疗电子设备的人群。"
    "使用过程中如出现皮肤不适，请立即停止使用并咨询医生。", body_st))

doc.build(story)
print("已生成:", OUT)
