"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquareText, Sparkles, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import WellnessIndicatorPill, {
  type WellnessIndicator,
} from "@/components/dashboard/mobile/WellnessIndicatorPill";
import { WELLNESS_SYMPTOMS } from "@/lib/wellness/reports";

type DogOption = {
  id: string;
  name: string;
};

type WellnessAccessSummary = {
  tier: string;
  usage: { chatsCount: number };
  limits: { chatsPerMonth: number };
  maxDogs: number | null;
  planEndsAt: string | null;
};

type ChatResponse = {
  reply: string;
  risk_level: WellnessIndicator;
  red_flags: string[];
  suggested_actions: string[];
  follow_up_questions: string[];
  disclaimer: string;
};

const QUICK_PROMPTS = [
  {
    label: "Loose stool + low energy",
    message: "My dog has loose stool and low energy today. What should I watch tonight?",
    symptoms: ["LETHARGY"],
  },
  {
    label: "Blood streaks",
    message: "I noticed red streaks in the stool. What are red flags I should watch for?",
    symptoms: ["OTHER"],
  },
  {
    label: "Vomiting + diarrhea",
    message: "My dog vomited and has diarrhea. When should I go to the vet?",
    symptoms: ["VOMITING"],
  },
  {
    label: "Diet change",
    message: "We switched food last week and stools are soft. Is that normal?",
    symptoms: [],
  },
  {
    label: "Appetite loss",
    message: "My dog is eating less and seems off. What should I do tonight?",
    symptoms: ["APPETITE_LOSS"],
  },
];

const formatLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const toggleSelection = <T extends string>(
  value: T,
  list: T[],
  setList: (next: T[]) => void,
  checked: boolean,
) => {
  if (checked) {
    setList([...list, value]);
  } else {
    setList(list.filter((item) => item !== value));
  }
};

export default function MobileWellnessChat({
  dogs,
  access,
}: {
  dogs: DogOption[];
  access: WellnessAccessSummary;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [dogId, setDogId] = useState<string | null>(null);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState("");
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [usage, setUsage] = useState(access.usage);
  const multiDogLocked = access.maxDogs === 1 && dogs.length > 1;

  const chatsRemaining = Math.max(access.limits.chatsPerMonth - usage.chatsCount, 0);
  const chatsPct =
    access.limits.chatsPerMonth > 0
      ? Math.min(100, Math.round((usage.chatsCount / access.limits.chatsPerMonth) * 100))
      : 0;

  const symptomOptions = useMemo(() => [...WELLNESS_SYMPTOMS], []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;
    const viewport = window.visualViewport;

    const updateOffset = () => {
      const offset = Math.max(
        0,
        window.innerHeight - viewport.height - viewport.offsetTop,
      );
      document.documentElement.style.setProperty(
        "--chat-keyboard-offset",
        `${offset}px`,
      );
    };

    updateOffset();
    viewport.addEventListener("resize", updateOffset);
    viewport.addEventListener("scroll", updateOffset);

    return () => {
      viewport.removeEventListener("resize", updateOffset);
      viewport.removeEventListener("scroll", updateOffset);
      document.documentElement.style.removeProperty("--chat-keyboard-offset");
    };
  }, []);

  const handleSubmit = async () => {
    if (!message.trim()) {
      setSubmitError("Tell us what's going on first.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const payload: Record<string, unknown> = {
        message: message.trim(),
      };
      if (dogId) payload.dogId = dogId;
      if (symptoms.length > 0 || notes.trim()) {
        payload.context = {
          symptoms,
          ...(notes.trim() ? { recentNotes: notes.trim() } : {}),
        };
      }

      const res = await fetch("/api/customer/wellness-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data?.message || data?.error || "Unable to reach the AI assistant.");
        if (data?.data?.usage) {
          setUsage(data.data.usage);
        }
        return;
      }

      setResponse(data?.data as ChatResponse);
      setUsage((prev) => ({ ...prev, chatsCount: prev.chatsCount + 1 }));
    } catch (error) {
      setSubmitError("Unable to reach the AI assistant right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const applyPrompt = (prompt: (typeof QUICK_PROMPTS)[number]) => {
    setMessage((prev) => (prev.trim().length ? `${prev}\n${prompt.message}` : prompt.message));
    if (prompt.symptoms.length > 0) {
      const next = new Set(symptoms);
      prompt.symptoms.forEach((symptom) => next.add(symptom));
      setSymptoms(Array.from(next));
    }
  };

  return (
    <div
      ref={containerRef}
      className="space-y-6"
      style={{
        paddingBottom: "calc(var(--chat-keyboard-offset, 0px) + 1rem)",
      }}
    >
      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">
              Symptom-aware chat
            </p>
            <h2 className="text-lg font-semibold text-white">
              Ask the wellness assistant
            </h2>
            <p className="text-sm text-slate-400">
              Quick, cautious guidance with red-flag alerts. Not a diagnosis.
            </p>
          </div>
          <div className="rounded-xl bg-slate-950/70 p-2 text-emerald-200">
            <Sparkles className="h-5 w-5" aria-hidden />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs text-slate-400">
          <div className="flex items-center justify-between">
            <span>Chats this month</span>
            <span>
              {usage.chatsCount}/{access.limits.chatsPerMonth}
            </span>
          </div>
          <div className="mt-2 h-2 rounded-full bg-slate-800">
            <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${chatsPct}%` }} />
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            {chatsRemaining} chats left on the {access.tier.toLowerCase()} plan.
          </p>
          {access.planEndsAt && (
            <p className="mt-1 text-[11px] text-slate-500">
              Access through{" "}
              {new Date(access.planEndsAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Add dog context</h3>
          <p className="text-xs text-slate-400">
            Optional, but helps tailor the response.
          </p>
        </div>
        <Select
          value={dogId ?? undefined}
          onValueChange={setDogId}
          disabled={multiDogLocked}
        >
          <SelectTrigger className="bg-slate-950/70 text-slate-200">
            <SelectValue placeholder="Choose a dog (optional)" />
          </SelectTrigger>
          <SelectContent>
            {dogs.map((dog) => (
              <SelectItem key={dog.id} value={dog.id}>
                {dog.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {multiDogLocked && (
          <p className="text-xs text-amber-300">
            Multi-dog chat context is a premium feature. Upgrade to tag specific dogs.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4">
        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-400">
            Quick prompts
          </Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt.label}
                type="button"
                onClick={() => applyPrompt(prompt)}
                className="rounded-full border border-slate-800 bg-slate-950/70 px-3 py-1 text-xs text-slate-300 transition hover:border-emerald-400/50 hover:text-white"
              >
                {prompt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label className="text-xs uppercase tracking-wide text-slate-400">
            Symptoms noticed
          </Label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {symptomOptions.map((symptom) => (
              <label
                key={symptom}
                className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs"
              >
                <Checkbox
                  checked={symptoms.includes(symptom)}
                  onCheckedChange={(checked) =>
                    toggleSelection(symptom, symptoms, setSymptoms, Boolean(checked))
                  }
                />
                {formatLabel(symptom)}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-slate-400">
            What should the assistant know?
          </Label>
          <Textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Recent diet changes, meds, or timing details"
            className="bg-slate-950/70 text-slate-200"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-slate-400">
            Your question
          </Label>
          <Textarea
            ref={inputRef}
            rows={4}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onFocus={() => {
              setTimeout(() => {
                inputRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
              }, 50);
            }}
            placeholder="Example: My dog has loose stool and low energy today. What should I watch tonight?"
            className="bg-slate-950/70 text-slate-200"
          />
        </div>

        <Button
          type="button"
          className="w-full rounded-full bg-white text-slate-900 hover:bg-slate-100"
          disabled={isSubmitting}
          onClick={handleSubmit}
        >
          {isSubmitting ? "Thinking..." : "Get guidance"}
        </Button>

        {submitError && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
            {submitError}
          </div>
        )}
      </section>

      {response && (
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-slate-200 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">
                AI guidance
              </p>
              <h3 className="text-lg font-semibold text-white">
                Here&apos;s what to know
              </h3>
            </div>
            <WellnessIndicatorPill indicator={response.risk_level} size="md" />
          </div>

          <p className="text-sm text-slate-200 leading-relaxed">
            {response.reply}
          </p>

          {response.suggested_actions?.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                What to do tonight
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {response.suggested_actions.map((action) => (
                  <li key={action}>• {action}</li>
                ))}
              </ul>
            </div>
          )}

          {response.red_flags?.length > 0 && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-100">
              <div className="flex items-center gap-2 text-rose-200">
                <AlertTriangle className="h-4 w-4" aria-hidden />
                Red flags
              </div>
              <ul className="mt-2 space-y-1 text-xs text-rose-100">
                {response.red_flags.map((flag) => (
                  <li key={flag}>• {flag}</li>
                ))}
              </ul>
            </div>
          )}

          {response.follow_up_questions?.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-200">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Follow-up questions
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-300">
                {response.follow_up_questions.map((question) => (
                  <li key={question}>• {question}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs text-slate-400">
            {response.disclaimer}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-400">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-slate-950/70 p-2 text-slate-200">
            <MessageSquareText className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Not a diagnosis</p>
            <p className="mt-1">
              Seek veterinary care for severe lethargy, repeated vomiting, blood in stool, or if
              you are worried about your dog&apos;s condition.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
