"""Chat Safety + PII Guard - Detects unsafe content and sensitive information"""
import re
from typing import Dict, Any, List, Tuple


# Patterns for sensitive information detection
PII_PATTERNS = {
    "phone": r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",
    "email": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
    "ssn": r"\b\d{3}-\d{2}-\d{4}\b",
    "credit_card": r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b",
    "url": r"https?://[^\s]+",
}

# Patterns for unsafe content
UNSAFE_PATTERNS = {
    "threat": r"\b(kill|hurt|harm|assault|attack|threat|revenge)\b",
    "harassment": r"\b(hate|stupid|idiot|moron|racist|sexist)\b",
    "solicitation": r"\b(buy|sell|price|money|payment|crypto|bitcoin)\b",
    "contact_attempt": r"\b(phone|call|text|whatsapp|telegram|snapchat|discord)\b",
}


def detect_pii(text: str) -> Dict[str, List[str]]:
    """Detect personally identifiable information in text"""
    detected_pii = {}

    for pii_type, pattern in PII_PATTERNS.items():
        matches = re.findall(pattern, text)
        if matches:
            detected_pii[pii_type] = list(set(matches))

    return detected_pii


def detect_unsafe_content(text: str) -> Dict[str, List[str]]:
    """Detect potentially unsafe content (threats, harassment, etc.)"""
    unsafe_content = {}

    for content_type, pattern in UNSAFE_PATTERNS.items():
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            unsafe_content[content_type] = list(set([m.lower() for m in matches]))

    return unsafe_content


def redact_text(text: str, pii_dict: Dict[str, List[str]]) -> str:
    """Redact sensitive information from text"""
    redacted = text

    for pii_type, values in pii_dict.items():
        for value in values:
            redacted = redacted.replace(value, f"[{pii_type.upper()}_REDACTED]")

    return redacted


async def check_message_safety(message: str) -> Dict[str, Any]:
    """
    Comprehensive safety check for a chat message.
    Returns structured feedback on PII, unsafe content, and recommendations.
    """

    pii_found = detect_pii(message)
    unsafe_found = detect_unsafe_content(message)

    is_safe = len(pii_found) == 0 and len(unsafe_found) == 0
    risk_level = "low" if is_safe else "medium" if len(pii_found) > 0 else "high"

    redacted_message = redact_text(message, pii_found) if pii_found else message

    warnings = []
    suggestions = []

    if pii_found:
        risk_level = "high"
        pii_types = ", ".join(pii_found.keys())
        warnings.append(f"Contains sensitive information: {pii_types}")
        suggestions.append("Do not share personal contact information publicly.")
        suggestions.append("Use the in-app messaging system instead of providing direct contact details.")

    if unsafe_found:
        risk_level = "high"
        content_types = ", ".join(unsafe_found.keys())
        warnings.append(f"Contains potentially unsafe content: {content_types}")
        suggestions.append("Please maintain respectful communication.")
        suggestions.append("Focus on item-related details only.")

    if len(message) > 500:
        risk_level = "medium" if risk_level == "low" else risk_level
        suggestions.append("Message is quite long - try to be concise.")

    return {
        "is_safe": is_safe,
        "risk_level": risk_level,
        "pii_detected": list(pii_found.keys()),
        "unsafe_content_detected": list(unsafe_found.keys()),
        "warnings": warnings,
        "suggestions": suggestions,
        "redacted_message": redacted_message if pii_found else None,
        "allow_send": is_safe or risk_level == "medium",
        "action": "block" if risk_level == "high" else "warn" if risk_level == "medium" else "allow",
    }
