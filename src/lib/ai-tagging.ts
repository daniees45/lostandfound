type TaggingInput = {
  title: string;
  description: string;
  category: string;
};

type TaggingResult = {
  category: string;
  tags: string[];
};

const AllowedCategories = ["Electronics", "Bags", "Documents", "Clothing", "Others"];

function normalizeCategory(category: string) {
  const matched = AllowedCategories.find(
    (value) => value.toLowerCase() === category.toLowerCase().trim()
  );
  return matched ?? "Others";
}

function uniqueTrimmed(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }

  return result.slice(0, 8);
}

function fallbackTagging(input: TaggingInput): TaggingResult {
  const text = `${input.title} ${input.description}`.toLowerCase();
  const tags: string[] = [];
  let category = normalizeCategory(input.category);

  if (/iphone|android|phone|airpods|headphones|charger|laptop|tablet|macbook/.test(text)) {
    category = "Electronics";
  }
  if (/bag|backpack|purse|wallet/.test(text)) {
    category = category === "Electronics" ? category : "Bags";
  }
  if (/id\s?card|student\s?id|passport|license|document|certificate/.test(text)) {
    category = "Documents";
  }
  if (/jacket|shirt|hoodie|trouser|shoe|sneaker|cloth/.test(text)) {
    category = category === "Documents" ? category : "Clothing";
  }

  if (/black/.test(text)) tags.push("Black");
  if (/blue/.test(text)) tags.push("Blue");
  if (/white/.test(text)) tags.push("White");
  if (/red/.test(text)) tags.push("Red");
  if (/green/.test(text)) tags.push("Green");
  if (/phone|iphone|android/.test(text)) tags.push("Phone");
  if (/laptop|macbook|notebook/.test(text)) tags.push("Laptop");
  if (/bag|backpack|purse/.test(text)) tags.push("Bag");
  if (/wallet/.test(text)) tags.push("Wallet");
  if (/id\s?card|student\s?id/.test(text)) tags.push("ID Card");

  return {
    category,
    tags: uniqueTrimmed(tags),
  };
}

function extractJsonObject(input: string) {
  const start = input.indexOf("{");
  const end = input.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return input.slice(start, end + 1);
}

export async function suggestTagsAndCategory(input: TaggingInput): Promise<TaggingResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_TAG_MODEL ?? "gpt-4.1-mini";

  if (!apiKey) {
    return fallbackTagging(input);
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content:
              "You classify lost-and-found reports. Return only strict JSON with keys category and tags. category must be one of: Electronics, Bags, Documents, Clothing, Others. tags must be an array of up to 8 concise strings.",
          },
          {
            role: "user",
            content: JSON.stringify(input),
          },
        ],
      }),
    });

    if (!response.ok) {
      return fallbackTagging(input);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (typeof content !== "string") {
      return fallbackTagging(input);
    }

    const jsonString = extractJsonObject(content);
    if (!jsonString) {
      return fallbackTagging(input);
    }

    const parsed = JSON.parse(jsonString) as { category?: string; tags?: string[] };
    const category = normalizeCategory(parsed.category ?? input.category);
    const tags = uniqueTrimmed(Array.isArray(parsed.tags) ? parsed.tags : []);

    return { category, tags };
  } catch {
    return fallbackTagging(input);
  }
}