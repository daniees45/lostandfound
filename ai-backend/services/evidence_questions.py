"""Evidence Question Generator - Generates tailored verification questions (no external API)"""
from typing import Dict, List, Any

# Fallback templates for common item types
QUESTION_TEMPLATES = {
    "Electronics": [
        "What is the device's brand and model?",
        "What color is the device?",
        "Do you remember any protective cases or accessories?",
        "What was the battery condition when you lost it?",
        "Can you describe any distinguishing marks or damage?",
    ],
    "Bags": [
        "What is the brand and style of the bag?",
        "What color/pattern is it?",
        "What was inside the bag?",
        "Does it have any distinctive features (pockets, straps, logos)?",
        "Was there a name tag or ID inside?",
    ],
    "Documents": [
        "What type of document is it (ID, diploma, contract)?",
        "Do you remember your exact full name as written on it?",
        "What was the issue/expiration date?",
        "Were there any stamps or official seals?",
        "What color was the document or folder?",
    ],
    "Clothing": [
        "What is the brand and size?",
        "What color/pattern is the item?",
        "Are there any logos, embroidery, or special markings?",
        "Do you remember any damage or stains?",
        "Was there a name label inside?",
    ],
    "Other": [
        "Can you describe the item's appearance in detail?",
        "What color/material is it made of?",
        "Does it have any unique markings or identifiers?",
        "What condition was it in when lost?",
        "Can you describe any damage or special features?",
    ],
}


async def generate_evidence_questions(item_type: str, item_details: str) -> Dict[str, Any]:
    """
    Generate tailored evidence verification questions using item-type templates.
    No external API required.
    """
    # Pick best matching template
    category = item_type if item_type in QUESTION_TEMPLATES else "Other"

    # Personalise questions from item_details keywords
    detail_lower = item_details.lower()
    questions: List[str] = list(QUESTION_TEMPLATES[category])

    # Inject detail-specific questions
    if "laptop" in detail_lower or "macbook" in detail_lower:
        questions.insert(0, "What are the last 4 characters of the device serial number?")
    if "phone" in detail_lower or "iphone" in detail_lower or "android" in detail_lower:
        questions.insert(0, "What is the IMEI or the phone's lock-screen wallpaper?")
    if "wallet" in detail_lower:
        questions.insert(0, "What cards or cash denomination were inside?")
    if "bag" in detail_lower or "backpack" in detail_lower:
        questions.insert(0, "What items were in the bag's main compartment?")

    return {
        "questions": questions[:5],
        "difficulty": "medium",
        "focus_areas": [
            "physical description",
            "unique identifying features",
            "condition and damage",
            "contents or markings",
        ],
    }


def fallback_questions(item_type: str) -> Dict[str, Any]:
    category = item_type if item_type in QUESTION_TEMPLATES else "Other"
    return {
        "questions": QUESTION_TEMPLATES[category],
        "difficulty": "medium",
        "focus_areas": ["physical description", "unique identifying features"],
    }
