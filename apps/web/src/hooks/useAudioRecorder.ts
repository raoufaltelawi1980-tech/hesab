"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

export type RecordedAudio = { blob: Blob; filename: string };

export type AudioRecorder = {
  /** True only after mount when the browser exposes `getUserMedia` + `MediaRecorder`. */
  supported: boolean;
  /** True while the microphone is actively capturing. */
  recording: boolean;
  /** Requests the mic and starts capturing; rejects when the permission or device fails. */
  start: () => Promise<void>;
  /** Stops capturing; the finished clip is delivered to `onComplete`. */
  stop: () => void;
};

export type AudioRecorderOptions = {
  onComplete: (audio: RecordedAudio) => void;
  onError?: (error: unknown) => void;
};

const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
] as const;

/** Extensions the API accepts, keyed by the base MIME type we may pick. */
const EXTENSION_BY_MIME: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/wave": "wav",
  "audio/aac": "aac",
};

function canRecord(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

const subscribeToRecorderCapability = () => () => {};
const getRecorderCapability = () => canRecord();
const getRecorderCapabilityOnServer = () => false;

function pickMimeType(): string | undefined {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((type) => window.MediaRecorder.isTypeSupported(type));
}

function filenameFor(mimeType: string): string {
  const base = mimeType.split(";")[0].trim().toLowerCase();
  return `voice-recording.${EXTENSION_BY_MIME[base] ?? "webm"}`;
}

/**
 * Manual in-browser recorder built on `MediaRecorder`. It never uploads by itself:
 * the caller receives the finished clip via `onComplete` and owns every state
 * transition. Audio stays in memory only — it is never stored or persisted.
 */
export function useAudioRecorder(options: AudioRecorderOptions): AudioRecorder {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onCompleteRef = useRef(options.onComplete);
  const onErrorRef = useRef(options.onError);

  // Keep the latest callbacks reachable from MediaRecorder events without
  // mutating refs during render.
  useEffect(() => {
    onCompleteRef.current = options.onComplete;
    onErrorRef.current = options.onError;
  }, [options.onComplete, options.onError]);

  // Feature detection reads the browser capability through an external-store
  // subscription: the server snapshot stays `false` so SSR and hydration match.
  const supported = useSyncExternalStore(
    subscribeToRecorderCapability,
    getRecorderCapability,
    getRecorderCapabilityOnServer,
  );

  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
    setRecording(false);
  }, []);

  const start = useCallback(async () => {
    if (!canRecord()) throw new Error("recorder-unsupported");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = pickMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

    chunksRef.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || mimeType || "audio/webm";
      const blob = new Blob(chunksRef.current, { type });
      const filename = filenameFor(type);
      release();
      onCompleteRef.current({ blob, filename });
    };
    recorder.onerror = () => {
      release();
      onErrorRef.current?.(new Error("recorder-error"));
    };

    streamRef.current = stream;
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  }, [release]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  // Never leave the microphone hot if the view unmounts mid-recording.
  useEffect(
    () => () => {
      const recorder = recorderRef.current;
      try {
        if (recorder && recorder.state !== "inactive") recorder.stop();
      } catch {
        /* recorder already torn down */
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    },
    [],
  );

  return { supported, recording, start, stop };
}
