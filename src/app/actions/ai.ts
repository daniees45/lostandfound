"use server";

import {
  getSmartMatches,
  assessClaimCredibility,
  getEvidenceQuestions,
  extractTagsFromImageUrl,
  detectDuplicates,
  prioritizeNotifications,
  processAdminQuery,
  assessPickupFraud,
  rewriteSearchQuery,
  generateItemSummary,
  normalizeMultilingualReport,
} from "@/lib/ai-service-client";

export async function aiSmartMatchSuggestion(input: {
  newItem: {
    id: string;
    title: string;
    description: string;
    category: string;
    location: string;
    status: string;
    created_at: string;
  };
  existingItems: Array<Record<string, unknown>>;
  newItemEmbedding: number[];
  existingEmbeddings: number[][];
}) {
  return getSmartMatches(
    input.newItem,
    input.existingItems,
    input.newItemEmbedding,
    input.existingEmbeddings
  );
}

export async function aiClaimCredibilityAssistant(input: {
  claimDescription: string;
  itemType: string;
  itemDetails: string;
}) {
  return assessClaimCredibility(input.claimDescription, input.itemType, input.itemDetails);
}

export async function aiEvidenceQuestionGenerator(input: {
  itemType: string;
  itemDetails: string;
}) {
  return getEvidenceQuestions(input.itemType, input.itemDetails);
}

export async function aiVisionTaggingFromUploadedPhotos(input: { imageUrl: string }) {
  return extractTagsFromImageUrl(input.imageUrl);
}

export async function aiDuplicateReportDetection(input: {
  newReport: Record<string, unknown>;
  existingReports: Array<Record<string, unknown>>;
  newEmbedding: number[];
  existingEmbeddings: number[][];
}) {
  return detectDuplicates(
    input.newReport,
    input.existingReports,
    input.newEmbedding,
    input.existingEmbeddings
  );
}

export async function aiNotificationPrioritization(input: {
  notifications: Array<Record<string, unknown>>;
  userContext?: Record<string, unknown>;
}) {
  return prioritizeNotifications(input.notifications, input.userContext);
}

export async function aiAdminCopilot(input: {
  query: string;
  availableData?: Record<string, unknown>;
}) {
  return processAdminQuery(input.query, input.availableData);
}

export async function aiPickupFraudRiskScoring(input: {
  claimId: string;
  claimData: Record<string, unknown>;
  claimantData: Record<string, unknown>;
  interactionContext: Record<string, unknown>;
}) {
  return assessPickupFraud(
    input.claimId,
    input.claimData,
    input.claimantData,
    input.interactionContext
  );
}

export async function aiSmartSearchRewriter(input: { query: string }) {
  return rewriteSearchQuery(input.query);
}

export async function aiAutoSummarizedItemCards(input: {
  itemDetails: Record<string, unknown>;
}) {
  return generateItemSummary(input.itemDetails);
}

export async function aiMultilingualReportSupport(input: {
  itemReport: Record<string, unknown>;
}) {
  return normalizeMultilingualReport(input.itemReport);
}
