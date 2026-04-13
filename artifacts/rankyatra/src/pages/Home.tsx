import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Radio, Clock, Archive } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { ExamCard } from "@/components/ExamCard";
import { useListExams, useGetMyRegistrations } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { getApiUrl } from "@/lib/utils";
import type { Exam } from "@workspace/api-client-react";

type Banner = {
  id: number;
  title: string;
  subtitle: string;
  emoji: string;
  bgFrom: string;
  bgTo: string;
  linkUrl: string;
  linkLabel: string;
  imageUrl?: string | null;
  displayOrder: number;
};

function BannerSlider({ liveCount }: { liveCount: number }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, setLocation] = useLocation();

  const { data: banners = [] } = useQuery<Banner[]>({
    queryKey: ["banners"],
    queryFn: async () => {
      const r = await fetch(getApiUrl("/api/banners"));
      return r.json();
    },
    staleTime: 60_000,
  });

  const slides = banners.length > 0 ? banners : [{
    id: 0, title: "Win Real Cash Prizes", subtitle: "Pay ₹5 · Compete for ₹50,000+",
    emoji: "⚡", bgFrom: "#f97316", bgTo: "#ea580c", linkUrl: "/", linkLabel: "Join Now", displayOrder: 0,
  }];

  useEffect(() => {
    if (slides.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % slides.length);
    }, 3500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [slides.length]);

  function goTo(idx: number) {
    setCurrent(idx);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % slides.length);
    }, 3500);
  }

  const slide = slides[current];

  return (
    <div className="mb-6">
      {slide.imageUrl ? (
        /* ── Image Banner ── */
        <div
          className="rounded-2xl overflow-hidden cursor-pointer select-none"
          style={{ aspectRatio: "16/5" }}
          onClick={() => setLocation(slide.linkUrl)}
        >
          <img
            src={slide.imageUrl}
            alt={slide.title}
            className="w-full h-full object-cover transition-all duration-500"
          />
        </div>
      ) : (
        /* ── Text / Gradient Banner ── */
        <div
          className="rounded-2xl p-5 flex items-center gap-4 cursor-pointer select-none transition-all duration-500"
          style={{ background: `linear-gradient(135deg, ${slide.bgFrom}, ${slide.bgTo})` }}
          onClick={() => setLocation(slide.linkUrl)}
        >
          <span className="text-2xl shrink-0">{slide.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-white font-black text-base leading-tight truncate">{slide.title}</p>
            {slide.subtitle && <p className="text-white/70 text-xs mt-0.5 truncate">{slide.subtitle}</p>}
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1.5">
            {liveCount > 0 && (
              <span className="px-2 py-0.5 rounded-lg text-xs font-black text-white bg-white/25">
                {liveCount} LIVE
              </span>
            )}
            <span className="px-2 py-0.5 rounded-lg text-xs font-semibold text-white bg-white/20">
              {slide.linkLabel} →
            </span>
          </div>
        </div>
      )}
      {slides.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-2.5">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${i === current ? "w-5 h-1.5" : "w-1.5 h-1.5 bg-muted-foreground/30"}`}
              style={i === current ? { backgroundColor: (s as any).bgFrom ?? "#f97316", width: 20, height: 6 } : {}}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_TABS = ["All Upcoming", "Live", "Ended"] as const;
type StatusTab = (typeof STATUS_TABS)[number];

function getExamStatus(exam: Exam): "live" | "upcoming" | "ended" {
  const now = Date.now();
  const start = new Date((exam as any).startTime ?? (exam as any).start_time).getTime();
  const end = new Date((exam as any).endTime ?? (exam as any).end_time).getTime();
  if (now >= start && now <= end) return "live";
  if (now < start) return "upcoming";
  return "ended";
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState<StatusTab>("All Upcoming");

  const { data: fetchedCategories = [] } = useQuery<string[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      const r = await fetch(getApiUrl("/api/categories"));
      return r.json();
    },
    staleTime: 60_000,
  });
  const CATEGORIES = ["All", ...fetchedCategories];

  const { data: examsRaw = [], isLoading } = useListExams(
    selectedCategory !== "All" ? { category: selectedCategory } : {}
  ) as { data: Exam[]; isLoading: boolean };

  const { data: regsData = [] } = useGetMyRegistrations();

  const registeredExamIds = new Set(
    (regsData as any[]).map((r: any) => r.examId ?? r.exam_id)
  );

  const submittedExamIds = new Set(
    (regsData as any[]).filter((r: any) => r.hasSubmitted).map((r: any) => r.examId ?? r.exam_id)
  );

  const allExams = examsRaw as Exam[];

  const getStartMs = (e: Exam) => new Date((e as any).startTime ?? (e as any).start_time ?? 0).getTime();
  const getEndMs = (e: Exam) => new Date((e as any).endTime ?? (e as any).end_time ?? 0).getTime();
  const sortAsc = (a: Exam, b: Exam) => getStartMs(a) - getStartMs(b);
  const sortDesc = (a: Exam, b: Exam) => getStartMs(b) - getStartMs(a);
  const sortEndedDesc = (a: Exam, b: Exam) => getEndMs(b) - getEndMs(a);
  const sortByStatusThenTime = (a: Exam, b: Exam) => {
    const order: Record<string, number> = { live: 0, upcoming: 1, ended: 2 };
    const as = getExamStatus(a), bs = getExamStatus(b);
    if (as !== bs) return order[as] - order[bs];
    return getStartMs(a) - getStartMs(b);
  };

  const myExams = allExams.filter((e) => registeredExamIds.has(e.id) && getExamStatus(e) !== "ended").sort(sortByStatusThenTime);

  const liveCount = allExams.filter((e) => getExamStatus(e) === "live").length;

  const filteredExams = selectedStatus === "All Upcoming"
    ? allExams.filter((e) => getExamStatus(e) === "upcoming").sort(sortAsc)
    : selectedStatus === "Ended"
      ? allExams.filter((e) => getExamStatus(e) === "ended").sort(sortEndedDesc)
      : selectedStatus === "Live"
        ? allExams.filter((e) => getExamStatus(e) === "live").sort(sortDesc)
        : allExams.filter((e) => getExamStatus(e) === selectedStatus.toLowerCase() as any).sort(sortAsc);

  const getTabCount = (tab: StatusTab) => {
    if (tab === "All Upcoming") return allExams.filter((e) => getExamStatus(e) === "upcoming").length;
    return allExams.filter((e) => getExamStatus(e) === tab.toLowerCase()).length;
  };


  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="container mx-auto px-4 max-w-3xl pb-24 pt-5">

        {/* ── Banner Slider ── */}
        <BannerSlider liveCount={liveCount} />

        {/* ── Your Exams Horizontal Scroll ── */}
        {myExams.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-lg font-black text-foreground">Your Exams</h2>
              <span className="px-2 py-0.5 rounded-xl text-xs font-black" style={{ backgroundColor: "hsl(var(--primary) / 0.12)", color: "hsl(var(--primary))" }}>
                {myExams.length}
              </span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 hide-scrollbar">
              {myExams.map((exam) => {
                const status = getExamStatus(exam);
                const statusColor =
                  status === "live" ? "#ef4444" : status === "upcoming" ? "#f59e0b" : "#9ca3af";
                const startTime = new Date((exam as any).startTime ?? (exam as any).start_time);
                const timeLabel =
                  status === "live"
                    ? "LIVE NOW"
                    : status === "upcoming"
                    ? startTime.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) +
                      " · " +
                      startTime.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                    : "Ended";

                return (
                  <button
                    key={exam.id}
                    onClick={() => setLocation(`/exam/${exam.id}`)}
                    className="shrink-0 w-48 rounded-2xl border-2 p-3.5 text-left transition-all hover:scale-[1.02] active:scale-[0.99] bg-card"
                    style={{ borderColor: status === "live" ? "#ef444430" : "hsl(var(--border))" }}
                  >
                    {status === "live" && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse inline-block" />
                        <span className="text-[10px] font-black text-red-500 tracking-widest">LIVE</span>
                      </div>
                    )}
                    <p className="text-sm font-bold text-foreground leading-tight line-clamp-2 mb-1">{exam.title}</p>
                    <p className="text-[11px] text-muted-foreground font-semibold mb-2">{(exam as any).category}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className="text-[10px] font-bold px-2 py-1 rounded-lg flex-1 truncate"
                        style={{ backgroundColor: statusColor + "20", color: statusColor }}
                      >
                        {timeLabel}
                      </span>
                      {status === "live" && (
                        <span className="text-[11px] font-black px-2 py-1 rounded-lg bg-primary text-primary-foreground shrink-0">
                          Start →
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Browse Exams title ── */}
        <h2 className="text-lg font-black text-foreground mb-3">Browse Exams</h2>

        {/* ── Category Chips ── */}
        <div className="flex gap-2 overflow-x-auto pb-3 hide-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="shrink-0 px-4 py-2 rounded-2xl text-sm font-semibold transition-colors"
              style={{
                backgroundColor: selectedCategory === cat ? "hsl(var(--primary))" : "hsl(var(--muted))",
                color: selectedCategory === cat ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                fontWeight: selectedCategory === cat ? 700 : 500,
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* ── Status Tabs ── */}
        <div className="flex border-b border-border mb-5 mt-1">
          {STATUS_TABS.map((tab) => {
            const isActive = selectedStatus === tab;
            const isLive = tab === "Live";
            const count = getTabCount(tab);
            const activeColor = isLive ? "#ef4444" : "hsl(var(--primary))";

            return (
              <button
                key={tab}
                onClick={() => setSelectedStatus(tab)}
                className="flex-1 pb-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors text-sm"
                style={{
                  borderBottomColor: isActive ? activeColor : "transparent",
                  color: isActive ? activeColor : "hsl(var(--muted-foreground))",
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                {isLive && liveCount > 0 && (
                  <span className="h-2 w-2 rounded-full inline-block animate-pulse" style={{ backgroundColor: "#ef4444" }} />
                )}
                {tab}
                {count > 0 && (
                  <span
                    className="text-[10px] font-black px-1.5 py-0.5 rounded-lg"
                    style={{
                      backgroundColor: isActive ? activeColor + "22" : "hsl(var(--muted))",
                      color: isActive ? activeColor : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Exam List ── */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredExams.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            {selectedStatus === "Live"
              ? <Radio className="h-10 w-10 text-muted-foreground opacity-40" />
              : selectedStatus === "All Upcoming"
              ? <Clock className="h-10 w-10 text-muted-foreground opacity-40" />
              : <Archive className="h-10 w-10 text-muted-foreground opacity-40" />}
            <p className="font-bold text-foreground">
              {selectedStatus === "Live"
                ? "No Live Exams Right Now"
                : selectedStatus === "All Upcoming"
                ? "No Upcoming Exams"
                : "No Ended Exams"}
            </p>
            <p className="text-sm text-muted-foreground">
              {selectedStatus === "Live"
                ? "Check All Upcoming tab to see what's next"
                : selectedStatus === "All Upcoming"
                ? "New exams are added regularly"
                : "Try a different category filter"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredExams.map((exam) => (
              <ExamCard
                key={exam.id}
                exam={exam}
                isRegistered={registeredExamIds.has(exam.id)}
                hasSubmitted={registeredExamIds.has(exam.id) ? submittedExamIds.has(exam.id) : undefined}
              />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
