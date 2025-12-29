type StreamEvent =
  | { type: "routing"; payload: Record<string, any> }
  | { type: "delta"; text: string }
  | { type: "done"; payload: { success: boolean; model_used?: string | null; error?: string | null } };

export type StreamCallback = {
  onRouting?: (payload: Record<string, any>) => void;
  onDelta?: (chunk: string) => void;
  onDone?: (payload: { success: boolean; model_used?: string | null; error?: string | null }) => void;
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
  },
  callbacks: StreamCallback
) {
  console.debug("streamChat start", { api: `${API_BASE}/chat/stream`, messagesCount: messages.length });

  // Add images to the last user message if provided
  const messagesWithImages = [...messages];
  if (options.images && options.images.length > 0 && messagesWithImages.length > 0) {
    const lastMessage = messagesWithImages[messagesWithImages.length - 1];
    if (lastMessage.role === "user") {
      lastMessage.images = options.images;
    }
  }

  const payload = {
    messages: messagesWithImages,
    model: options.model ?? "auto",
    temperature: options.temperature ?? 0.7,
    top_p: options.top_p ?? 0.9,
    max_tokens: options.max_tokens ?? 2048,
  };

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
    case "delta":
      callbacks.onDelta?.(event.text);
      break;
    case "done":
      callbacks.onDone?.(event.payload);
      break;
  }
}

