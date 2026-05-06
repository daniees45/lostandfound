"""Notification Prioritization - Prioritizes notifications by urgency/impact"""
from typing import Dict, List, Any
from datetime import datetime


def calculate_priority_score(
    notification: Dict[str, Any], context: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Calculate priority score for a notification based on:
    - Event type (match, claim, pickup, expiry)
    - Item value/importance
    - User engagement history
    - Time sensitivity
    """
    if context is None:
        context = {}

    score = 50  # Base score

    # Event type weights
    event_type_weights = {
        "high_confidence_match": 95,  # Matches are most important
        "claim_submission": 80,
        "claim_approval": 75,
        "claim_rejection": 70,
        "pickup_ready": 85,
        "pickup_expiry_warning": 90,  # Time sensitive
        "item_expiring": 80,  # Getting old
        "message_received": 60,
    }

    event_type = notification.get("event_type", "message_received")
    score = event_type_weights.get(event_type, 50)

    # Boost for high-value items
    item_category = notification.get("item_category", "")
    if item_category in ["Electronics", "Documents", "ID/Card"]:
        score += 5

    # Boost if user is actively engaged
    user_recent_activity = context.get("user_recent_activity_days", 30)
    if user_recent_activity < 3:
        score += 10
    elif user_recent_activity > 30:
        score -= 10

    # Boost if time-sensitive (expiry warning)
    if "expiry" in event_type.lower() or "warning" in event_type.lower():
        score += 15

    # Reduce score if user has many unread notifications
    unread_count = context.get("unread_count", 0)
    if unread_count > 5:
        score -= 5

    score = max(1, min(100, score))

    return {
        "priority_score": score,
        "priority_level": "critical"
        if score >= 85
        else "high"
        if score >= 70
        else "medium"
        if score >= 50
        else "low",
        "send_immediately": score >= 75,
        "include_in_digest": True,
        "estimated_delivery_priority": max(1, int(score / 20)),  # 1-5
    }


async def prioritize_notifications(
    notifications: List[Dict[str, Any]], user_context: Dict[str, Any] = None
) -> List[Dict[str, Any]]:
    """
    Prioritize a batch of notifications.
    Returns sorted list with priority scores.
    """
    if user_context is None:
        user_context = {}

    prioritized = []

    for notification in notifications:
        priority_info = calculate_priority_score(notification, user_context)
        notification_with_priority = {**notification, **priority_info}
        prioritized.append(notification_with_priority)

    # Sort by priority_score descending
    prioritized.sort(key=lambda x: x["priority_score"], reverse=True)

    return prioritized


def group_notifications_by_priority(
    notifications: List[Dict[str, Any]],
) -> Dict[str, List[Dict[str, Any]]]:
    """Group notifications by priority level"""
    grouped = {"critical": [], "high": [], "medium": [], "low": []}

    for notif in notifications:
        level = notif.get("priority_level", "low")
        if level in grouped:
            grouped[level].append(notif)

    return grouped
