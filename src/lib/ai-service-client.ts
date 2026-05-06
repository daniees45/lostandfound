/**
 * AI Service Client - Calls Python backend AI services from Next.js
 */

const AI_SERVICE_URL = process.env.NEXT_PUBLIC_AI_SERVICE_URL || "http://localhost:8000";

// ==================== SMART MATCH ====================
export async function getSmartMatches(
  newItem: {
    id: string;
    title: string;
    description: string;
    category: string;
    location: string;
    status: string;
    created_at: string;
  },
  existingItems: any[],
  newItemEmbedding: number[],
  existingEmbeddings: number[][]
) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/smart-match`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        new_item: newItem,
        existing_items: existingItems,
        new_item_embedding: newItemEmbedding,
        existing_embeddings: existingEmbeddings,
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.matches || [];
  } catch (error) {
    console.error("Smart match error:", error);
    return [];
  }
}

// ==================== CLAIM CREDIBILITY ====================
export async function assessClaimCredibility(
  claimDescription: string,
  itemType: string,
  itemDetails: string
) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/claim-credibility`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim_description: claimDescription,
        item_type: itemType,
        item_details: itemDetails,
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.assessment || null;
  } catch (error) {
    console.error("Claim credibility error:", error);
    return null;
  }
}

// ==================== CHAT SAFETY ====================
export async function checkMessageSafety(message: string) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/chat-safety`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.safety_check || null;
  } catch (error) {
    console.error("Chat safety error:", error);
    return null;
  }
}

// ==================== EVIDENCE QUESTIONS ====================
export async function getEvidenceQuestions(itemType: string, itemDetails: string) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/evidence-questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_type: itemType,
        item_details: itemDetails,
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.questions || null;
  } catch (error) {
    console.error("Evidence questions error:", error);
    return null;
  }
}

// ==================== VISION TAGGING ====================
export async function extractTagsFromImageUrl(imageUrl: string) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/vision-tagging-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: imageUrl }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.tags || null;
  } catch (error) {
    console.error("Vision tagging error:", error);
    return null;
  }
}

// ==================== DUPLICATE DETECTION ====================
export async function detectDuplicates(
  newReport: any,
  existingReports: any[],
  newEmbedding: number[],
  existingEmbeddings: number[][]
) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/duplicate-detection`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        new_report: newReport,
        existing_reports: existingReports,
        new_embedding: newEmbedding,
        existing_embeddings: existingEmbeddings,
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.detection || null;
  } catch (error) {
    console.error("Duplicate detection error:", error);
    return null;
  }
}

// ==================== NOTIFICATION PRIORITY ====================
export async function prioritizeNotifications(
  notifications: any[],
  userContext?: any
) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/notification-priority`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        notifications,
        user_context: userContext,
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.prioritized_notifications || [];
  } catch (error) {
    console.error("Notification priority error:", error);
    return notifications;
  }
}

// ==================== ADMIN COPILOT ====================
export async function processAdminQuery(query: string, availableData?: any) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/admin-copilot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        available_data: availableData,
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.response || null;
  } catch (error) {
    console.error("Admin copilot error:", error);
    return null;
  }
}

// ==================== PICKUP FRAUD ====================
export async function assessPickupFraud(
  claimId: string,
  claimData: any,
  claimantData: any,
  interactionContext: any
) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/pickup-fraud-assessment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim_id: claimId,
        claim_data: claimData,
        claimant_data: claimantData,
        interaction_context: interactionContext,
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.assessment || null;
  } catch (error) {
    console.error("Pickup fraud assessment error:", error);
    return null;
  }
}

// ==================== SEARCH REWRITER ====================
export async function rewriteSearchQuery(query: string) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/search-rewrite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.rewritten_query || null;
  } catch (error) {
    console.error("Search rewrite error:", error);
    return null;
  }
}

// ==================== ITEM SUMMARY ====================
export async function generateItemSummary(itemDetails: any) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/item-summary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_details: itemDetails }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.summary || null;
  } catch (error) {
    console.error("Item summary error:", error);
    return null;
  }
}

// ==================== TRANSLATION ====================
export async function translateText(text: string, targetLanguage = "en") {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        target_language: targetLanguage,
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.result || null;
  } catch (error) {
    console.error("Translation error:", error);
    return null;
  }
}

// ==================== NORMALIZE REPORT ====================
export async function normalizeMultilingualReport(itemReport: any) {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/normalize-report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_report: itemReport }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.normalized_report || null;
  } catch (error) {
    console.error("Report normalization error:", error);
    return null;
  }
}

// ==================== SUPPORTED LANGUAGES ====================
export async function getSupportedLanguages() {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/api/supported-languages`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.languages || [];
  } catch (error) {
    console.error("Supported languages error:", error);
    return [];
  }
}

// ==================== HEALTH CHECK ====================
export async function checkAIServiceHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${AI_SERVICE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
