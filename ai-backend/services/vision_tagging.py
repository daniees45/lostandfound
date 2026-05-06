"""Vision Tagging - Extract metadata from uploaded images using Vision API"""
import os
import base64
from typing import Dict, Any, Optional, List
import openai
import json
from pathlib import Path

openai.api_key = os.getenv("OPENAI_API_KEY")


async def extract_tags_from_image(image_path: str) -> Dict[str, Any]:
    """
    Extract object type, color, brand, condition from image using Vision API.
    """

    if not openai.api_key:
        return fallback_vision_tags()

    try:
        # Read and encode image
        with open(image_path, "rb") as image_file:
            image_data = base64.standard_b64encode(image_file.read()).decode("utf-8")

        # Determine image type from extension
        ext = Path(image_path).suffix.lower()
        media_type_map = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
        }
        media_type = media_type_map.get(ext, "image/jpeg")

        response = await openai.AsyncOpenAI().chat.completions.create(
            model="gpt-4-vision",
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:{media_type};base64,{image_data}"},
                        },
                        {
                            "type": "text",
                            "text": """Analyze this image of a lost/found item.
Return JSON with:
- object_type: What is the main object? (e.g., 'laptop', 'backpack', 'wallet')
- primary_color: Main color (e.g., 'black', 'blue', 'silver')
- secondary_colors: List of other visible colors
- brand: Detected brand if visible (or null)
- condition: 'new', 'good', 'fair', 'poor', 'damaged'
- notable_features: List of distinctive marks, logos, damage, stickers, etc.
- confidence: 'high', 'medium', 'low'
- description: Brief 1-2 sentence visual description
- suggested_category: One of 'Electronics', 'Bags', 'Documents', 'Clothing', 'Others'
- suggested_tags: List of 3-5 descriptive tags""",
                        },
                    ],
                }
            ],
        )

        result = json.loads(response.choices[0].message.content)
        return result

    except Exception as e:
        print(f"Vision API error: {e}")
        return fallback_vision_tags()


async def extract_tags_from_url(image_url: str) -> Dict[str, Any]:
    """
    Extract tags from a remote image URL.
    """

    if not openai.api_key:
        return fallback_vision_tags()

    try:
        response = await openai.AsyncOpenAI().chat.completions.create(
            model="gpt-4-vision",
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {"url": image_url},
                        },
                        {
                            "type": "text",
                            "text": """Analyze this image of a lost/found item.
Return JSON with:
- object_type: What is the main object? (e.g., 'laptop', 'backpack', 'wallet')
- primary_color: Main color (e.g., 'black', 'blue', 'silver')
- secondary_colors: List of other visible colors
- brand: Detected brand if visible (or null)
- condition: 'new', 'good', 'fair', 'poor', 'damaged'
- notable_features: List of distinctive marks, logos, damage, stickers, etc.
- confidence: 'high', 'medium', 'low'
- description: Brief 1-2 sentence visual description
- suggested_category: One of 'Electronics', 'Bags', 'Documents', 'Clothing', 'Others'
- suggested_tags: List of 3-5 descriptive tags""",
                        },
                    ],
                }
            ],
        )

        result = json.loads(response.choices[0].message.content)
        return result

    except Exception as e:
        print(f"Vision API error: {e}")
        return fallback_vision_tags()


def fallback_vision_tags() -> Dict[str, Any]:
    """Fallback when vision API is unavailable"""
    return {
        "object_type": "unknown",
        "primary_color": "unknown",
        "secondary_colors": [],
        "brand": None,
        "condition": "unknown",
        "notable_features": [],
        "confidence": "low",
        "description": "Image analysis unavailable. Please provide manual description.",
        "suggested_category": "Others",
        "suggested_tags": [],
    }
