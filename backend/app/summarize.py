"""Turn tldraw shape data into a compact, model-readable canvas description."""

from __future__ import annotations


def _rich_text(node) -> str:
    """Read tldraw 3.15 rich text without evaluating markup or code."""
    if not isinstance(node, dict):
        return ""
    if node.get("type") == "text":
        return str(node.get("text", ""))
    if node.get("type") == "hardBreak":
        return "\n"
    text = "".join(_rich_text(child) for child in node.get("content", []))
    return text + ("\n" if node.get("type") == "paragraph" else "")


def _pos(props: dict) -> str:
    x, y = props.get("x"), props.get("y")
    if isinstance(x, (int, float)) and isinstance(y, (int, float)):
        return f" at position ({int(x)}, {int(y)})"
    return ""


def summarize_canvas(shapes: list[dict]) -> str:
    """Produce a compact description of the tldraw canvas for the LLM."""
    texts: list[str] = []
    shape_labels: list[str] = []
    strokes = 0

    for shape in shapes or []:
        stype = shape.get("type", "unknown")
        props = shape.get("props") or {}

        if stype == "text":
            text = (props.get("text") or _rich_text(props.get("richText"))).strip()
            if text:
                texts.append(f"Text{_pos(props)}: {text}")
        elif stype == "draw":
            strokes += 1
        elif stype == "line":
            shape_labels.append("Straight line")
        elif stype == "arrow":
            shape_labels.append("Arrow")
        elif stype in ("rectangle", "ellipse", "diamond", "geo"):
            label = stype.capitalize()
            if stype == "ellipse":
                label = "Ellipse/circle"
            shape_labels.append(label)
        elif stype == "frame":
            shape_labels.append("Frame/box boundary")
        elif stype in ("highlighter",):
            shape_labels.append("Highlighted region")

    parts: list[str] = []
    if texts:
        parts.append("Written text:\n" + "\n".join(texts))
    if shape_labels:
        parts.append("Shapes/figures: " + ", ".join(dict.fromkeys(shape_labels)))
    if strokes:
        parts.append(f"Hand-drawn strokes (freehand, not readable as symbols): {strokes}")
    if not parts:
        return "The canvas appears to be empty."
    return "\n".join(parts)
