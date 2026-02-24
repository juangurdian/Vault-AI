export type SearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: string;
};

type StreamEvent =
  | { type: "routing"; payload: Record<string, any> }
  | { type: "search_start"; payload: { query: string; reason?: string } }
  | { type: "search_results"; payload: { results: SearchResult[]; count: number } }
  | { type: "search_error"; payload: { error: string } }
  | { type: "delta"; text: string }
  | { type: "thinking_start"; payload: Record<string, any> }
  | { type: "thinking_delta"; text: string }
  | { type: "thinking_end"; payload: Record<string, any> }
  | { type: "tool_start"; payload: { name: string; args?: Record<string, any> } }
  | { type: "tool_result"; payload: { name: string; success: boolean; result_preview?: string } }
  | { type: "done"; payload: { success: boolean; model_used?: string | null; error?: string | null; web_search_used?: boolean; tools_used?: Array<{ name: string; args?: Record<string, any>; success?: boolean }>; sources?: string[] } };

export type StreamCallback = {
  onRouting?: (payload: Record<string, any>) => void;
  onSearchStart?: (payload: { query: string; reason?: string }) => void;
  onSearchResults?: (payload: { results: SearchResult[]; count: number }) => void;
  onSearchError?: (error: string) => void;
  onDelta?: (chunk: string) => void;
  onThinkingStart?: () => void;
  onThinkingDelta?: (chunk: string) => void;
  onThinkingEnd?: () => void;
  onToolStart?: (payload: { name: string; args?: Record<string, any> }) => void;
  onToolResult?: (payload: { name: string; success: boolean; result_preview?: string }) => void;
  onDone?: (payload: { success: boolean; model_used?: string | null; error?: string | null; web_search_used?: boolean; tools_used?: Array<{ name: string; args?: Record<string, any>; success?: boolean }>; sources?: string[] }) => void;
  onError?: (error: string) => void;
};

const API_BASE =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE) ||
  "http://localhost:8001/api";

export async function streamChat(
  messages: { role: string; content: string; images?: string[] }[],
  options: {
    model?: string;
    temperature?: number;
    top_p?: number;
    max_tokens?: number;
    signal?: AbortSignal;
    images?: string[];
    forceReasoning?: boolean;
  },
  callbacks: StreamCallback
) {
  console.debug("streamChat start", { api: `${API_BASE}/chat/stream`, messagesCount: messages.length });

  const messagesWithImages = [...messages];
  if (options.images && options.images.length > 0 && messagesWithImages.length > 0) {
    const lastMessage = messagesWithImages[messagesWithImages.length - 1];
    if (lastMessage.role === "user") {
      lastMessage.images = options.images;
    }
  }

  const payload: Record<string, any> = {
    messages: messagesWithImages,
    model: options.model ?? "auto",
    temperature: options.temperature ?? 0.7,
    top_p: options.top_p ?? 0.9,
    max_tokens: options.max_tokens ?? 2048,
  };
  if (options.forceReasoning) {
    payload.force_reasoning = true;
  }

  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: options.signal,
  });

  if (!response.ok) {
    const text = await response.text();
    const msg = text || `Chat request failed (${response.status})`;
    console.error("streamChat http error", response.status, msg);
    callbacks.onError?.(msg);
    throw new Error(msg);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    const msg = "Failed to read response stream";
    console.error("streamChat no reader");
    callbacks.onError?.(msg);
    throw new Error(msg);
  }

  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const event of events) {
      const trimmed = event.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;
      try {
        const parsed = JSON.parse(trimmed.replace(/^data:\s*/, ""));
        handleStreamEvent(parsed as StreamEvent, callbacks);
      } catch (err) {
        // ignore malformed chunks
      }
    }
  }

  if (buffer.trim()) {
    try {
      const parsed = JSON.parse(buffer.replace(/^data:\s*/, ""));
      handleStreamEvent(parsed as StreamEvent, callbacks);
    } catch (err) {
      // ignore
    }
  }
}

function handleStreamEvent(event: StreamEvent, callbacks: StreamCallback) {
  switch (event.type) {
    case "routing":
      callbacks.onRouting?.(event.payload);
      break;
    case "search_start":
      callbacks.onSearchStart?.(event.payload);
      break;
    case "search_results":
      callbacks.onSearchResults?.(event.payload);
      break;
    case "search_error":
      callbacks.onSearchError?.(event.payload.error);
      break;
    case "delta":
      callbacks.onDelta?.(event.text);
      break;
    case "thinking_start":
      callbacks.onThinkingStart?.();
      break;
    case "thinking_delta":
      callbacks.onThinkingDelta?.(event.text);
      break;
    case "thinking_end":
      callbacks.onThinkingEnd?.();
      break;
    case "tool_start":
      callbacks.onToolStart?.(event.payload);
      break;
    case "tool_result":
      callbacks.onToolResult?.(event.payload);
      break;
    case "done":
      callbacks.onDone?.(event.payload);
      break;
  }
}

