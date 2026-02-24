type ResearchEvent =
  | { type: "question"; data: { questions: string; content?: string } }
  | { type: "progress"; data: { step?: number; total?: number; message: string } }
  | { type: "finding"; data: { title: string; url: string; snippet: string } }
  | { type: "report"; data: { content: string } }
  | { type: "sources"; data: { sources: string[] } }
  | { type: "done"; data: { success: boolean; key_findings?: string[]; sources?: string[]; phase?: string } }
  | { type: "error"; data: { error: string } };

export type ResearchCallback = {
  onQuestion?: (questions: string) => void;
  onProgress?: (step: number, total: number, message: string) => void;
  onFinding?: (finding: { title: string; url: string; snippet: string }) => void;
  onReport?: (chunk: string) => void;
  onSources?: (sources: string[]) => void;
  onDone?: (data: { success: boolean; key_findings?: string[]; sources?: string[]; phase?: string }) => void;
  onError?: (error: string) => void;
};

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ||
  "http://localhost:8001/api";

export async function streamResearch(
  query: string,
  history: Array<{ role: string; content: string }> = [],
  options: {
    signal?: AbortSignal;
  },
  callbacks: ResearchCallback
) {
  console.debug("streamResearch start", { api: `${API_BASE}/agents/research/stream`, query });

  const payload = {
    query,
    history,
    web: true,
  };

  const response = await fetch(`${API_BASE}/agents/research/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  if (!response.ok) {
    const text = await response.text();
    const msg = text || `Research request failed (${response.status})`;
    console.error("streamResearch http error", response.status, msg);
    callbacks.onError?.(msg);
    throw new Error(msg);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const msg = "Failed to read response stream";
    console.error("streamResearch no reader");
    callbacks.onError?.(msg);
    throw new Error(msg);
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        console.debug("Research stream ended");
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;

        try {
          const jsonStr = trimmed.replace(/^data:\s*/, "");
          const parsed = JSON.parse(jsonStr);
          console.debug("Research event parsed:", parsed.type, parsed.data);
          handleResearchEvent(parsed as ResearchEvent, callbacks);
        } catch (err) {
          // Ignore malformed chunks
          console.debug("Failed to parse research event", err, trimmed);
        }
      }
    }
  } catch (error) {
    console.error("Research stream error:", error);
    callbacks.onError?.(error instanceof Error ? error.message : String(error));
    throw error;
  }

  // Process remaining buffer
  if (buffer.trim()) {
    try {
      const parsed = JSON.parse(buffer.replace(/^data:\s*/, ""));
      handleResearchEvent(parsed as ResearchEvent, callbacks);
    } catch (err) {
      // Ignore
    }
  }
}

function handleResearchEvent(event: ResearchEvent, callbacks: ResearchCallback) {
  console.debug("Research event received:", event.type, event.data);
  switch (event.type) {
    case "question":
      const questionText = event.data.questions || event.data.content || "";
      console.debug("Question text:", questionText);
      callbacks.onQuestion?.(questionText);
      break;
    case "progress":
      callbacks.onProgress?.(
        event.data.step || 0,
        event.data.total || 0,
        event.data.message || ""
      );
      break;
    case "finding":
      callbacks.onFinding?.(event.data);
      break;
    case "report":
      callbacks.onReport?.(event.data.content || "");
      break;
    case "sources":
      callbacks.onSources?.(event.data.sources || []);
      break;
    case "done":
      callbacks.onDone?.(event.data);
      break;
    case "error":
      callbacks.onError?.(event.data.error || "Unknown error");
      break;
  }
}

export async function chatResearch(
  query: string,
  history: Array<{ role: string; content: string }> = [],
  options?: {
    signal?: AbortSignal;
  }
) {
  console.debug("chatResearch start", { api: `${API_BASE}/agents/research`, query });

  const payload = {
    query,
    history,
    web: true,
  };

  const response = await fetch(`${API_BASE}/agents/research`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: options?.signal,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Research request failed (${response.status})`);
  }

  return response.json();
}


