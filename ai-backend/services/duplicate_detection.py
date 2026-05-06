"""Duplicate Report Detection - Identifies similar/duplicate lost/found reports"""
from typing import Dict, List, Any
import numpy as np
from datetime import datetime, timedelta


def cosine_distance(vec1: List[float], vec2: List[float]) -> float:
    """Calculate cosine similarity between two vectors"""
    if not vec1 or not vec2:
        return 0.0
    v1 = np.array(vec1, dtype=float)
    v2 = np.array(vec2, dtype=float)
    try:
        denom = np.linalg.norm(v1) * np.linalg.norm(v2)
        if denom == 0:
            return 0.0
        return float(np.dot(v1, v2) / denom)
    except:
        return 0.0


def calculate_duplicate_score(
    new_report: Dict[str, Any],
    existing_report: Dict[str, Any],
    embedding_similarity: float,
) -> float:
    """
    Calculate probability that two reports are duplicates.
    Score ranges from 0 to 1, where 1 is definitely duplicate.
    """
    score = embedding_similarity * 0.5  # Text similarity is 50% of score

    # Boost score if same category
    if new_report.get("category") == existing_report.get("category"):
        score += 0.15

    # Boost score if same location
    if (
        new_report.get("location")
        and existing_report.get("location")
        and new_report["location"].lower() == existing_report["location"].lower()
    ):
        score += 0.15

    # Boost score if within 3 days
    try:
        new_time = datetime.fromisoformat(new_report.get("created_at", ""))
        existing_time = datetime.fromisoformat(existing_report.get("created_at", ""))
        time_diff = abs((new_time - existing_time).days)

        if time_diff <= 3:
            score += 0.2
        elif time_diff <= 7:
            score += 0.1
    except:
        pass

    # Penalize if different status (can't be exact duplicate)
    if new_report.get("status") != existing_report.get("status"):
        score *= 0.7

    return min(score, 1.0)


async def detect_duplicates(
    new_report: Dict[str, Any],
    existing_reports: List[Dict[str, Any]],
    new_embedding: List[float],
    existing_embeddings: List[List[float]],
    threshold: float = 0.65,
) -> Dict[str, Any]:
    """
    Detect if new report is a duplicate of existing reports.
    Returns potential duplicates with confidence scores.
    """
    potential_duplicates = []

    for existing_report, existing_embedding in zip(existing_reports, existing_embeddings):
        if existing_report.get("id") == new_report.get("id"):
            continue

        embedding_sim = cosine_distance(new_embedding, existing_embedding)
        dup_score = calculate_duplicate_score(new_report, existing_report, embedding_sim)

        if dup_score >= threshold:
            potential_duplicates.append(
                {
                    "report_id": existing_report.get("id"),
                    "title": existing_report.get("title"),
                    "description": existing_report.get("description"),
                    "category": existing_report.get("category"),
                    "location": existing_report.get("location"),
                    "created_at": existing_report.get("created_at"),
                    "similarity_score": dup_score,
                    "confidence": "high" if dup_score > 0.8 else "medium",
                }
            )

    # Sort by score
    potential_duplicates.sort(key=lambda x: x["similarity_score"], reverse=True)

    is_duplicate = len(potential_duplicates) > 0
    risk_level = (
        "high"
        if is_duplicate and potential_duplicates[0]["similarity_score"] > 0.85
        else "medium"
        if is_duplicate
        else "low"
    )

    return {
        "is_potential_duplicate": is_duplicate,
        "risk_level": risk_level,
        "duplicate_count": len(potential_duplicates),
        "potential_duplicates": potential_duplicates[:3],  # Top 3
        "recommendation": "review" if is_duplicate else "proceed",
        "action": "ask_confirmation" if risk_level == "high" else "proceed",
    }
