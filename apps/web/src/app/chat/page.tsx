import { Suspense } from "react";
import { ChatLayout } from "@/components/chat/chat-layout";

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatLayout />
    </Suspense>
  );
}
