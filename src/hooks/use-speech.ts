"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"

// Minimal typings for the Web Speech API (not yet in lib.dom for all browsers).
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } }
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> }
type Recognition = {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: RecognitionEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionCtor = new () => Recognition

function getRecognition(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

const noop = () => () => {}

/** Browser support is static for a page's lifetime, so read it once per render without effects. */
function useSupported(check: () => boolean) {
  return useSyncExternalStore(noop, check, () => false)
}

/**
 * Speech-to-text via the browser. `onFinal` receives the full utterance when
 * the user stops speaking; interim text streams through `transcript`.
 */
export function useSpeechInput(onFinal: (text: string) => void) {
  const supported = useSupported(() => Boolean(getRecognition()))
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const recognition = useRef<Recognition | null>(null)
  const finalText = useRef("")
  const onFinalRef = useRef(onFinal)

  useEffect(() => {
    onFinalRef.current = onFinal
  }, [onFinal])

  const stop = useCallback(() => recognition.current?.stop(), [])

  const start = useCallback(() => {
    const Ctor = getRecognition()
    if (!Ctor) return
    recognition.current?.abort()
    const rec = new Ctor()
    rec.lang = navigator.language || "en-US"
    rec.interimResults = true
    rec.continuous = false
    finalText.current = ""
    setTranscript("")

    rec.onresult = (e) => {
      let interim = ""
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText.current += r[0].transcript
        else interim += r[0].transcript
      }
      setTranscript((finalText.current + interim).trim())
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => {
      setListening(false)
      const text = finalText.current.trim()
      if (text) onFinalRef.current(text)
      setTranscript("")
    }

    recognition.current = rec
    rec.start()
    setListening(true)
  }, [])

  useEffect(() => () => recognition.current?.abort(), [])

  return { supported, listening, transcript, start, stop }
}

/** Removes markdown and citation markers so answers sound natural when spoken. */
export function toSpeakable(text: string) {
  return text
    .replace(/\[\d{1,2}(?:\s*,\s*\d{1,2})*\]/g, "")
    .replace(/[*_`#>]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim()
}

/** Text-to-speech with one active utterance at a time, tracked by an id. */
export function useSpeechOutput() {
  const supported = useSupported(() => typeof window !== "undefined" && "speechSynthesis" in window)
  const [speakingId, setSpeakingId] = useState<string | null>(null)

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeakingId(null)
  }, [])

  const speak = useCallback((id: string, text: string) => {
    const synth = window.speechSynthesis
    if (!synth) return
    synth.cancel()
    const utterance = new SpeechSynthesisUtterance(toSpeakable(text))
    utterance.rate = 1.03
    const voice = synth.getVoices().find((v) => /en(-|_)(US|GB)/i.test(v.lang) && /natural|google|samantha|aria/i.test(v.name))
    if (voice) utterance.voice = voice
    utterance.onend = () => setSpeakingId((cur) => (cur === id ? null : cur))
    utterance.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur))
    setSpeakingId(id)
    synth.speak(utterance)
  }, [])

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  return { supported, speakingId, speak, stop }
}
