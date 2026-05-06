"""AI Claim Credibility Assistant - Scores claims using local heuristics (no external API)"""
import re
from typing import Dict, Any, List


# Specific item-detail keywords that only a real owner would likely know
SPECIFIC_MARKERS = [
    "color", "brand", "model", "serial", "number", "sticker", "scratch",
    "dent", "crack", "case", "strap", "broken", "mark", "label", "logo",
    "pattern", "size", "weight", "inscription", "engraved", "name", "tag",
    "password", "wallpaper", "pin", "lock", "charger", "cable", "pouch",
]

RED_FLAGS = [
    "just guessing", "not sure", "think so", "maybe it", "forgot",
    "don't remember", "cannot recall", "no idea", "any item", "just lost",
]

WEAK_PATTERNS = [
    r"\bit is mine\b",
    r"\bi lost it\b",
    r"\bplease give\b",
    r"\bi need it\b",
    r"\bmy property\b",
]


async def assess_claim_credibility(
    claim_description: str, item_type: str, item_details: str
) -> Dict[str, Any]:
    """
    Assess credibility of a claim using heuristic NLP analysis.
    No external API required.
    """
    desc = claim_description.strip()
    desc_lower = desc.lower()
    words = desc.split()
    word_count = len(words)

    score = 50

    # Length / detail level
    if word_count > 60:
        score += 20
    elif word_count > 30:
        score += 12
    elif word_count > 15:
        score += 6
    elif word_count < 5:
        score -= 25

    # Specific markers
    markers_found = [m for m in SPECIFIC_MARKERS if m in desc_lower]
    score += min(25, len(markers_found) * 5)

    # Red flags
    red_flags_found = [f for f in RED_FLAGS if f in desc_lower]
    score -= len(red_flags_found) * 10

    weak_found = sum(1 for p in WEAK_PATTERNS if re.search(p, desc_lower))
    score -= weak_found * 8

    # Numbers / model info
    numbers = re.findall(r"\b\d[\d\-/]+\b", desc)
    if numbers:
        score += min(10, len(numbers) * 4)

    if item_type.lower() and item_type.lower() in desc_lower:
        score += 5

    score = max(0, min(100, score))

    specificity = min(100, word_count * 2 + len(markers_found) * 8)
    recommendation = (
        "approve_likely" if score >= 70
        else "reject_likely" if score < 40
        else "review_needed"
    )

    consistency_issues: List[str] = []
    if red_flags_found:
        consistency_issues.append(f"Uncertain language: {', '.join(red_flags_found)}")
    if word_count < 10:
        consistency_issues.append("Description too brief to verify ownership")
    if not markers_found:
        consistency_issues.append("No specific identifying features mentioned")

    missing_evidence: List[str] = []
    if "serial" not in desc_lower and "number" not in desc_lower:
        missing_evidence.append("Serial or model number")
    if not any(m in desc_lower for m in ["color", "colour"]):
        missing_evidence.append("Color description")
    if not any(m in desc_lower for m in ["scratch", "dent", "crack", "mark", "sticker"]):
        missing_evidence.append("Distinguishing physical marks")

    return {
        "credibility_score": score,
        "specificity_score": specificity,
        "consistency_issues": consistency_issues,
        "missing_evidence": missing_evidence,
        "follow_up_questions": [
            f"Can you describe any unique marks or damage on this {item_type}?",
            "What is the brand and model (if applicable)?",
            "When and where did you last see the item?",
        ],
        "recommendation": recommendation,
        "reasoning": (
            f"Score {score}/100 — {word_count} words, "
            f"{len(markers_found)} specific markers, {len(red_flags_found)} red flags."
        ),
    }
