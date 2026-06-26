"""Admin Copilot - Natural language admin assistant (no external API)"""
from typing import Dict, Any, List


# ── Intent keyword maps ───────────────────────────────────────────────────────
INTENT_MAP = [
    (["high risk", "fraud", "suspicious", "reject", "red flag"], "fraud_analysis"),
    (["wait", "waiting", "long", "old", "overdue", "14 day", "unclaimed"], "aging_items"),
    (["claim", "claims", "approval", "approve", "pending"], "claim_report"),
    (["user", "users", "registered", "account", "student"], "user_report"),
    (["categor", "type", "kind", "most common", "popular"], "category_analysis"),
    (["summar", "today", "overview", "dashboard", "activity", "stats"], "summary"),
    (["match", "lost", "found", "pair", "link"], "match_report"),
    (["return", "resolved", "complete", "closed"], "resolved_report"),
]


def _detect_intent(query: str) -> str:
    q = query.lower()
    for keywords, intent in INTENT_MAP:
        if any(k in q for k in keywords):
            return intent
    return "general"


def _build_response(intent: str, query: str, data: Dict[str, Any]) -> Dict[str, Any]:
    stats = data.get("stats", {})
    items_count = stats.get("items", "?")
    users_count = stats.get("users", "?")
    claims_count = stats.get("claims", "?")

    responses: Dict[str, Dict[str, Any]] = {
        "fraud_analysis": {
            "answer": (
                "To identify high-risk claims, look for claims that have been pending for an unusually long time. "
                "Pay close attention to claimants providing vague or extremely short proof descriptions, as this is often a red flag. "
                "Also, check if the same user has submitted multiple claims across different items recently."
            ),
            "insights": [
                "Claims with very short proof descriptions are higher risk.",
                "Look for the same user appearing in multiple pending claims.",
                "Items unclaimed for over 30 days with sudden claim activity may indicate fraud attempts."
            ],
        },
        "aging_items": {
            "answer": (
                f"You currently have {items_count} total items. "
                "It is recommended to review any items marked as 'lost' or 'found' that are older than 14 days. "
                "Consider reaching out to the reporters for follow-up or archiving the items to keep the active list clean."
            ),
            "insights": [
                "Items older than 30 days with no claims are prime candidates for archival.",
                "Consider sending automated or manual reminder emails to reporters of aging items."
            ],
        },
        "claim_report": {
            "answer": (
                f"There are {claims_count} claims recorded in the system. "
                "Pending claims should be reviewed promptly to maintain trust. "
                "When reviewing, prioritize approving claims that provide detailed proof descriptions "
                "with specific identifying information that matches the item."
            ),
            "insights": [
                "Prioritize reviewing claims with the longest, most detailed proof descriptions first.",
                f"Total claims in the system: {claims_count}"
            ],
        },
        "user_report": {
            "answer": (
                f"The platform currently has {users_count} registered users. "
                "A healthy user base is great, but be on the lookout for newly registered users "
                "who immediately file multiple claims, as this can be a strong fraud signal."
            ),
            "insights": [
                f"Total registered users: {users_count}",
                "Students typically make up the vast majority of active claimants."
            ],
        },
        "category_analysis": {
            "answer": (
                f"Out of the {items_count} total items, certain categories usually see more traffic. "
                "Reviewing the item categories can help you understand what gets lost most frequently, "
                "allowing you to implement targeted preventative measures or better categorization."
            ),
            "insights": [
                "Electronics, Wallets, and Bags typically have the highest reported counts.",
                "Official documents usually have the fastest resolution and return times."
            ],
        },
        "summary": {
            "answer": (
                f"Here is your current system overview: You have {items_count} items logged, "
                f"{users_count} registered users, and {claims_count} claims submitted. "
                "Keeping an eye on these numbers helps you gauge platform adoption and workload."
            ),
            "insights": [
                f"Active Items: {items_count}",
                f"Registered Users: {users_count}",
                f"Total Claims: {claims_count}"
            ],
        },
        "match_report": {
            "answer": (
                "The Smart Match system pairs lost items with found items in the same category. "
                "To manually verify matches, look for items with opposite statuses (one lost, one found) "
                "in the same category that were reported within a few days of each other."
            ),
            "insights": [
                "Items in the same category reported within 7 days of each other are highly likely to be matches.",
                "A location match alongside a category match boosts confidence significantly."
            ],
        },
        "resolved_report": {
            "answer": (
                "Resolved items are marked with a 'returned' status. "
                "Tracking how quickly items transition from reported to returned is a great metric "
                "for evaluating the efficiency of the platform."
            ),
            "insights": [
                "Tracking the average time-to-resolution per category can reveal operational bottlenecks.",
                "Items returned quickly indicate an effective claim verification process."
            ],
        },
        "general": {
            "answer": (
                f"I understood your query as: \"{query}\". "
                f"Currently, the system is managing {items_count} items, {users_count} users, and {claims_count} claims. "
                "I can help you analyze high-risk claims, aging items, category breakdowns, user activity, or provide a general summary."
            ),
            "insights": [
                "Tip: Use specific keywords like 'fraud', 'unclaimed', 'summary', 'claims', or 'users' to get better insights."
            ],
        },
    }

    return responses.get(intent, responses["general"])


async def process_admin_query(
    query: str, available_data: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Process natural language admin queries and generate actionable insights.
    No external API required — uses rule-based intent detection.
    """
    if available_data is None:
        available_data = {}

    intent = _detect_intent(query)
    return _build_response(intent, query, available_data)
