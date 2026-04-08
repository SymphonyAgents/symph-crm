'use client'

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'

type ChatTypingState = {
  /** Whether Aria is currently typing/streaming a response */
  typing: boolean
  /** The session ID the typing indicator belongs to (null = none) */
  typingSessionId: string | undefined
  /** Set typing state for a specific session */
  setTyping: (sessionId: string | undefined, value: boolean) => void
}

const ChatTypingContext = createContext<ChatTypingState>({
  typing: false,
  typingSessionId: undefined,
  setTyping: () => {},
})

export function ChatTypingProvider({ children }: { children: ReactNode }) {
  const [typing, setTypingRaw] = useState(false)
  const [typingSessionId, setTypingSessionId] = useState<string | undefined>()

  const setTyping = useCallback((sessionId: string | undefined, value: boolean) => {
    setTypingRaw(value)
    setTypingSessionId(value ? sessionId : undefined)
  }, [])

  return (
    <ChatTypingContext.Provider value={{ typing, typingSessionId, setTyping }}>
      {children}
    </ChatTypingContext.Provider>
  )
}

export function useChatTyping() {
  return useContext(ChatTypingContext)
}
