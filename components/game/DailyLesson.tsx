"use client";

import { useState } from "react";
import { BookOpen, CheckCircle2, XCircle } from "lucide-react";
import { lessonExample, type Lesson } from "@/lib/wisdom";
import { useCountry } from "@/lib/useCountry";

type Props = {
  lesson: Lesson;
  completed: boolean;
  onAnswer: (lessonId: string, correct: boolean) => Promise<void>;
  onNext?: () => void;
};

export default function DailyLesson({ lesson, completed, onAnswer, onNext }: Props) {
  const [choice, setChoice] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const answered = choice !== null;
  const { country } = useCountry();
  const correct = choice === lesson.answer;

  async function pick(index: number) {
    if (answered || saving) return;
    setChoice(index);
    setSaving(true);
    try { await onAnswer(lesson.id, index === lesson.answer); } finally { setSaving(false); }
  }

  return (
    <article className="lesson-card">
      <p className="eyebrow"><BookOpen size={14} /> TODAY’S BOOK LESSON · +30–50 XP</p>
      <span className="lesson-book">From the ideas in <b>{lesson.book}</b> by {lesson.author}</span>
      <h3>{lesson.title}</h3>
      <p>{lesson.idea}</p>
      <div className="lesson-example"><strong>📍 In real life{country.code === "AE" ? ", in the UAE" : ", in India"}</strong><span>{lessonExample(lesson, country.currency)}</span></div>
      <div className="lesson-quiz">
        <strong>{lesson.question}</strong>
        <div className="lesson-options">
          {lesson.options.map((option, index) => {
            const state = !answered ? "" : index === lesson.answer ? " correct" : index === choice ? " wrong" : " dim";
            return <button type="button" key={option} className={`lesson-option${state}`} onClick={() => void pick(index)} disabled={answered}>{option}</button>;
          })}
        </div>
        {answered && <p className={`lesson-result ${correct ? "good" : "retry"}`}>{correct ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {correct ? "Correct! +50 XP." : "Not quite — you still earn +30 XP for learning."} {lesson.explain}</p>}
        {completed && !answered && <p className="lesson-result good"><CheckCircle2 size={16} /> You’ve completed this lesson before. Answer again for practice.</p>}
      </div>
      <div className="lesson-challenge"><strong>Today’s micro-challenge</strong><span>{lesson.challenge}</span></div>
      {answered && onNext && <button type="button" className="text-link lesson-next" onClick={() => { setChoice(null); onNext(); }}>Next lesson →</button>}
    </article>
  );
}
