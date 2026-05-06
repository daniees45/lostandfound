"""Auto-Summarized Item Cards - Generates concise standardized item summaries"""
import os
from typing import Dict, Any
import openai
import json

openai.api_key = os.getenv("OPENAI_API_KEY")


async def generate_item_summary(item_details: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate a concise, standardized summary of an item report.
    Cleans up noisy descriptions and standardizes format.
    """

    if not openai.api_key:
        return fallback_summary(item_details)

    try:
        description = item_details.get("description", "")
        category = item_details.get("category", "Unknown")
        location = item_details.get("location", "")

        response = await openai.AsyncOpenAI().chat.completions.create(
            model=os.getenv("OPENAI_TAG_MODEL", "gpt-4-mini"),
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": """Generate a standardized item summary.
Return JSON with:
- headline: 1 sentence concise description (max 15 words)
- summary: 2-3 sentences clear description
- key_details: List of 3-5 most important identifying features
- condition_summary: Brief condition description
- search_optimized: List of 5-7 keywords for search indexing""",
                },
                {
                    "role": "user",
                    "content": f"""Item category: {category}
Location: {location}
Original description: {description}

Generate a standardized summary.""",
                },
            ],
        )

        result = json.loads(response.choices[0].message.content)
        return result

    except Exception as e:
        print(f"OpenAI error: {e}")
        return fallback_summary(item_details)


def fallback_summary(item_details: Dict[str, Any]) -> Dict[str, Any]:
    """Fallback summary generation"""
    title = item_details.get("title", "Unknown item")
    description = item_details.get("description", "")
    category = item_details.get("category", "Other")
    location = item_details.get("location", "")

    # Extract first 2 sentences from description
    sentences = description.split(".")[:2]
    summary_text = ". ".join(sentences).strip()
    if summary_text and not summary_text.endswith("."):
        summary_text += "."

    # Extract basic keywords
    keywords = title.split() + category.split()
    if location:
        keywords.append(location)

    return {
        "headline": f"{title} ({category})",
        "summary": summary_text or f"A {category.lower()} item lost/found at {location}.",
        "key_details": [title, category, f"Location: {location}"]
        if location
        else [title, category],
        "condition_summary": "Condition not specified",
        "search_optimized": list(set(keywords))[:7],
    }
