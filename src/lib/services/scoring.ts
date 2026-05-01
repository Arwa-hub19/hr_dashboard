import type {
  QuadrantLabel,
  GapDirection,
  QuadrantDistribution,
  AssessmentResponse,
  QuestionSnapshot,
  InterventionRecommendation,
} from "../types";

/* ═══════════════════════════════════════════════════
   Core scoring formula: weighted arithmetic mean
   
   Σ(score_i × weight_i) / Σ(weight_i)
   
   Self-normalizing — works with any number of questions.
   When all weights are 1.0, this is a simple average.
   ═══════════════════════════════════════════════════ */

export function calculateDimensionScore(
  responses: { questionId: string; score: number }[],
  questions: { id: string; weight: number }[]
): number {
  if (responses.length === 0) return 0;

  const weightMap = new Map(questions.map((q) => [q.id, q.weight]));
  let weightedSum = 0;
  let totalWeight = 0;

  for (const r of responses) {
    const w = weightMap.get(r.questionId) ?? 1.0;
    weightedSum += r.score * w;
    totalWeight += w;
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) / 100 : 0;
}

/* ═══════════════════════════════════════════════════
   Quadrant classification
   ═══════════════════════════════════════════════════ */

export function classifyQuadrant(
  commitment: number,
  competency: number,
  threshold: number = 7.0
): QuadrantLabel {
  if (commitment >= threshold && competency >= threshold) return "Star Performer";
  if (commitment >= threshold && competency < threshold) return "Growth Potential";
  if (commitment < threshold && competency >= threshold) return "Underutilized";
  return "At Risk";
}

/* ═══════════════════════════════════════════════════
   Gap direction
   ═══════════════════════════════════════════════════ */

export function determineGap(avgCommitment: number, avgCompetency: number): GapDirection {
  const diff = avgCommitment - avgCompetency;
  if (diff > 1.0) return "Competency Gap";
  if (diff < -1.0) return "Motivation Gap";
  return "Balanced";
}

/* ═══════════════════════════════════════════════════
   Quadrant distribution helper
   ═══════════════════════════════════════════════════ */

export function emptyDistribution(): QuadrantDistribution {
  return {
    "Star Performer": 0,
    "Growth Potential": 0,
    "Underutilized": 0,
    "At Risk": 0,
  };
}

export function buildDistribution(quadrants: QuadrantLabel[]): QuadrantDistribution {
  const dist = emptyDistribution();
  for (const q of quadrants) {
    dist[q]++;
  }
  return dist;
}

/* ═══════════════════════════════════════════════════
   Aggregate scores (simple average across employees)
   ═══════════════════════════════════════════════════ */

export function aggregateScores(
  scores: { commitment: number; competency: number }[]
): { avgCommitment: number; avgCompetency: number } {
  if (scores.length === 0) return { avgCommitment: 0, avgCompetency: 0 };

  const totalC = scores.reduce((sum, s) => sum + s.commitment, 0);
  const totalK = scores.reduce((sum, s) => sum + s.competency, 0);

  return {
    avgCommitment: Math.round((totalC / scores.length) * 10) / 10,
    avgCompetency: Math.round((totalK / scores.length) * 10) / 10,
  };
}

/* ═══════════════════════════════════════════════════
   Headcount-weighted org aggregation
   ═══════════════════════════════════════════════════ */

export function weightedOrgAverage(
  departments: { avgCommitment: number; avgCompetency: number; count: number }[]
): { avgCommitment: number; avgCompetency: number } {
  let totalC = 0, totalK = 0, totalW = 0;

  for (const d of departments) {
    totalC += d.avgCommitment * d.count;
    totalK += d.avgCompetency * d.count;
    totalW += d.count;
  }

  return {
    avgCommitment: totalW > 0 ? Math.round((totalC / totalW) * 10) / 10 : 0,
    avgCompetency: totalW > 0 ? Math.round((totalK / totalW) * 10) / 10 : 0,
  };
}

/* ═══════════════════════════════════════════════════
   Score from snapshot (for historical assessments)
   ═══════════════════════════════════════════════════ */

export function scoreFromSnapshot(
  responses: AssessmentResponse[],
  snapshot: QuestionSnapshot[],
  dimension: "commitment" | "competency"
): number {
  const dimResponses = responses.filter((r) => r.dimension === dimension);
  const dimQuestions = snapshot
    .filter((q) => q.dimension === dimension)
    .map((q) => ({ id: q.id, weight: q.weight }));

  return calculateDimensionScore(
    dimResponses.map((r) => ({ questionId: r.questionId, score: r.score })),
    dimQuestions
  );
}

/* ═══════════════════════════════════════════════════
   Intervention recommendations
   ═══════════════════════════════════════════════════ */

export function generateInterventions(
  distribution: QuadrantDistribution,
  total: number
): InterventionRecommendation[] {
  if (total === 0) return [];

  const interventions: InterventionRecommendation[] = [];
  const gpPct = distribution["Growth Potential"] / total;
  const uuPct = distribution["Underutilized"] / total;
  const arPct = distribution["At Risk"] / total;
  const spPct = distribution["Star Performer"] / total;

  if (gpPct > 0.3) {
    interventions.push({
      type: "training",
      title: "Targeted Skills Training Program",
      description: `${distribution["Growth Potential"]} employees show high motivation but need skill development. Consider structured training, mentoring, and competency workshops.`,
      employeeCount: distribution["Growth Potential"],
      color: "#3565a8",
    });
  }

  if (uuPct > 0.3) {
    interventions.push({
      type: "engagement",
      title: "Engagement & Recognition Initiative",
      description: `${distribution["Underutilized"]} skilled employees need re-engagement. Consider recognition programs, stretch assignments, and career conversations.`,
      employeeCount: distribution["Underutilized"],
      color: "#b8860b",
    });
  }

  if (arPct > 0.2) {
    interventions.push({
      type: "critical",
      title: "Critical — Immediate Attention Required",
      description: `${distribution["At Risk"]} employees require immediate management intervention across both commitment and competency dimensions.`,
      employeeCount: distribution["At Risk"],
      color: "#b33a3a",
    });
  }

  if (spPct > 0.6) {
    interventions.push({
      type: "strength",
      title: "Department Strength — Knowledge Sharing",
      description: `${distribution["Star Performer"]} star performers present an opportunity for internal mentoring and knowledge transfer programs.`,
      employeeCount: distribution["Star Performer"],
      color: "#2d7a4f",
    });
  }

  return interventions;
}

/* ═══════════════════════════════════════════════════
   Quadrant styling constants
   ═══════════════════════════════════════════════════ */

export const QUADRANT_CONFIG: Record<QuadrantLabel, { color: string; bg: string; label: string }> = {
  "Star Performer": { color: "#2d7a4f", bg: "#2d7a4f12", label: "SP" },
  "Growth Potential": { color: "#3565a8", bg: "#3565a812", label: "GP" },
  "Underutilized": { color: "#b8860b", bg: "#b8860b12", label: "UU" },
  "At Risk": { color: "#b33a3a", bg: "#b33a3a12", label: "AR" },
};

export const GAP_CONFIG: Record<GapDirection, { color: string; bg: string }> = {
  "Competency Gap": { color: "#3565a8", bg: "#3565a812" },
  "Motivation Gap": { color: "#b8973a", bg: "#b8973a12" },
  "Balanced": { color: "#2d7a4f", bg: "#2d7a4f12" },
};
