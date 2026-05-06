"""Smart Search Rewriter - Converts NL queries to structured filters (no external API)"""
from typing import Dict, List, Any


async def rewrite_search_query(user_query: str) -> Dict[str, Any]:
    """
    Convert natural language search query into structured filters.
    No external API required — uses rule-based extraction.
    """
    return fallback_search_rewrite(user_query)


def fallback_search_rewrite(user_query: str) -> Dict[str, Any]:
    """Fallback keyword-based search rewriting"""
    query_lower = user_query.lower()

    # Extract category
    category = None
    if any(word in query_lower for word in ["phone", "laptop", "iphone", "android", "computer"]):
        category = "Electronics"
    elif any(word in query_lower for word in ["bag", "backpack", "purse", "wallet"]):
        category = "Bags"
    elif any(word in query_lower for word in ["id", "passport", "document", "card"]):
        category = "Documents"
    elif any(word in query_lower for word in ["shirt", "jacket", "shoe", "clothing"]):
        category = "Clothing"

    # Extract color
    colors = {
        "black": "black",
        "white": "white",
        "blue": "blue",
        "red": "red",
        "green": "green",
        "silver": "silver",
        "gold": "gold",
        "gray": "gray",
        "brown": "brown",
    }
    color = None
    for color_name in colors:
        if color_name in query_lower:
            color = color_name
            break

    # Extract status
    status = None
    if "lost" in query_lower:
        status = "lost"
    elif "found" in query_lower:
        status = "found"

    # Extract location
    location = None
    location_keywords = ["library", "cafeteria", "dorm", "campus", "office", "classroom"]
    for loc in location_keywords:
        if loc in query_lower:
            location = loc
            break

    # Extract days
    max_days_ago = None
    if "today" in query_lower:
        max_days_ago = 1
    elif "yesterday" in query_lower:
        max_days_ago = 2
    elif "week" in query_lower:
        max_days_ago = 7
    elif "month" in query_lower:
        max_days_ago = 30

    filters = {}
    if category:
        filters["category"] = category
    if color:
        filters["color"] = color
    if status:
        filters["status"] = status
    if location:
        filters["location"] = location
    if max_days_ago:
        filters["max_days_ago"] = max_days_ago

    return {
        "semantic_query": user_query,
        "filters": filters,
        "keywords": user_query.split(),
        "search_type": "hybrid" if filters else "semantic",
    }
