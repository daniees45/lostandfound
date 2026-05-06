"""FastAPI server for Lost & Found AI services"""
import os
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import all services
from services import (
    smart_match,
    claim_credibility,
    chat_safety,
    evidence_questions,
    vision_tagging,
    duplicate_detection,
    notification_priority,
    admin_copilot,
    pickup_fraud,
    search_rewriter,
    item_summary,
    multilingual,
)

app = FastAPI(title="Lost & Found AI Services", version="1.0.0")

# CORS configuration
# ALLOWED_ORIGINS env var lets you set production URLs at deploy time (comma-separated).
# Defaults to localhost for local dev.
_raw_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:3001")
ALLOWED_ORIGINS = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== REQUEST MODELS ====================
class Item(BaseModel):
    id: str
    title: str
    description: str
    category: str
    location: str
    status: str
    created_at: str
    image_url: Optional[str] = None


class SmartMatchRequest(BaseModel):
    new_item: Item
    existing_items: List[Item]
    new_item_embedding: List[float]
    existing_embeddings: List[List[float]]
    top_n: int = 3


class ClaimCredibilityRequest(BaseModel):
    claim_description: str
    item_type: str
    item_details: str


class MessageSafetyRequest(BaseModel):
    message: str


class EvidenceQuestionsRequest(BaseModel):
    item_type: str
    item_details: str


class VisionTaggingRequest(BaseModel):
    image_path: str


class VisionTaggingUrlRequest(BaseModel):
    image_url: str


class DuplicateDetectionRequest(BaseModel):
    new_report: Item
    existing_reports: List[Item]
    new_embedding: List[float]
    existing_embeddings: List[List[float]]
    threshold: float = 0.65


class NotificationPrioritizationRequest(BaseModel):
    notifications: List[Dict[str, Any]]
    user_context: Optional[Dict[str, Any]] = None


class AdminQueryRequest(BaseModel):
    query: str
    available_data: Optional[Dict[str, Any]] = None


class PickupFraudRequest(BaseModel):
    claim_id: str
    claim_data: Dict[str, Any]
    claimant_data: Dict[str, Any]
    interaction_context: Dict[str, Any]


class SearchQueryRequest(BaseModel):
    query: str


class ItemSummaryRequest(BaseModel):
    item_details: Dict[str, Any]


class TranslationRequest(BaseModel):
    text: str
    target_language: str = "en"


class ReportNormalizationRequest(BaseModel):
    item_report: Dict[str, Any]


# ==================== HEALTH CHECK ====================
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "Lost & Found AI Services",
        "version": "1.0.0",
    }


# ==================== SMART MATCH ENDPOINT ====================
@app.post("/api/smart-match")
async def endpoint_smart_match(request: SmartMatchRequest):
    """Find smart matches for lost/found items"""
    try:
        matches = await smart_match.find_smart_matches(
            request.new_item,
            request.existing_items,
            request.new_item_embedding,
            request.existing_embeddings,
            request.top_n,
        )
        return {"success": True, "matches": matches}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CLAIM CREDIBILITY ENDPOINT ====================
@app.post("/api/claim-credibility")
async def endpoint_claim_credibility(request: ClaimCredibilityRequest):
    """Assess claim credibility"""
    try:
        assessment = await claim_credibility.assess_claim_credibility(
            request.claim_description, request.item_type, request.item_details
        )
        return {"success": True, "assessment": assessment}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== CHAT SAFETY ENDPOINT ====================
@app.post("/api/chat-safety")
async def endpoint_chat_safety(request: MessageSafetyRequest):
    """Check message safety"""
    try:
        safety_check = await chat_safety.check_message_safety(request.message)
        return {"success": True, "safety_check": safety_check}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== EVIDENCE QUESTIONS ENDPOINT ====================
@app.post("/api/evidence-questions")
async def endpoint_evidence_questions(request: EvidenceQuestionsRequest):
    """Generate evidence questions"""
    try:
        questions = await evidence_questions.generate_evidence_questions(
            request.item_type, request.item_details
        )
        return {"success": True, "questions": questions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== VISION TAGGING ENDPOINTS ====================
@app.post("/api/vision-tagging")
async def endpoint_vision_tagging(request: VisionTaggingRequest):
    """Extract tags from local image"""
    try:
        tags = await vision_tagging.extract_tags_from_image(request.image_path)
        return {"success": True, "tags": tags}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/vision-tagging-url")
async def endpoint_vision_tagging_url(request: VisionTaggingUrlRequest):
    """Extract tags from image URL"""
    try:
        tags = await vision_tagging.extract_tags_from_url(request.image_url)
        return {"success": True, "tags": tags}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== DUPLICATE DETECTION ENDPOINT ====================
@app.post("/api/duplicate-detection")
async def endpoint_duplicate_detection(request: DuplicateDetectionRequest):
    """Detect duplicate reports"""
    try:
        detection = await duplicate_detection.detect_duplicates(
            request.new_report,
            request.existing_reports,
            request.new_embedding,
            request.existing_embeddings,
            request.threshold,
        )
        return {"success": True, "detection": detection}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== NOTIFICATION PRIORITIZATION ENDPOINT ====================
@app.post("/api/notification-priority")
async def endpoint_notification_priority(request: NotificationPrioritizationRequest):
    """Prioritize notifications"""
    try:
        prioritized = await notification_priority.prioritize_notifications(
            request.notifications, request.user_context
        )
        return {"success": True, "prioritized_notifications": prioritized}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ADMIN COPILOT ENDPOINT ====================
@app.post("/api/admin-copilot")
async def endpoint_admin_copilot(request: AdminQueryRequest):
    """Process admin queries"""
    try:
        response = await admin_copilot.process_admin_query(
            request.query, request.available_data
        )
        return {"success": True, "response": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== PICKUP FRAUD ENDPOINT ====================
@app.post("/api/pickup-fraud-assessment")
async def endpoint_pickup_fraud(request: PickupFraudRequest):
    """Assess pickup fraud risk"""
    try:
        assessment = await pickup_fraud.assess_pickup_safety(
            request.claim_id,
            request.claim_data,
            request.claimant_data,
            request.interaction_context,
        )
        return {"success": True, "assessment": assessment}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== SEARCH REWRITER ENDPOINT ====================
@app.post("/api/search-rewrite")
async def endpoint_search_rewrite(request: SearchQueryRequest):
    """Rewrite search query"""
    try:
        rewritten = await search_rewriter.rewrite_search_query(request.query)
        return {"success": True, "rewritten_query": rewritten}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ITEM SUMMARY ENDPOINT ====================
@app.post("/api/item-summary")
async def endpoint_item_summary(request: ItemSummaryRequest):
    """Generate item summary"""
    try:
        summary = await item_summary.generate_item_summary(request.item_details)
        return {"success": True, "summary": summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== TRANSLATION ENDPOINT ====================
@app.post("/api/translate")
async def endpoint_translate(request: TranslationRequest):
    """Translate text"""
    try:
        result = await multilingual.detect_and_translate(
            request.text, request.target_language
        )
        return {"success": True, "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== REPORT NORMALIZATION ENDPOINT ====================
@app.post("/api/normalize-report")
async def endpoint_normalize_report(request: ReportNormalizationRequest):
    """Normalize multilingual report"""
    try:
        normalized = await multilingual.normalize_report(request.item_report)
        return {"success": True, "normalized_report": normalized}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== SUPPORTED LANGUAGES ENDPOINT ====================
@app.get("/api/supported-languages")
async def get_supported_languages():
    """Get list of supported languages"""
    try:
        languages = multilingual.get_supported_languages()
        return {"success": True, "languages": languages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn

    # Render injects PORT; fall back to AI_SERVICE_PORT for local dev
    port = int(os.getenv("PORT", os.getenv("AI_SERVICE_PORT", "8000")))
    uvicorn.run(app, host="0.0.0.0", port=port)
