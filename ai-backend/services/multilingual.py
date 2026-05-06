"""Multilingual Report Support - Language detection + normalization (no external API)"""
from typing import Dict, List, Any

try:
    from langdetect import detect
except ImportError:
    def detect(text: str) -> str:  # type: ignore
        return "en"


async def detect_and_translate(text: str, target_language: str = "en") -> Dict[str, Any]:
    """
    Detect source language. Translation is not available without an external API,
    so we return the original text with detection metadata.
    """
    detected_language = "en"
    try:
        detected_language = detect(text)
    except Exception:
        pass

    return {
        "original_text": text,
        "detected_language": detected_language,
        "translated_text": text,  # No translation without external API
        "translated_language": target_language,
        "translation_needed": detected_language != target_language,
        "note": "Translation skipped — text returned as-is. Enable an external service for full translation.",
    }


async def normalize_report(item_report: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize a report: detect language and flag fields that may need translation.
    """
    title_result = await detect_and_translate(item_report.get("title", ""), "en")
    description_result = await detect_and_translate(item_report.get("description", ""), "en")

    normalized = {
        **item_report,
        "original_language": title_result["detected_language"],
        "title": title_result["translated_text"],
        "description": description_result["translated_text"],
        "title_translated": False,
        "description_translated": False,
        "canonical_form": True,
        "supported_languages": ["en"],
    }

    if title_result["translation_needed"]:
        normalized["original_title"] = title_result["original_text"]
    if description_result["translation_needed"]:
        normalized["original_description"] = description_result["original_text"]

    return normalized


def get_supported_languages() -> List[Dict[str, str]]:
    return [
        {"code": "en", "name": "English"},
        {"code": "es", "name": "Spanish"},
        {"code": "fr", "name": "French"},
        {"code": "de", "name": "German"},
        {"code": "it", "name": "Italian"},
        {"code": "pt", "name": "Portuguese"},
        {"code": "ar", "name": "Arabic"},
        {"code": "hi", "name": "Hindi"},
    ]
