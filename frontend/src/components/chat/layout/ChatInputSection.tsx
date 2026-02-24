"use client";

import MessageInput, { type ToolMode, type Attachment } from "../MessageInput";

type ChatInputSectionProps = {
  disabled: boolean;
  isGenerating?: boolean;
  onSend: (content: string, toolMode?: ToolMode, attachments?: Attachment[]) => void;
  onStop?: () => void;
  toolMode: ToolMode;
  onToolModeChange: (toolMode: ToolMode) => void;
};

export default function ChatInputSection({
  disabled,
  isGenerating,
  onSend,
  onStop,
  toolMode,
  onToolModeChange,
}: ChatInputSectionProps) {
  return (
    <div className="shrink-0 py-2">
      <MessageInput
        disabled={disabled}
        isGenerating={isGenerating}
        onSend={onSend}
        onStop={onStop}
        toolMode={toolMode}
        onToolModeChange={onToolModeChange}
      />
    </div>
  );
}
