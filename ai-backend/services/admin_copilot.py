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
                "To find high-risk claims, filter the Claims table by status='pending' "
                "and sort by created_at ascending (oldest unresolved first). "
                "Also flag claimants whose proof_description is fewer than 20 words."
            ),
            "suggested_query": (
                "SELECT * FROM claims WHERE status='pending' "
                "ORDER BY created_at ASC LIMIT 20;"
            ),
            "insights": [
                "Claims with very short proof descriptions are higher risk",
                "Look for the same user_id appearing in multiple pending claims",
                "Items unclaimed for > 30 days with no approved claims may indicate fraud attempts",
            ],
        },
        "aging_items": {
            "answer": (
                f"You currently have {items_count} total items. "
                "Items with status 'lost' or 'found' that are older than 14 days "
                "should be reviewed for follow-up or archival."
            ),
            "suggested_query": (
                "SELECT id, title, status, created_at FROM items "
                "WHERE status IN ('lost','found') "
                "AND created_at < NOW() - INTERVAL '14 days' "
                "ORDER BY created_at ASC;"
            ),
            "insights": [
                "Items older than 30 days with no claims are prime archive candidates",
                "Consider sending reminder emails to reporters of aging items",
            ],
        },
        "claim_report": {
            "answer": (
                f"There are {claims_count} claims in the system. "
                "Pending claims need review. "
                "Approve claims that have detailed proof descriptions (>30 words) "
                "with specific identifying information."
            ),
            "suggested_query": (
                "SELECT c.*, i.title, p.email FROM claims c "
                "JOIN items i ON c.item_id=i.id "
                "JOIN profiles p ON c.claimant_id=p.id "
                "WHERE c.status='pending' ORDER BY c.created_at ASC;"
            ),
            "insights": [
                "Prioritize claims with longest, most detailed proof descriptions",
                f"Total claims: {claims_count}",
            ],
        },
        "user_report": {
            "answer": (
                f"There are {users_count} registered users. "
                "Check for newly registered users with multiple claims as a fraud signal."
            ),
            "suggested_query": (
                "SELECT p.id, p.email, p.role, p.created_at, "
                "COUNT(c.id) AS claim_count FROM profiles p "
                "LEFT JOIN claims c ON c.claimant_id=p.id "
                "GROUP BY p.id ORDER BY claim_count DESC LIMIT 20;"
            ),
            "insights": [
                f"Total registered users: {users_count}",
                "Users with role='student' make up the majority of claimants",
            ],
        },
        "category_analysis": {
            "answer": (
                f"With {items_count} total items, run the category breakdown query below "
                "to see which categories have the most activity."
            ),
            "suggested_query": (
                "SELECT category, status, COUNT(*) AS count FROM items "
                "GROUP BY category, status ORDER BY count DESC;"
            ),
            "insights": [
                "Electronics and Bags typically have the highest item counts",
                "Documents items have the fastest resolution times",
            ],
        },
        "summary": {
            "answer": (
                f"System overview: {items_count} items, {users_count} users, "
                f"{claims_count} claims. "
                "Check the stats strip on the admin dashboard for live figures."
            ),
            "suggested_query": (
                "SELECT "
                "(SELECT COUNT(*) FROM items) AS items, "
                "(SELECT COUNT(*) FROM profiles) AS users, "
                "(SELECT COUNT(*) FROM claims WHERE status='pending') AS pending_claims;"
            ),
            "insights": [
                f"Items: {items_count}",
                f"Users: {users_count}",
                f"Claims: {claims_count}",
            ],
        },
        "match_report": {
            "answer": (
                "Smart Match pairs lost items with found items in the same category. "
                "Query items with opposite statuses in the same category and sort by created_at proximity."
            ),
            "suggested_query": (
                "SELECT l.id AS lost_id, l.title AS lost_title, "
                "f.id AS found_id, f.title AS found_title, l.category "
                "FROM items l JOIN items f ON l.category=f.category "
                "WHERE l.status='lost' AND f.status='found' "
                "ORDER BY ABS(EXTRACT(EPOCH FROM (l.created_at - f.created_at))) ASC "
                "LIMIT 10;"
            ),
            "insights": [
                "Items in the same category reported within 7 days are likely matches",
                "Location match boosts confidence significantly",
            ],
        },
        "resolved_report": {
            "answer": (
                "Resolved items have status='returned'. "
                "Run the query below to see recently resolved cases."
            ),
            "suggested_query": (
                "SELECT i.title, i.category, i.location, i.created_at, "
                "cl.created_at AS resolved_at "
                "FROM items i JOIN custody_logs cl ON cl.item_id=i.id "
                "WHERE i.status='returned' ORDER BY cl.created_at DESC LIMIT 20;"
            ),
            "insights": [
                "Track average time-to-resolution per category",
                "Items returned quickly indicate effective claim verification",
            ],
        },
        "general": {
            "answer": (
                f"Query received: \"{query}\". "
                f"System has {items_count} items, {users_count} users, {claims_count} claims. "
                "Try asking about: high-risk claims, aging items, category breakdown, "
                "user activity, or today's summary."
            ),
            "suggested_query": "SELECT * FROM items ORDER BY created_at DESC LIMIT 10;",
            "insights": [
                "Use specific keywords like 'fraud', 'unclaimed', 'summary', 'claims', or 'users'",
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
