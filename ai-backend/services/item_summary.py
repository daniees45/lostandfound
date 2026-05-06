"""Auto-Summarized Item Cards - Generates concise standardized item summaries (no external API)"""
import re
from typing import Dict, Any, List


CONDITION_WORDS = {
    "new": "Appears to be new / unused",
    "mint": "Mint condition",
    "good": "Good condition",
    "fair": "Fair condition with minor wear",
    "worn": "Visibly worn",
    "damaged": "Damaged",
    "broken": "Broken / non-functional",
    "scratched": "Has scratches",
    "cracked": "Has cracks",
    "dirty": "Dirty / stained",
}


async def generate_item_summary(item_details: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate a concise, standardized summary of an item report.
    No external API required — uses text analysis heuristics.
    """
    title = item_details.get("title", "Unknown item").strip()
    description = item_details.get("description", "").strip()
    category = item_details.get("category", "Other").strip()
    location = item_details.get("location", "").strip()

    # ── Headline ────────────────────────────────────────────────────────────
    headline = f"{title} ({category})" if category and category != "Other" else title

    # ── Summary: first 2 meaningful sentences ──────────────────────────────
    sentences = [s.strip() for s in re.split(r"[.!?]", description) if s.strip()]
    summary_text = ". ".join(sentences[:2])
    if summary_text and not summary_text.endswith("."):
        summary_text += "."
    if not summary_text:
        summary_text = f"A {category.lower()} item reported at {location}." if location else f"A {category.lower()} item."

    # ── Key details: extract colour, brand, model mentions ─────────────────
    key_details: List[str] = []
    color_match = re.search(
        r"\b(black|white|blue|red|green|silver|gold|grey|gray|brown|pink|yellow|orange|purple)\b",
        description, re.IGNORECASE
    )
    if color_match:
        key_details.append(f"Color: {color_match.group(0).capitalize()}")

    brand_match = re.search(
        r"\b(apple|samsung|dell|hp|lenovo|sony|nike|adidas|gucci|zara|asus|acer|lg|huawei)\b",
        description, re.IGNORECASE
    )
    if brand_match:
        key_details.append(f"Brand: {brand_match.group(0).capitalize()}")

    key_details.append(f"Category: {category}")
    if location:
        key_details.append(f"Location: {location}")

    # ── Condition ───────────────────────────────────────────────────────────
    condition_summary = "Condition not specified"
    for word, label in CONDITION_WORDS.items():
        if word in description.lower():
            condition_summary = label
            break

    # ── Search keywords ─────────────────────────────────────────────────────
    raw_keywords = (title + " " + category + " " + (location or "")).lower().split()
    # Remove common stop words
    stop = {"the", "a", "an", "is", "it", "at", "in", "on", "of", "and", "or", "was", "been"}
    keywords = list(dict.fromkeys(w for w in raw_keywords if w not in stop and len(w) > 2))[:7]

    return {
        "headline": headline,
        "summary": summary_text,
        "key_details": key_details[:5],
        "condition_summary": condition_summary,
        "search_optimized": keywords,
    }
