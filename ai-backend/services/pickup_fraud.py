"""Pickup Fraud Risk Scoring - Assesses fraud risk before item release"""
from typing import Dict, List, Any
from datetime import datetime, timedelta


def calculate_fraud_risk_score(
    claim: Dict[str, Any], claimant_history: Dict[str, Any] = None, context: Dict[str, Any] = None
) -> Dict[str, Any]:
    """
    Calculate fraud risk score for pickup request.
    Factors:
    - Claim specificity/credibility
    - Claimant account age & history
    - Chat interaction pattern
    - Failed attempts
    - Verification completion
    """

    if claimant_history is None:
        claimant_history = {}
    if context is None:
        context = {}

    risk = 0  # Lower is better

    # Claim credibility (0-30 points)
    credibility = claim.get("credibility_score", 50)  # 0-100
    if credibility < 40:
        risk += 25
    elif credibility < 60:
        risk += 15
    elif credibility < 80:
        risk += 5

    # Account age (0-30 points)
    account_age_days = claimant_history.get("account_age_days", 0)
    if account_age_days < 7:
        risk += 25
    elif account_age_days < 30:
        risk += 15
    elif account_age_days < 90:
        risk += 5

    # Failed claims history (0-20 points)
    failed_claims = claimant_history.get("failed_claims_count", 0)
    if failed_claims > 2:
        risk += 20
    elif failed_claims > 1:
        risk += 10
    elif failed_claims == 1:
        risk += 5

    # Chat engagement (0-10 points)
    chat_messages = context.get("chat_message_count", 0)
    if chat_messages == 0:
        risk += 10
    elif chat_messages < 3:
        risk += 5

    # Previous successful pickups (reduces risk)
    successful_pickups = claimant_history.get("successful_pickups_count", 0)
    if successful_pickups > 3:
        risk = max(0, risk - 10)

    # Response time to evidence questions (lower time = higher risk)
    response_time_hours = context.get("evidence_response_time_hours", 48)
    if response_time_hours < 1:
        risk += 5  # Too fast = suspicious
    elif response_time_hours > 48:
        risk -= 5  # Delayed but engaged

    # Evidence completeness
    evidence_sections_completed = context.get("evidence_sections_completed", 0)
    if evidence_sections_completed < 2:
        risk += 10
    elif evidence_sections_completed >= 4:
        risk = max(0, risk - 5)

    # Cap risk score
    risk = max(0, min(100, risk))

    return {
        "fraud_risk_score": risk,
        "risk_level": "critical" if risk >= 70 else "high" if risk >= 50 else "medium" if risk >= 30 else "low",
        "approval_status": "manual_review" if risk >= 60 else "verify_then_release" if risk >= 30 else "approve",
        "recommended_action": "require_additional_verification"
        if risk >= 60
        else "verify_identity"
        if risk >= 30
        else "proceed_with_pickup",
        "risk_factors": {
            "credibility_concern": credibility < 60,
            "new_account": account_age_days < 30,
            "claim_failure_history": failed_claims > 0,
            "low_engagement": chat_messages < 3,
            "incomplete_evidence": evidence_sections_completed < 3,
        },
    }


async def assess_pickup_safety(
    claim_id: str,
    claim_data: Dict[str, Any],
    claimant_data: Dict[str, Any],
    interaction_context: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Comprehensive pickup safety assessment.
    """

    risk_assessment = calculate_fraud_risk_score(claim_data, claimant_data, interaction_context)

    return {
        **risk_assessment,
        "claim_id": claim_id,
        "timestamp": datetime.now().isoformat(),
        "requires_manual_review": risk_assessment["fraud_risk_score"] >= 60,
        "allowed_to_proceed": risk_assessment["fraud_risk_score"] < 60,
        "notes": generate_risk_notes(risk_assessment),
    }


def generate_risk_notes(risk_assessment: Dict[str, Any]) -> str:
    """Generate human-readable risk notes"""
    notes = []

    if risk_assessment["risk_factors"]["credibility_concern"]:
        notes.append("Claim lacked specific details")

    if risk_assessment["risk_factors"]["new_account"]:
        notes.append("New account (less than 30 days)")

    if risk_assessment["risk_factors"]["claim_failure_history"]:
        notes.append("Previous failed claims on record")

    if risk_assessment["risk_factors"]["low_engagement"]:
        notes.append("Limited chat interaction")

    if risk_assessment["risk_factors"]["incomplete_evidence"]:
        notes.append("Evidence questions not fully completed")

    return " | ".join(notes) if notes else "Low risk - standard verification sufficient"
