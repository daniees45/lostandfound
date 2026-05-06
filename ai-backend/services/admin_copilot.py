"""Admin Copilot - Natural language admin assistant"""
import os
from typing import Dict, Any, List
import openai
import json

openai.api_key = os.getenv("OPENAI_API_KEY")


async def process_admin_query(
    query: str, available_data: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Process natural language admin queries and generate actionable insights.
    Examples: "show me high-risk claims", "items waiting > 14 days", "fraud patterns"
    """

    if available_data is None:
        available_data = {}

    if not openai.api_key:
        return fallback_admin_response(query)

    try:
        # Provide context about available data
        context_str = f"""You are an admin assistant for a Lost & Found system.
Available data fields: {', '.join(available_data.keys())}

Process the admin's query and return:
- query_type: 'filter', 'analyze', 'report', 'recommendation'
- interpretation: What the admin is asking for
- suggested_actions: List of 2-3 specific actions
- relevant_fields: Which data fields would help answer this
- estimated_count: Rough estimate of matching records (if applicable)"""

        response = await openai.AsyncOpenAI().chat.completions.create(
            model=os.getenv("OPENAI_TAG_MODEL", "gpt-4-mini"),
            temperature=0.5,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": context_str},
                {"role": "user", "content": f"Admin query: {query}"},
            ],
        )

        result = json.loads(response.choices[0].message.content)
        return result

    except Exception as e:
        print(f"OpenAI error: {e}")
        return fallback_admin_response(query)


def fallback_admin_response(query: str) -> Dict[str, Any]:
    """Fallback admin copilot response"""
    # Simple keyword-based routing
    query_lower = query.lower()

    if "high" in query_lower and "risk" in query_lower:
        query_type = "filter"
        interpretation = "Show high-risk claims (low specificity scores, multiple rejections)"
        suggested_actions = [
            "Filter claims with credibility_score < 50",
            "Sort by failed_verification_count DESC",
        ]
    elif "wait" in query_lower or "long" in query_lower or "14" in query_lower:
        query_type = "filter"
        interpretation = "Show items awaiting resolution for > 14 days"
        suggested_actions = [
            "Filter items with status='lost' or 'found'",
            "Filter created_at < 14 days ago",
        ]
    elif "fraud" in query_lower or "suspicious" in query_lower:
        query_type = "analyze"
        interpretation = "Analyze fraud patterns"
        suggested_actions = [
            "Identify users with multiple rejected claims",
            "Flag repeated use of vague descriptions",
        ]
    else:
        query_type = "report"
        interpretation = f"Generate report on: {query}"
        suggested_actions = [
            "Clarify the specific metric or status you're interested in",
            "Specify a time range if applicable",
        ]

    return {
        "query_type": query_type,
        "interpretation": interpretation,
        "suggested_actions": suggested_actions,
        "relevant_fields": [
            "status",
            "created_at",
            "category",
            "credibility_score",
            "claim_count",
        ],
        "estimated_count": "Unknown - requires database query",
    }
