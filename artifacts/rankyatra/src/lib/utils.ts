import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getApiUrl(path: string): string {
  const base = import.meta.env.VITE_API_BASE_URL ?? "";
  return `${base}${path}`;
}

export function formatUID(id: number): string {
  return `RY${String(id).padStart(10, "0")}`;
}

export function formatCurrency(amount: number | string) {
  return "₹" + Number(amount).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function getExamStatus(startTime: string, endTime: string): "upcoming" | "live" | "ended" {
  const now = Date.now();
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  if (now < start) return "upcoming";
  if (now >= start && now <= end) return "live";
  return "ended";
}

export function formatTimeLeft(startTime: string): string {
  const diff = new Date(startTime).getTime() - Date.now();
  if (diff <= 0) return "Starting now";
  const totalSecs = Math.floor(diff / 1000);
  const secs = totalSecs % 60;
  const mins = Math.floor(totalSecs / 60) % 60;
  const hrs = Math.floor(totalSecs / 3600) % 24;
  const days = Math.floor(totalSecs / 86400);
  if (days > 0) return `In ${days}d ${hrs}h ${mins}m ${secs}s`;
  if (hrs > 0) return `In ${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `In ${mins}m ${secs}s`;
  return `In ${secs}s`;
}
