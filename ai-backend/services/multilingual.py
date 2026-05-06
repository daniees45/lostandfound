"""Multilingual Report Support - Translates and normalizes reports"""
from typing import Dict, List, Any
import os

try:
    from langdetect import detect, detect_langs
    from textblob import TextBlob
except ImportError:
    pass

import openai

openai.api_key = os.getenv("OPENAI_API_KEY")


async def detect_and_translate(text: str, target_language: str = "en") -> Dict[str, Any]:
    """
    Detect source language and translate to target language.
    """

    # Try to detect language
    detected_language = "en"
    try:
        detected_language = detect(text)
    except:
        pass

    if detected_language == target_language:
        return {
            "original_text": text,
            "detected_language": detected_language,
            "translated_text": text,
            "translated_language": target_language,
            "translation_needed": False,
        }

    if not openai.api_key:
        return fallback_translation(text, detected_language, target_language)

    try:
        response = await openai.AsyncOpenAI().chat.completions.create(
            model=os.getenv("OPENAI_TAG_MODEL", "gpt-4-mini"),
            temperature=0.1,
            messages=[
                {
                    "role": "system",
                    "content": f"You are a translator. Translate the text from {detected_language} to {target_language}. Return only the translated text.",
                },
                {
                    "role": "user",
                    "content": text,
                },
            ],
        )

        translated = response.choices[0].message.content.strip()

        return {
            "original_text": text,
            "detected_language": detected_language,
            "translated_text": translated,
            "translated_language": target_language,
            "translation_needed": True,
        }

    except Exception as e:
        print(f"OpenAI translation error: {e}")
        return fallback_translation(text, detected_language, target_language)


async def normalize_report(item_report: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize a report by detecting language, translating, and standardizing fields.
    """

    # Detect and translate title and description
    title_result = await detect_and_translate(item_report.get("title", ""), "en")
    description_result = await detect_and_translate(
        item_report.get("description", ""), "en"
    )

    normalized = {
        **item_report,
        "original_language": title_result["detected_language"],
        "title": title_result["translated_text"],
        "description": description_result["translated_text"],
        "title_translated": title_result["translation_needed"],
        "description_translated": description_result["translation_needed"],
        "canonical_form": True,
        "supported_languages": ["en"],
    }

    # Store original if translated
    if title_result["translation_needed"]:
        normalized["original_title"] = title_result["original_text"]

    if description_result["translation_needed"]:
        normalized["original_description"] = description_result["original_text"]

    return normalized


def get_supported_languages() -> List[Dict[str, str]]:
    """Return list of supported languages"""
    return [
        {"code": "en", "name": "English"},
        {"code": "es", "name": "Spanish"},
        {"code": "fr", "name": "French"},
        {"code": "de", "name": "German"},
        {"code": "it", "name": "Italian"},
        {"code": "pt", "name": "Portuguese"},
        {"code": "ru", "name": "Russian"},
        {"code": "ja", "name": "Japanese"},
        {"code": "zh", "name": "Chinese"},
        {"code": "ar", "name": "Arabic"},
        {"code": "hi", "name": "Hindi"},
    ]


def fallback_translation(text: str, source_lang: str, target_lang: str) -> Dict[str, Any]:
    """Fallback when translation API is unavailable"""
    return {
        "original_text": text,
        "detected_language": source_lang,
        "translated_text": text,
        "translated_language": target_lang,
        "translation_needed": False,
        "warning": "Translation service unavailable - original text returned",
    }
