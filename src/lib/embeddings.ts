export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small";

  if (!apiKey || !text.trim()) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text,
        dimensions: 384,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const responseText = await response.text();
    
    // If response is HTML (error page), return null
    if (responseText.startsWith("<")) {
      return null;
    }

    const data = JSON.parse(responseText);
    const embedding = data?.data?.[0]?.embedding;

    if (!Array.isArray(embedding)) {
      return null;
    }

    return embedding as number[];
  } catch {
    return null;
  }
}

export function toPgVectorLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}