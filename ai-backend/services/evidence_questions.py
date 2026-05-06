"""Evidence Question Generator - Generates tailored verification questions"""
import os
from typing import Dict, List, Any
import openai
import json

openai.api_key = os.getenv("OPENAI_API_KEY")

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
    Generate tailored evidence verification questions based on item type.
    Uses LLM for dynamic questions, falls back to templates.
    """

    if openai.api_key:
        try:
            response = await openai.AsyncOpenAI().chat.completions.create(
                model=os.getenv("OPENAI_TAG_MODEL", "gpt-4-mini"),
                temperature=0.7,
                response_format={"type": "json_object"},
                messages=[
                    {
                        "role": "system",
                        "content": """Generate 4-5 specific verification questions for a lost-and-found claim.
Focus on details only the true owner would know.
Return JSON with:
- questions: List of 4-5 specific questions
- difficulty: 'easy', 'medium', or 'hard'
- focus_areas: List of what the questions target (e.g., 'physical description', 'contents', 'condition')""",
                    },
                    {
                        "role": "user",
                        "content": f"Item type: {item_type}\nDetails: {item_details}\n\nGenerate verification questions.",
                    },
                ],
            )

            result = json.loads(response.choices[0].message.content)
            return result
        except Exception as e:
            print(f"OpenAI error: {e}")
            return fallback_questions(item_type)

    return fallback_questions(item_type)


def fallback_questions(item_type: str) -> Dict[str, Any]:
    """Fallback to template-based questions"""
    category = item_type if item_type in QUESTION_TEMPLATES else "Other"
    questions = QUESTION_TEMPLATES[category]

    return {
        "questions": questions,
        "difficulty": "medium",
        "focus_areas": [
            "physical description",
            "unique identifying features",
            "condition and damage",
            "contents or markings",
        ],
    }
