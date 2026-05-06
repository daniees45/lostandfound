"""Smart Search Rewriter - Converts natural language queries into optimized search filters"""
import os
from typing import Dict, List, Any
import openai
import json

openai.api_key = os.getenv("OPENAI_API_KEY")


async def rewrite_search_query(user_query: str) -> Dict[str, Any]:
    """
    Convert natural language search query into structured filters.
    Example: "black samsung lost near cafeteria last week"
    -> filters: {category: "Electronics", color: "black", location: "cafeteria", days_ago: 7}
       semantic_query: "black samsung phone"
    """

    if not openai.api_key:
        return fallback_search_rewrite(user_query)

    try:
        response = await openai.AsyncOpenAI().chat.completions.create(
            model=os.getenv("OPENAI_TAG_MODEL", "gpt-4-mini"),
            temperature=0.3,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": """Parse a search query into structured filters and semantic terms.
Return JSON with:
- semantic_query: Cleaned search terms for embedding-based search
- filters: Object with extracted constraints:
  - category: One of 'Electronics', 'Bags', 'Documents', 'Clothing', 'Others' or null
  - color: Detected color or null
  - location: Location name or null
  - status: 'lost', 'found', or null
  - max_days_ago: Days since report or null
- keywords: List of important search terms
- search_type: 'specific' (exact match likely), 'semantic' (similarity search), or 'hybrid'""",
                },
                {
                    "role": "user",
                    "content": f"User search query: {user_query}",
                },
            ],
        )

        result = json.loads(response.choices[0].message.content)
        return result

    except Exception as e:
        print(f"OpenAI error: {e}")
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
