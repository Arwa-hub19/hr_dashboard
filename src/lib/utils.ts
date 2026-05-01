import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatScore(score: number): string {
  return score.toFixed(1);
}

export function formatMonth(month: number, year: number): string {
  const names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[month]} ${year}`;
}

export function formatMonthFull(month: number, year: number): string {
  const names = ["", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  return `${names[month]} ${year}`;
}

export function getQuadrantBadgeClass(quadrant: string): string {
  switch (quadrant) {
    case "Star Performer": return "badge-star";
    case "Growth Potential": return "badge-growth";
    case "Underutilized": return "badge-underutil";
    case "At Risk": return "badge-risk";
    default: return "badge";
  }
}

export function getGapColor(gap: string): string {
  switch (gap) {
    case "Competency Gap": return "#3565a8";
    case "Motivation Gap": return "#b8973a";
    case "Balanced": return "#2d7a4f";
    default: return "#6b4a3d";
  }
}

export function getScoreColor(score: number): string {
  if (score >= 8) return "#2d7a4f";
  if (score >= 6) return "#3565a8";
  if (score >= 4) return "#b8860b";
  return "#b33a3a";
}
