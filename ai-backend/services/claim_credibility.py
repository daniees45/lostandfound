"""AI Claim Credibility Assistant - Scores and analyzes claim credibility"""
import os
from typing import Dict, Any, List
import openai
import json

openai.api_key = os.getenv("OPENAI_API_KEY")


async def assess_claim_credibility(
    claim_description: str, item_type: str, item_details: str
) -> Dict[str, Any]:
    """
    Assess credibility of a claim using LLM analysis.
    Returns structured feedback on specificity, consistency, and potential red flags.
    """

    if not openai.api_key:
        return fallback_credibility_score(claim_description, item_type)

    try:
        response = await openai.AsyncOpenAI().chat.completions.create(
            model=os.getenv("OPENAI_TAG_MODEL", "gpt-4-mini"),
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": """You are a claim credibility assessor for a lost-and-found system.
Analyze claims for specificity, consistency, and potential fraud indicators.
Return a JSON object with:
- credibility_score (0-100): Overall credibility
- specificity_score (0-100): How specific/detailed is the claim
- consistency_issues: List of potential inconsistencies or red flags
- missing_evidence: List of what evidence would strengthen the claim
- follow_up_questions: List of 2-3 clarifying questions for the claimant
- recommendation: 'approve_likely', 'review_needed', or 'reject_likely'
- reasoning: Brief explanation of the assessment""",
                },
                {
                    "role": "user",
                    "content": f"""Item type: {item_type}
Item details: {item_details}

Claimant's description: {claim_description}

Assess the credibility of this claim.""",
                },
            ],
        )

        result = json.loads(response.choices[0].message.content)
        return result

    except Exception as e:
        print(f"OpenAI API error: {e}")
        return fallback_credibility_score(claim_description, item_type)


def fallback_credibility_score(claim_description: str, item_type: str) -> Dict[str, Any]:
    """Fallback credibility scoring using heuristics"""
    score = 50  # Base score

    # Check specificity
    claim_length = len(claim_description.split())
    if claim_length > 50:
        score += 15
    elif claim_length > 20:
        score += 10
    elif claim_length < 5:
        score -= 20

    # Check for specific markers
    specific_markers = ["color", "brand", "model", "serial", "mark", "scratch", "dent"]
    markers_found = sum(1 for marker in specific_markers if marker in claim_description.lower())
    score += markers_found * 5

    # Check for red flags
    red_flags = ["just guessing", "not sure", "think so", "maybe", "forgot"]
    red_flags_found = sum(
        1 for flag in red_flags if flag in claim_description.lower()
    )
    score -= red_flags_found * 10

    score = max(0, min(100, score))

    return {
        "credibility_score": score,
        "specificity_score": min(100, claim_length * 2),
        "consistency_issues": [] if score > 60 else ["Vague or generic description"],
        "missing_evidence": [
            "Specific identifiers (serial number, unique marks)",
            "Timeline details",
            "Item condition description",
        ],
        "follow_up_questions": [
            f"Can you describe any unique markings or identifying features on this {item_type}?",
            "When did you last see/use this item?",
            f"What condition was the {item_type} in when you lost it?",
        ],
        "recommendation": "review_needed" if 40 < score < 70 else "approve_likely" if score >= 70 else "reject_likely",
        "reasoning": f"Claim credibility analysis based on specificity and detail level (score: {score}/100)",
    }
