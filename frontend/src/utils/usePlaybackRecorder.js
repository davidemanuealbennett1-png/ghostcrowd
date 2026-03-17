import { useState, useRef, useCallback } from 'react'

export function usePlaybackRecorder() {
  const [recording, setRecording] = useState(false)
  const [playback, setPlayback] = useState(false)
  const [playbackFrame, setPlaybackFrame] = useState(null)
  const [playbackProgress, setPlaybackProgress] = useState(0)
  const framesRef = useRef([])
  const playbackRef = useRef(null)
  const playbackIndexRef = useRef(0)

  const startRecording = useCallback(() => {
    framesRef.current = []
    setRecording(true)
  }, [])

  const recordFrame = useCallback((frame) => {
  framesRef.current.push(frame)
}, [])

  const stopRecording = useCallback(() => {
  setRecording(false)
  setHasRecording(framesRef.current.length > 0)
}, [])

  const startPlayback = useCallback((speed = 1.0) => {
    if (framesRef.current.length === 0) return
    setPlayback(true)
    playbackIndexRef.current = 0

    const interval = Math.max(16, 50 / speed)
    playbackRef.current = setInterval(() => {
      const idx = playbackIndexRef.current
      const frames = framesRef.current
      if (idx >= frames.length) {
        clearInterval(playbackRef.current)
        setPlayback(false)
        setPlaybackProgress(100)
        return
      }
      setPlaybackFrame(frames[idx])
      setPlaybackProgress(Math.round((idx / frames.length) * 100))
      playbackIndexRef.current++
    }, interval)
  }, [])

  const stopPlayback = useCallback(() => {
    if (playbackRef.current) clearInterval(playbackRef.current)
    setPlayback(false)
    setPlaybackFrame(null)
    setPlaybackProgress(0)
    playbackIndexRef.current = 0
  }, [])

  const seekPlayback = useCallback((pct) => {
    if (framesRef.current.length === 0) return
    const idx = Math.floor((pct / 100) * framesRef.current.length)
    playbackIndexRef.current = idx
    setPlaybackFrame(framesRef.current[idx])
    setPlaybackProgress(pct)
  }, [])

  const [hasRecording, setHasRecording] = useState(false)

  return {
    recording, playback, playbackFrame, playbackProgress,
    hasRecording,
    startRecording, recordFrame, stopRecording,
    startPlayback, stopPlayback, seekPlayback,
    frameCount: framesRef.current.length,
  }
}
