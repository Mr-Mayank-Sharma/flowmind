"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Paperclip, Terminal } from "lucide-react";
import { Button } from "@flowmind/ui";
import { useChatStore } from "@/hooks/chat-store";

const MODELS = [
  { value: "gpt-4", label: "GPT-4" },
  { value: "gpt-3.5", label: "GPT-3.5 Turbo" },
  { value: "claude-3", label: "Claude 3" },
  { value: "llama-3", label: "Llama 3 (Local)" },
  { value: "mistral", label: "Mistral (Local)" },
];

export function ChatInput() {
  const [input, setInput] = useState("");
  const [model, setModel] = useState("gpt-4");
  const [showTools, setShowTools] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { currentSessionId, sendMessage, isStreaming } = useChatStore();

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !currentSessionId || isStreaming) return;
    sendMessage(trimmed);
    setInput("");
  }, [input, currentSessionId, isStreaming, sendMessage]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileClick = () => {
    // placeholder
  };

  return (
    <div className="border-t border-border bg-surface">
      <div className="mx-auto max-w-3xl px-4 py-3">
        <div className="flex items-end gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring transition-shadow">
          <button
            onClick={handleFileClick}
            className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            disabled={!currentSessionId || isStreaming}
            className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none py-1.5 max-h-[200px]"
          />

          <div className="flex items-center gap-1 shrink-0">
            <div className="relative">
              <button
                onClick={() => setShowModelPicker(!showModelPicker)}
                className="px-2 py-1 text-[11px] font-medium rounded-md bg-accent text-accent-foreground hover:bg-accent/80 transition-colors"
              >
                {MODELS.find((m) => m.value === model)?.label ?? model}
              </button>
              {showModelPicker && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowModelPicker(false)}
                  />
                  <div className="absolute bottom-full right-0 mb-2 z-20 w-40 rounded-lg border border-border bg-surface shadow-lg py-1">
                    {MODELS.map((m) => (
                      <button
                        key={m.value}
                        onClick={() => {
                          setModel(m.value);
                          setShowModelPicker(false);
                        }}
                        className={`w-full px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent ${
                          model === m.value
                            ? "text-foreground font-medium"
                            : "text-muted-foreground"
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <button
              onClick={() => setShowTools(!showTools)}
              className={`p-1.5 rounded-md transition-colors ${
                showTools
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              }`}
              aria-label="Toggle tools"
            >
              <Terminal className="h-4 w-4" />
            </button>

            <Button
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleSend}
              disabled={!input.trim() || !currentSessionId || isStreaming}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <p className="mt-1.5 text-[10px] text-muted-foreground text-center">
          Enter to send &middot; Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
