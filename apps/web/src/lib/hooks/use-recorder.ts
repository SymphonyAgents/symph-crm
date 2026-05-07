'use client'

import { useRef, useState, useCallback } from 'react'

export type RecorderState = 'idle' | 'recording' | 'uploading'

/**
 * useRecorder, in-browser audio capture via MediaRecorder.
 *
 * start() requests mic access, picks the best supported mime type, and
 * starts a 1-second collection interval. duration is tracked in state
 * so the page can render a live timer.
 *
 * stop() flushes the MediaRecorder, tears down the mic stream, and
 * resolves with the assembled Blob and chosen mimeType. The caller
 * is responsible for capturing duration from state before calling
 * stop() (since the timer is cleared synchronously here).
 */
export function useRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [state, setState] = useState<RecorderState>('idle')
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const start = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : 'audio/webm'

      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      chunksRef.current = []

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.start(1000)

      setState('recording')
      setDuration(0)
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Microphone access denied'
      setError(message)
    }
  }, [])

  const stop = useCallback((): Promise<{ blob: Blob; mimeType: string; duration: number }> => {
    return new Promise((resolve, reject) => {
      const mr = mediaRecorderRef.current
      if (!mr) {
        reject(new Error('Recorder not started'))
        return
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }

      mr.onstop = () => {
        const mimeType = mr.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type: mimeType })
        mr.stream.getTracks().forEach((t) => t.stop())
        mediaRecorderRef.current = null
        resolve({ blob, mimeType, duration: 0 })
      }

      setState('uploading')
      mr.stop()
    })
  }, [])

  return { state, duration, error, start, stop, setState }
}
