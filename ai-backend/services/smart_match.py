"""Smart Match Suggestion Service - Links lost & found items using embeddings + metadata"""
import os
from typing import List, Dict, Any
from datetime import datetime, timedelta
import numpy as np
import openai

openai.api_key = os.getenv("OPENAI_API_KEY")


def cosine_distance(vec1: List[float], vec2: List[float]) -> float:
    """Calculate cosine distance between two vectors"""
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


def calculate_match_score(
    lost_item: Dict[str, Any],
    found_item: Dict[str, Any],
    embedding_similarity: float,
) -> Dict[str, Any]:
    """
    Calculate composite match score between lost and found items.
    Components:
    - Text similarity (embedding-based): 40%
    - Category match: 20%
    - Location proximity: 20%
    - Time proximity: 20%
    """
    score = 0.0
    reasons = []

    # Text similarity (40%)
    text_score = embedding_similarity * 0.4
    score += text_score
    if text_score > 0.3:
        reasons.append(f"Description similarity: {text_score:.2f}")

    # Category match (20%)
    if lost_item.get("category") == found_item.get("category"):
        category_score = 0.2
        score += category_score
        reasons.append("Category match: 0.20")
    else:
        # Partial credit for similar categories
        similar_pairs = [
            ("Electronics", "Electronics"),
            ("Bags", "Bags"),
            ("Documents", "Documents"),
            ("Clothing", "Clothing"),
        ]
        if (lost_item.get("category"), found_item.get("category")) in similar_pairs:
            category_score = 0.1
            score += category_score
            reasons.append("Related category: 0.10")

    # Location proximity (20%)
    if lost_item.get("location") and found_item.get("location"):
        if lost_item["location"].lower() == found_item["location"].lower():
            location_score = 0.2
            score += location_score
            reasons.append("Location match: 0.20")
        # Could add distance-based scoring if coordinates available
        else:
            location_score = 0.05
            score += location_score
            reasons.append("Nearby location: 0.05")

    # Time proximity (20%)
    try:
        lost_time = datetime.fromisoformat(lost_item.get("created_at", ""))
        found_time = datetime.fromisoformat(found_item.get("created_at", ""))
        time_diff = abs((lost_time - found_time).days)

        if time_diff <= 1:
            time_score = 0.2
        elif time_diff <= 7:
            time_score = 0.15
        elif time_diff <= 30:
            time_score = 0.1
        else:
            time_score = 0.0

        score += time_score
        if time_score > 0:
            reasons.append(f"Time proximity ({time_diff} days): {time_score:.2f}")
    except:
        pass

    return {
        "score": min(score, 1.0),
        "confidence": "high" if score > 0.7 else "medium" if score > 0.4 else "low",
        "reasons": reasons,
    }


async def find_smart_matches(
    new_item: Dict[str, Any],
    existing_items: List[Dict[str, Any]],
    new_item_embedding: List[float],
    existing_embeddings: List[List[float]],
    top_n: int = 3,
) -> List[Dict[str, Any]]:
    """
    Find smart matches for a new item against existing items.
    Returns top N matches with scores and reasons.
    """
    matches = []

    for existing_item, existing_embedding in zip(existing_items, existing_embeddings):
        if existing_item.get("id") == new_item.get("id"):
            continue

        # Only match lost items with found items and vice versa
        if new_item.get("status") == existing_item.get("status"):
            continue

        embedding_sim = cosine_distance(new_item_embedding, existing_embedding)
        match_data = calculate_match_score(new_item, existing_item, embedding_sim)

        if match_data["score"] > 0.3:  # Threshold
            matches.append(
                {
                    "match_id": existing_item.get("id"),
                    "match_title": existing_item.get("title"),
                    "match_description": existing_item.get("description"),
                    "match_category": existing_item.get("category"),
                    "match_location": existing_item.get("location"),
                    "match_status": existing_item.get("status"),
                    "score": match_data["score"],
                    "confidence": match_data["confidence"],
                    "reasons": match_data["reasons"],
                }
            )

    # Sort by score descending
    matches.sort(key=lambda x: x["score"], reverse=True)
    return matches[:top_n]
