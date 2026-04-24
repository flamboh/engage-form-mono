import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const FIELDS = [
  { label: "Full name", value: "Oliver Boorstein" },
  { label: "Email", value: "obo@uoregon.edu" },
  { label: "Student Organization", value: "Album Listening Club" },
  { label: "SOFS Index", value: "OS123i" },
  { label: "Amount", value: "$22.98" },
  { label: "Category", value: "Event Expenses" },
  {
    label: "Business Purpose",
    value: "Reimburse Oliver for the vinyl they purchased for the weekly event.",
  },
  { label: "Purchase Type", value: "Personal Reimbursement" },
  { label: "Permanent Address", value: "1395 University St, Eugene, OR 97403" },
  { label: "Upload UO ID", value: "Uploading oliver_id.jpg" },
  { label: "Upload Receipt", value: "Uploading amazon_receipt.pdf" },
  { label: "Upload Event Post", value: "Uploading weekly_event_engage.pdf" },
];

const YOU_CHARACTER_MS = 55;
const YOU_UPLOAD_MS = 900;
const AGENT_FIELD_MS = 123;
const YOU_FIELD_DURATIONS = FIELDS.map((field) =>
  isUploadField(field.label) ? YOU_UPLOAD_MS : field.value.length * YOU_CHARACTER_MS,
);
const AGENT_FIELD_DURATIONS = FIELDS.map(() => AGENT_FIELD_MS);
const YOU_TOTAL_MS = sumDurations(YOU_FIELD_DURATIONS);
const AGENT_TOTAL_MS = sumDurations(AGENT_FIELD_DURATIONS);
const START_DELAY_MS = 3000;
const HOLD_MS = 5000;
const LOOP_MS = START_DELAY_MS + Math.max(YOU_TOTAL_MS, AGENT_TOTAL_MS) + HOLD_MS;
const TICK_MS = 30;

const LABEL_HEIGHT = 16;
const LABEL_GAP = 4;
const INPUT_HEIGHT = 36;
const ROW_HEIGHT = LABEL_HEIGHT + LABEL_GAP + INPUT_HEIGHT;
const ROW_GAP = 12;
const ROW_SLOT = ROW_HEIGHT + ROW_GAP;
const VIEW_ROWS = 4;
const VIEW_HEIGHT = VIEW_ROWS * ROW_HEIGHT + (VIEW_ROWS - 1) * ROW_GAP;
const SUBMIT_ROW_INDEX = FIELDS.length;
const MAX_SCROLL_INDEX = Math.max(0, SUBMIT_ROW_INDEX + 1 - VIEW_ROWS);
const USER_SCROLL_RESET_MS = 1000;
const PROGRAMMATIC_SCROLL_MS = 250;

function LandingPage() {
  const [t, setT] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setT((value) => (value + TICK_MS) % LOOP_MS);
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <main className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="border-border/70 border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-heading text-lg font-semibold tracking-tight">Engage Form</span>
          <Link
            to="/app"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-10 px-6 py-10 md:py-14">
        <div className="flex max-w-2xl flex-col items-center gap-5 text-center">
          <h1 className="font-heading text-4xl leading-[1.05] font-semibold tracking-tight md:text-5xl">
            Defeat SOFS form fatigue.
          </h1>
          <p className="text-muted-foreground text-base md:text-lg">
            Engage Form fills your purchase requests on Engage for you.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" render={<Link to="/app" />} className="px-6">
              Get started
            </Button>
            <span className="text-muted-foreground text-sm">Free for ASUO-recognized groups.</span>
          </div>
        </div>

        <div className="grid w-full gap-4 md:grid-cols-2">
          <DemoCard title="You" kind="you" t={t} />
          <DemoCard title="Form Agent" kind="agent" t={t} accent />
        </div>
      </section>
    </main>
  );
}

type DemoKind = "you" | "agent";

type DemoCardProps = {
  title: string;
  kind: DemoKind;
  t: number;
  accent?: boolean;
};

function DemoCard({ title, kind, t, accent }: DemoCardProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const targetScrollTopRef = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const programmaticScrollRef = useRef(false);
  const programmaticTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [userScrolling, setUserScrolling] = useState(false);
  const fieldDurations = kind === "you" ? YOU_FIELD_DURATIONS : AGENT_FIELD_DURATIONS;
  const totalMs = kind === "you" ? YOU_TOTAL_MS : AGENT_TOTAL_MS;
  const effective = t - START_DELAY_MS;
  const started = effective >= 0;
  const clamped = Math.max(0, Math.min(effective, totalMs));
  const done = started && effective >= totalMs;
  const activeField = started && !done ? getActiveField(clamped, fieldDurations) : undefined;
  const activeIndex = activeField?.index ?? -1;
  const intra = activeField?.intra ?? 0;
  const activeDuration = activeField?.duration ?? 0;
  const followIndex = done ? SUBMIT_ROW_INDEX : Math.max(0, activeIndex);
  const scrollIndex = Math.max(0, Math.min(MAX_SCROLL_INDEX, followIndex - 1));
  const targetScrollTop = scrollIndex * ROW_SLOT;

  targetScrollTopRef.current = targetScrollTop;

  useEffect(() => {
    if (userScrolling) return;
    scrollToTarget(
      viewportRef.current,
      targetScrollTop,
      programmaticScrollRef,
      programmaticTimerRef,
    );
  }, [targetScrollTop, userScrolling]);

  useEffect(() => {
    return () => {
      clearTimeout(resetTimerRef.current);
      clearTimeout(programmaticTimerRef.current);
    };
  }, []);

  function handleScroll() {
    if (programmaticScrollRef.current) return;

    setUserScrolling(true);
    clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setUserScrolling(false);
      scrollToTarget(
        viewportRef.current,
        targetScrollTopRef.current,
        programmaticScrollRef,
        programmaticTimerRef,
      );
    }, USER_SCROLL_RESET_MS);
  }

  return (
    <div
      className={cn(
        "bg-card relative rounded-2xl border p-5 shadow-sm md:p-6",
        accent ? "border-primary/50 ring-primary/10 ring-1" : "border-border",
      )}
    >
      <div className="border-border mb-4 border-b pb-3">
        <div>
          <p className="font-heading text-base font-medium">{title}</p>
        </div>
      </div>

      <div
        ref={viewportRef}
        className="relative overflow-y-auto pr-2"
        style={{ height: VIEW_HEIGHT }}
        aria-label={`${title} demo viewport`}
        onScroll={handleScroll}
      >
        <div className="flex flex-col gap-3">
          {FIELDS.map((field, index) => (
            <DemoField
              key={field.label}
              label={field.label}
              value={field.value}
              kind={kind}
              active={index === activeIndex}
              intra={index === activeIndex ? intra : 0}
              fieldMs={index === activeIndex ? activeDuration : fieldDurations[index]}
              filled={done || index < activeIndex}
            />
          ))}
          <Button
            type="button"
            size="sm"
            disabled={!done}
            className={cn("w-full rounded-md", done && "ring-primary/25 ring-2")}
          >
            Submit
          </Button>
        </div>
      </div>
    </div>
  );
}

function scrollToTarget(
  viewport: HTMLDivElement | null,
  top: number,
  programmaticScrollRef: MutableRefObject<boolean>,
  timerRef: MutableRefObject<ReturnType<typeof setTimeout> | undefined>,
) {
  if (viewport === null) return;

  programmaticScrollRef.current = true;
  clearTimeout(timerRef.current);
  viewport.scrollTo({ top, behavior: "smooth" });
  timerRef.current = window.setTimeout(() => {
    programmaticScrollRef.current = false;
  }, PROGRAMMATIC_SCROLL_MS);
}

type DemoFieldProps = {
  label: string;
  value: string;
  kind: DemoKind;
  active: boolean;
  intra: number;
  fieldMs: number;
  filled: boolean;
};

function DemoField({ label, value, kind, active, intra, fieldMs, filled }: DemoFieldProps) {
  const isUpload = label.startsWith("Upload ");
  const uploadDone = isUpload && (filled || (active && intra > fieldMs * 0.7));
  const shown = isUpload
    ? uploadDone
      ? value
      : ""
    : computeShown({ value, kind, active, intra, fieldMs, filled });
  const pasted = kind === "agent" && active && shown.length > 0;
  const uploadLoading = isUpload && active && !uploadDone;

  return (
    <div>
      <p className="text-muted-foreground mb-1 h-4 text-[10px] leading-4 tracking-wider uppercase">
        {label}
      </p>
      {isUpload ? (
        <div className="relative flex h-9 items-center">
          <span
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "max-w-full justify-start truncate rounded-md",
              active && "border-primary ring-primary/25 ring-2",
              (shown.length === 0 || uploadLoading) && "text-muted-foreground",
              pasted && "bg-primary/10",
            )}
          >
            {uploadLoading && <Spinner />}
            {uploadLoading ? "Uploading" : shown || "Choose file"}
          </span>
        </div>
      ) : (
        <div
          className={cn(
            "bg-background relative flex h-9 items-center rounded-md border px-3 text-sm transition-colors duration-150",
            active ? "border-primary ring-primary/25 ring-2" : "border-border",
          )}
        >
          <span className={cn("truncate", pasted && "bg-primary/10 -mx-0.5 rounded px-0.5")}>
            {shown}
          </span>
          {active && kind === "you" && <TextCaret />}
        </div>
      )}
    </div>
  );
}

function computeShown({
  value,
  kind,
  active,
  intra,
  fieldMs,
  filled,
}: {
  value: string;
  kind: DemoKind;
  active: boolean;
  intra: number;
  fieldMs: number;
  filled: boolean;
}) {
  if (filled) return value;
  if (!active) return "";
  if (kind === "you") {
    const progress = Math.min(1, intra / fieldMs);
    return value.slice(0, Math.round(value.length * progress));
  }
  return intra > fieldMs * 0.3 ? value : "";
}

function TextCaret() {
  return <span aria-hidden className="bg-foreground ml-px inline-block h-4 w-px animate-pulse" />;
}

function Spinner() {
  return (
    <span
      aria-hidden
      data-icon="inline-start"
      className="border-current/30 border-t-current inline-block size-3 animate-spin rounded-full border-2"
    />
  );
}

function isUploadField(label: string) {
  return label.startsWith("Upload ");
}

function sumDurations(durations: number[]) {
  return durations.reduce((total, duration) => total + duration, 0);
}

function getActiveField(elapsed: number, durations: number[]) {
  let start = 0;

  for (const [index, duration] of durations.entries()) {
    if (elapsed < start + duration) {
      return { index, intra: elapsed - start, duration };
    }
    start += duration;
  }

  return undefined;
}
