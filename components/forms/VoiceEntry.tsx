"use client";

import { useRef, useState } from "react";
import { Mic, MicOff, WandSparkles } from "lucide-react";

type SpeechAlternative = { transcript: string };
type SpeechResultEvent = { results: ArrayLike<ArrayLike<SpeechAlternative>> };
type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;
type SpeechWindow = Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor };

type Props = { hint: string; hindiHint?: string; applyLabel: string; onApply: (transcript: string) => void };

export default function VoiceEntry({ hint, hindiHint, applyLabel, onApply }: Props) {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState<"en-IN" | "hi-IN">("en-IN");
  const [message, setMessage] = useState("");
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  function toggleListening() {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setMessage("Voice dictation is unavailable in this browser. You can type the same instruction below.");
      return;
    }
    setMessage("");
    const recognition = new Recognition();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = event => {
      const spoken = Array.from(event.results).map(result => result[0]?.transcript ?? "").join(" ").trim();
      setTranscript(current => [current, spoken].filter(Boolean).join(" "));
    };
    recognition.onerror = event => setMessage(event.error === "not-allowed" ? "Microphone access was blocked. Allow it in your browser settings, or type below." : `Voice input stopped (${event.error}). You can type below.`);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      setMessage("Could not start voice input. Try again or type below.");
    }
  }

  return <div className="voice-entry">
    <div className="voice-entry-language"><label htmlFor="voice-language">Voice language</label><select id="voice-language" value={language} onChange={event => setLanguage(event.target.value as "en-IN" | "hi-IN")} disabled={listening}><option value="en-IN">English (India)</option><option value="hi-IN">हिन्दी (भारत)</option></select></div>
    <label className="profile-field"><span>Say it or type it</span><textarea value={transcript} onChange={event => setTranscript(event.target.value)} placeholder={language === "hi-IN" ? hindiHint ?? "अपनी आय, खर्च या निवेश की जानकारी बोलें या लिखें" : hint} rows={2} /></label>
    <div className="voice-entry-actions"><button type="button" className="voice-mic-button" onClick={toggleListening} aria-pressed={listening}>{listening ? <MicOff size={15} /> : <Mic size={15} />}{listening ? "Stop listening" : "Speak"}</button><button type="button" className="text-link voice-apply" onClick={() => { onApply(transcript); setMessage(""); }} disabled={!transcript.trim()}><WandSparkles size={15} />{applyLabel}</button></div>
    {listening && <p className="voice-feedback" aria-live="polite">Listening… speak clearly, then wait for the transcript.</p>}
    {message && <p className="voice-feedback" role="status">{message}</p>}
    <p className="voice-feedback">Voice may be processed by your browser’s speech service. Review the filled fields before saving; nothing is saved automatically.</p>
  </div>;
}
