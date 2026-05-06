"""Vision Tagging - Extract metadata from images using Pillow (no external API)"""
import io
import re
import base64
from typing import Dict, Any, List, Optional
from pathlib import Path

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import requests as _requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False


# ── Colour mapping ────────────────────────────────────────────────────────────
def _rgb_to_name(r: int, g: int, b: int) -> str:
    """Map average RGB to a human-readable colour name."""
    brightness = (r + g + b) / 3
    if brightness < 40:
        return "black"
    if brightness > 215:
        return "white"
    if r > 150 and g < 100 and b < 100:
        return "red"
    if r > 150 and g > 100 and b < 80:
        return "orange"
    if r > 150 and g > 150 and b < 80:
        return "yellow"
    if r < 100 and g > 120 and b < 100:
        return "green"
    if r < 100 and g < 100 and b > 130:
        return "blue"
    if r > 130 and g < 80 and b > 130:
        return "purple"
    if r > 150 and g > 100 and b > 100:
        return "pink"
    if r > 150 and g > 120 and b < 80:
        return "brown"
    if abs(r - g) < 20 and abs(g - b) < 20:
        return "gray"
    if r > 190 and g > 170 and b < 120:
        return "gold"
    if r > 190 and g > 190 and b > 190:
        return "silver"
    return "multicolor"


def _analyze_image_bytes(data: bytes) -> Dict[str, Any]:
    """Extract colour and basic info from raw image bytes using Pillow."""
    if not PIL_AVAILABLE:
        return _fallback_vision_tags()
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
        img.thumbnail((64, 64))  # Downscale for speed
        pixels = list(img.getdata())
        if not pixels:
            return _fallback_vision_tags()
        avg_r = int(sum(p[0] for p in pixels) / len(pixels))
        avg_g = int(sum(p[1] for p in pixels) / len(pixels))
        avg_b = int(sum(p[2] for p in pixels) / len(pixels))
        primary_color = _rgb_to_name(avg_r, avg_g, avg_b)

        # Detect secondary colour by quantizing
        img_small = img.quantize(colors=5).convert("RGB")
        palette_pixels = list(img_small.getdata())
        color_counts: Dict[str, int] = {}
        for px in palette_pixels:
            c = _rgb_to_name(px[0], px[1], px[2])
            color_counts[c] = color_counts.get(c, 0) + 1
        secondary_colors = [
            c for c, _ in sorted(color_counts.items(), key=lambda x: -x[1])
            if c != primary_color
        ][:2]

        brightness = (avg_r + avg_g + avg_b) / 3
        condition = "good" if brightness > 100 else "fair"

        return {
            "object_type": "item",
            "primary_color": primary_color,
            "secondary_colors": secondary_colors,
            "brand": None,
            "condition": condition,
            "notable_features": [f"Average colour: {primary_color}"],
            "confidence": "medium",
            "description": f"Item appears to be primarily {primary_color}.",
            "suggested_category": "Others",
            "suggested_tags": [primary_color] + secondary_colors,
        }
    except Exception as e:
        print(f"Pillow analysis error: {e}")
        return _fallback_vision_tags()


def _fallback_vision_tags() -> Dict[str, Any]:
    return {
        "object_type": "unknown",
        "primary_color": "unknown",
        "secondary_colors": [],
        "brand": None,
        "condition": "unknown",
        "notable_features": [],
        "confidence": "low",
        "description": "Image analysis unavailable. Please provide a manual description.",
        "suggested_category": "Others",
        "suggested_tags": [],
    }


async def extract_tags_from_image(image_path: str) -> Dict[str, Any]:
    """Extract metadata from a local image file using Pillow."""
    if not PIL_AVAILABLE:
        return _fallback_vision_tags()
    try:
        with open(image_path, "rb") as f:
            return _analyze_image_bytes(f.read())
    except Exception as e:
        print(f"Vision file error: {e}")
        return _fallback_vision_tags()


async def extract_tags_from_url(image_url: str) -> Dict[str, Any]:
    """Fetch an image from a URL and analyse it with Pillow."""
    if not PIL_AVAILABLE or not REQUESTS_AVAILABLE:
        return _fallback_vision_tags()
    try:
        resp = _requests.get(image_url, timeout=8)
        resp.raise_for_status()
        return _analyze_image_bytes(resp.content)
    except Exception as e:
        print(f"Vision URL error: {e}")
        return _fallback_vision_tags()
