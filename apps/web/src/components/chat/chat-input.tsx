"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Send, Terminal, Square } from "lucide-react";
import { Button } from "@flowmind/ui";
import { useChatStore } from "@/hooks/chat-store";
import { ModelSelector } from "./model-selector";
import { FileUpload, type UploadedFile } from "./file-upload";

export function ChatInput() {
  const [input, setInput] = useState("");
  const [model, setModel] = useState("");
  const [showTools, setShowTools] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { currentSessionId, sendMessage, isStreaming, stopStreaming } = useChatStore();

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
    sendMessage(trimmed, model || undefined, uploadedFiles.length > 0 ? uploadedFiles.map(f => ({ name: f.name, type: f.type, size: f.size })) : undefined);
    setInput("");
    setUploadedFiles([]);
  }, [input, currentSessionId, isStreaming, sendMessage, model, uploadedFiles]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFilesSelected = useCallback((files: UploadedFile[]) => {
    setUploadedFiles(prev => [...prev, ...files])
  }, [])

  return (
    <div className="border-t border-border bg-surface">
      <div className="mx-auto max-w-3xl px-4 py-3">
        {uploadedFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {uploadedFiles.map((f) => (
              <div key={f.name} className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-accent text-[10px] text-muted-foreground">
                <span className="truncate max-w-[100px]">{f.name}</span>
                <button
                  onClick={() => setUploadedFiles(prev => prev.filter(x => x.name !== f.name))}
                  className="hover:text-foreground"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:ring-1 focus-within:ring-ring transition-shadow">
          <FileUpload onFilesSelected={handleFilesSelected} disabled={!currentSessionId || isStreaming} />

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
            <ModelSelector
              selectedModel={model}
              onModelChange={setModel}
              disabled={!currentSessionId || isStreaming}
            />

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

            {isStreaming ? (
              <Button
                size="icon"
                className="h-8 w-8 shrink-0 bg-destructive/10 text-destructive hover:bg-destructive/20"
                onClick={stopStreaming}
                aria-label="Stop streaming"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleSend}
                disabled={!input.trim() || !currentSessionId || isStreaming}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <p className="mt-1.5 text-[10px] text-muted-foreground text-center">
          Enter to send &middot; Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
