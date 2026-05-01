# HR Readiness Dashboard — Scoring Engine & Question Management

---

## Scoring Equation Specification

### Why This Matters

The scoring system must work **regardless of how many questions exist** per department.
A department with 5 commitment questions and a department with 8 must produce
comparable scores. The equation normalizes everything to a 1–10 scale.

---

### Core Formula

```
                 Σ (score_i × weight_i)
Dimension Score = ─────────────────────────
                    Σ (weight_i)
```

Where:
- `score_i` = the manager's rating (1–10) for question `i`
- `weight_i` = the weight assigned to question `i` (default: 1.0)
- The sum runs over all questions in that dimension (commitment or competency)

**This is a weighted arithmetic mean.** When all weights are equal (the default),
it reduces to a simple average. But the weight field exists so that ROHM can later
mark certain questions as more important (e.g., safety questions in Technical get
weight 1.5) without rebuilding the system.

---

### Worked Example

**Employee: Fatima, Marketing Directorate**

Commitment questions (6 questions, all weight 1):
| Question | Score |
|----------|-------|
| MK-C01   |   8   |
| MK-C02   |   7   |
| MK-C03   |   9   |
| MK-C04   |   6   |
| MK-C05   |   8   |
| MK-C06   |   7   |

```
Commitment Score = (8 + 7 + 9 + 6 + 8 + 7) / 6 = 45 / 6 = 7.50
```

Competency questions (6 questions, all weight 1):
| Question | Score |
|----------|-------|
| MK-K01   |   5   |
| MK-K02   |   6   |
| MK-K03   |   4   |
| MK-K04   |   7   |
| MK-K05   |   5   |
| MK-K06   |   6   |

```
Competency Score = (5 + 6 + 4 + 7 + 5 + 6) / 6 = 33 / 6 = 5.50
```

**Result:** Commitment 7.50, Competency 5.50 → Quadrant: **Growth Potential**

---

### With Weighted Questions (Future Use)

If ROHM decides MK-K01 (campaign execution) is twice as important:

```
Competency Score = (5×2 + 6×1 + 4×1 + 7×1 + 5×1 + 6×1) / (2+1+1+1+1+1)
                 = (10 + 6 + 4 + 7 + 5 + 6) / 7
                 = 38 / 7
                 = 5.43
```

The denominator adjusts automatically. No hardcoded question counts anywhere.

---

### Quadrant Classification

```
                        COMPETENCY
                   Low (<7)    |   High (≥7)
           ┌──────────────────┼───────────────────┐
 C  High   │ Growth Potential │  Star Performer    │
 O  (≥7)   │ (train skills)   │  (leverage/grow)   │
 M         ├──────────────────┼───────────────────┤
 M  Low    │ At Risk          │  Underutilized     │
 I  (<7)   │ (intervene now)  │  (re-engage)       │
 T         └──────────────────┴───────────────────┘
```

Threshold: **7.0** (configurable in dashboard settings)

```typescript
function classifyQuadrant(
  commitment: number,
  competency: number,
  threshold: number = 7.0
): QuadrantLabel {
  if (commitment >= threshold && competency >= threshold) return 'Star Performer';
  if (commitment >= threshold && competency < threshold)  return 'Growth Potential';
  if (commitment < threshold  && competency >= threshold) return 'Underutilized';
  return 'At Risk';
}
```

---

### Aggregation Formulas

**Department Level:**
```
Dept Commitment  = average of all employee commitment scores in department
Dept Competency  = average of all employee competency scores in department
Gap Direction    = if (Dept Commitment - Dept Competency) > 1.0 → "Competency Gap"
                   if (Dept Competency - Dept Commitment) > 1.0 → "Motivation Gap"
                   else → "Balanced"
```

**Organization Level:**
```
Org Commitment   = average of all department commitment scores (weighted by headcount)
Org Competency   = average of all department competency scores (weighted by headcount)
Primary Gap      = same logic as department, applied org-wide
```

Headcount-weighted means a department of 60 people influences the org score
more than a department of 2. This prevents tiny departments from skewing results.

---

## Cursor Prompt — Section 2B: Question Management Feature

> Feed this to Cursor AFTER Section 2 (Data Model & Fixtures) is complete.

```
Add a Question Management system to the HR Readiness Dashboard.
This lets administrators edit, add, remove, and reorder assessment questions
per department — without touching code.

ROUTE: app/settings/questions/page.tsx

LAYOUT:

TOP: Department selector dropdown (lists all 14 departments)

On department selection, display TWO side-by-side panels:

LEFT PANEL — Commitment Questions:
- Header: "Commitment Questions" with a count badge (e.g., "6 questions")
- Each question displayed as an editable card:
  - Full question text (editable textarea, auto-expanding)
  - Weight control: number input (default 1.0, range 0.5–3.0, step 0.5)
  - Drag handle on the left for reordering (use @dnd-kit/sortable)
  - Delete button (trash icon) with confirmation dialog
- "Add Question" button at the bottom of the list
  - Clicking adds a new blank card at the bottom
  - Auto-focuses the textarea for immediate typing

RIGHT PANEL — Competency Questions:
- Identical layout to the left panel

BOTTOM BAR (sticky):
- "Save Changes" button — saves to Zustand store and updates the JSON in memory
- "Reset to Default" button — reverts to the original question set for this department
- "Export Questions (JSON)" — downloads the current question config as a .json file
- "Import Questions (JSON)" — file upload to bulk-load questions from a .json file
- Unsaved changes indicator: if edits exist, show a yellow dot on the Save button
  and a "You have unsaved changes" banner

VALIDATION:
- Question text cannot be empty
- Weight must be between 0.5 and 3.0
- Minimum 3 questions per dimension (commitment and competency each)
- Maximum 12 questions per dimension
- Show inline validation errors

SCORING EQUATION (implement in lib/scoring.ts):

The scoring formula is a weighted mean that works with ANY number of questions:

  Dimension Score = Σ(score_i × weight_i) / Σ(weight_i)

Where:
- score_i = the manager's 1–10 rating on question i
- weight_i = the weight assigned to question i (from question management)

When all weights are 1.0, this is a simple average.
When weights vary, higher-weighted questions influence the score proportionally more.
The formula self-adjusts — adding or removing questions does NOT break scoring.

Quadrant classification uses a configurable threshold (default 7.0):
- Commitment >= threshold AND Competency >= threshold → "Star Performer"
- Commitment >= threshold AND Competency < threshold  → "Growth Potential"
- Commitment < threshold  AND Competency >= threshold → "Underutilized"
- Both < threshold → "At Risk"

Department aggregation = mean of employee scores (simple average across employees)
Org aggregation = headcount-weighted mean of department scores

IMPORTANT: The threshold (7.0) should also be configurable from a settings panel.
Add a small "Scoring Settings" card above the question panels with:
- Threshold slider (range 5.0–9.0, step 0.5, default 7.0)
- Live preview: as the threshold changes, show how many employees would fall
  into each quadrant at that threshold (just counts, no chart needed)

SIDEBAR UPDATE:
- Add "Settings" as a new nav item in the sidebar with a gear icon
- Subitems: "Assessment Questions", "Scoring Configuration"

Use shadcn/ui components: Card, Input, Textarea, Button, Select, Slider, Dialog,
Badge, Separator. Use @dnd-kit/core and @dnd-kit/sortable for drag-and-drop.
Persist all changes in Zustand store.
```

---

## Data File Reference

The question bank is stored in `rohm-questions.json` (provided separately).
It contains tailored questions for all 14 ROHM departments.

Structure per department:
```json
{
  "departmentId": "marketing",
  "departmentName": "Marketing Directorate",
  "commitment": [
    { "qId": "MK-C01", "text": "...", "weight": 1 }
  ],
  "competency": [
    { "qId": "MK-K01", "text": "...", "weight": 1 }
  ]
}
```

The `qId` format follows: `[DEPT_PREFIX]-[C or K][NUMBER]`
- C = Commitment, K = Knowledge/Competency
- This makes question IDs human-readable and department-traceable
