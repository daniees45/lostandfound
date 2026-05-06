# Lost & Found AI Services Backend

Python-based microservice providing 12 AI-powered features for the Lost & Found system.

## Features

1. **Smart Match Suggestion** - Links lost & found items using embeddings + metadata
2. **AI Claim Credibility Assistant** - Scores claim specificity and consistency
3. **Chat Safety + PII Guard** - Detects unsafe content and sensitive information
4. **Evidence Question Generator** - Generates tailored verification questions
5. **Vision Tagging** - Extracts metadata from images (color, brand, condition)
6. **Duplicate Report Detection** - Identifies similar/duplicate reports
7. **Notification Prioritization** - Prioritizes notifications by urgency
8. **Admin Copilot** - Natural language admin query processor
9. **Pickup Fraud Risk Scoring** - Assesses fraud risk before item release
10. **Smart Search Rewriter** - Converts natural language to structured search
11. **Auto-Summarized Item Cards** - Generates concise standardized summaries
12. **Multilingual Report Support** - Translates and normalizes reports

## Setup

### Requirements
- Python 3.9+
- pip

### Installation

```bash
cd ai-backend
chmod +x setup.sh
./setup.sh
```

This will:
1. Create a Python virtual environment
2. Install all dependencies
3. Create `.env` file from template

### Configuration

Edit `ai-backend/.env`:

```env
OPENAI_API_KEY=sk-your-key-here
OPENAI_TAG_MODEL=gpt-4-mini
OPENAI_EMBED_MODEL=text-embedding-3-small
AI_SERVICE_PORT=8000
```

## Running the Service

```bash
cd ai-backend
./run.sh
```

Or manually:

```bash
cd ai-backend
source venv/bin/activate
python main.py
```

The service will start at `http://localhost:8000`

### Health Check

```bash
curl http://localhost:8000/health
```

### API Documentation

Once running, visit `http://localhost:8000/docs` for interactive Swagger UI.

## API Endpoints

### Smart Match
```
POST /api/smart-match
Body: {
  new_item: Item,
  existing_items: Item[],
  new_item_embedding: number[],
  existing_embeddings: number[][],
  top_n: number
}
```

### Claim Credibility
```
POST /api/claim-credibility
Body: {
  claim_description: string,
  item_type: string,
  item_details: string
}
```

### Chat Safety
```
POST /api/chat-safety
Body: {
  message: string
}
```

### Evidence Questions
```
POST /api/evidence-questions
Body: {
  item_type: string,
  item_details: string
}
```

### Vision Tagging (URL)
```
POST /api/vision-tagging-url
Body: {
  image_url: string
}
```

### Duplicate Detection
```
POST /api/duplicate-detection
Body: {
  new_report: Item,
  existing_reports: Item[],
  new_embedding: number[],
  existing_embeddings: number[][],
  threshold: number
}
```

### Notification Priority
```
POST /api/notification-priority
Body: {
  notifications: object[],
  user_context?: object
}
```

### Admin Copilot
```
POST /api/admin-copilot
Body: {
  query: string,
  available_data?: object
}
```

### Pickup Fraud Assessment
```
POST /api/pickup-fraud-assessment
Body: {
  claim_id: string,
  claim_data: object,
  claimant_data: object,
  interaction_context: object
}
```

### Search Rewriter
```
POST /api/search-rewrite
Body: {
  query: string
}
```

### Item Summary
```
POST /api/item-summary
Body: {
  item_details: object
}
```

### Translation
```
POST /api/translate
Body: {
  text: string,
  target_language: string
}
```

### Normalize Report
```
POST /api/normalize-report
Body: {
  item_report: object
}
```

### Supported Languages
```
GET /api/supported-languages
```

## Integration with Next.js

The client library is available at `src/lib/ai-service-client.ts`:

```typescript
import {
  getSmartMatches,
  assessClaimCredibility,
  checkMessageSafety,
  // ... other functions
} from "@/lib/ai-service-client";

// Use in server actions or API routes
const matches = await getSmartMatches(newItem, existing, embedding1, embeddings2);
```

## Architecture

```
ai-backend/
├── main.py              # FastAPI server
├── services/
│   ├── smart_match.py
│   ├── claim_credibility.py
│   ├── chat_safety.py
│   ├── evidence_questions.py
│   ├── vision_tagging.py
│   ├── duplicate_detection.py
│   ├── notification_priority.py
│   ├── admin_copilot.py
│   ├── pickup_fraud.py
│   ├── search_rewriter.py
│   ├── item_summary.py
│   └── multilingual.py
├── requirements.txt
├── .env.example
├── setup.sh
└── run.sh
```

## Development

### Testing a Specific Endpoint

```bash
curl -X POST http://localhost:8000/api/chat-safety \
  -H "Content-Type: application/json" \
  -d '{"message": "Here is my phone: 555-123-4567"}'
```

### Adding New Features

1. Create new service module in `services/`
2. Implement async function
3. Add Pydantic model in `main.py`
4. Add endpoint in `main.py`
5. Export client function in `src/lib/ai-service-client.ts`

## Fallback Behavior

All services include fallback logic when OpenAI API is unavailable:
- Heuristic-based scoring replaces LLM analysis
- Regex patterns for basic detection
- Template-based responses

This ensures the system remains functional even without API keys.

## Error Handling

All endpoints return:
- `200 OK` with `{success: true, result: ...}` on success
- `500 Internal Server Error` with error details on failure
- Empty/default results if AI processing fails

Errors are logged to console but don't crash the service.

## Performance Notes

- Vision API (gpt-4-vision) may be slower; consider async processing
- Embeddings are cached where possible
- All LLM calls use temperature 0.1-0.3 for consistency
- Batch operations supported for bulk processing

## Cost Optimization

Using gpt-4-mini (efficient) instead of gpt-4:
- ~80% cost savings
- Adequate performance for classification/extraction tasks
- Vision tasks still require gpt-4-vision

Monitor usage in OpenAI dashboard.

## Troubleshooting

**Port 8000 already in use:**
```bash
lsof -i :8000
kill -9 <PID>
```

**Import errors:**
```bash
source venv/bin/activate
pip install -r requirements.txt
```

**CORS errors:**
Update allowed origins in `main.py` CORS middleware.

**API not responding:**
Check `.env` file exists and AI_SERVICE_URL is correct in `.env.local`.
