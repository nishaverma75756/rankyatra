import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Clock, Trophy, Tag, Zap, CheckCircle, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { formatCurrency, getExamStatus, formatTimeLeft } from "@/lib/utils";
import type { Exam } from "@workspace/api-client-react";

const CATEGORY_COLORS: Record<string, string> = {
  SSC: "bg-blue-100 text-blue-700 border-blue-200",
  UPSC: "bg-purple-100 text-purple-700 border-purple-200",
  Banking: "bg-green-100 text-green-700 border-green-200",
  Railways: "bg-red-100 text-red-700 border-red-200",
  Defence: "bg-orange-100 text-orange-700 border-orange-200",
};

interface ExamCardProps {
  exam: Exam;
  isRegistered?: boolean;
  hasSubmitted?: boolean;
}

export function ExamCard({ exam, isRegistered, hasSubmitted }: ExamCardProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const startTime = (exam as any).startTime ?? (exam as any).start_time;
  const endTime = (exam as any).endTime ?? (exam as any).end_time;
  const status = getExamStatus(startTime, endTime);
  const catColor = CATEGORY_COLORS[exam.category ?? ""] ?? "bg-gray-100 text-gray-700";

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 border-border hover:border-primary/30 overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${catColor}`}>
            {exam.category}
          </span>
          <div className="flex items-center gap-2">
            {isRegistered && (
              <Badge className="bg-green-100 text-green-700 border-green-200 text-xs px-2 py-0.5">
                <CheckCircle className="h-3 w-3 mr-1" />
                Joined
              </Badge>
            )}
            {status === "live" && (
              <Badge className="bg-green-500 text-white text-xs animate-pulse px-2.5 py-0.5">
                🔴 LIVE
              </Badge>
            )}
            {status === "upcoming" && (
              <Badge variant="outline" className="text-xs border-amber-300 text-amber-600 bg-amber-50 px-2.5 py-0.5">
                <Zap className="h-3 w-3 mr-1" />
                {formatTimeLeft(startTime)}
              </Badge>
            )}
            {status === "ended" && (
              <Badge variant="secondary" className="text-xs">
                Ended
              </Badge>
            )}
          </div>
        </div>

        <h3 className="font-bold text-foreground text-lg leading-tight mb-1.5 group-hover:text-primary transition-colors line-clamp-2">
          {exam.title}
        </h3>

        <div className="flex items-center gap-1.5 mb-3">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs text-muted-foreground font-medium">
            {status === "live"
              ? `Ends ${new Date((exam as any).endTime ?? (exam as any).end_time).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${new Date((exam as any).endTime ?? (exam as any).end_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
              : `${new Date((exam as any).startTime ?? (exam as any).start_time).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${new Date((exam as any).startTime ?? (exam as any).start_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <div className="flex flex-col items-center gap-1 bg-muted/50 rounded-lg p-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="font-bold text-primary text-sm">{formatCurrency(exam.prizePool)}</span>
            <span className="text-xs text-muted-foreground">Prize</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-muted/50 rounded-lg p-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-foreground">20 min</span>
            <span className="text-xs text-muted-foreground">Duration</span>
          </div>
          <div className="flex flex-col items-center gap-1 bg-muted/50 rounded-lg p-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-foreground">{formatCurrency(exam.entryFee)}</span>
            <span className="text-xs text-muted-foreground">Entry</span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="px-5 pb-5 pt-0">
        {status === "live" && isRegistered && hasSubmitted === false ? (
          <Button asChild className="w-full bg-green-600 hover:bg-green-700 text-white" size="sm">
            <Link href={`/exam/${exam.id}/take`}>▶ Start Exam Now</Link>
          </Button>
        ) : status === "live" && isRegistered && hasSubmitted === undefined ? (
          <Button asChild className="w-full bg-green-600 hover:bg-green-700 text-white" size="sm">
            <Link href={`/exam/${exam.id}`}>▶ Start Exam Now</Link>
          </Button>
        ) : status === "live" && isRegistered && hasSubmitted ? (
          <Button asChild className="w-full" variant="outline" size="sm">
            <Link href={`/exam/${exam.id}/results`}>Check Your Result</Link>
          </Button>
        ) : status === "ended" && isRegistered && hasSubmitted ? (
          <Button asChild className="w-full" variant="outline" size="sm">
            <Link href={`/exam/${exam.id}/results`}>Check Your Result</Link>
          </Button>
        ) : status === "ended" ? (
          <Button asChild className="w-full" variant="outline" size="sm">
            <Link href={`/exam/${exam.id}/results`}>View Results</Link>
          </Button>
        ) : (
          <Button asChild className="w-full" variant={status === "live" ? "default" : "outline"} size="sm">
            <Link href={`/exam/${exam.id}`}>
              {status === "live" ? "Join Now →" : "View Details →"}
            </Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
