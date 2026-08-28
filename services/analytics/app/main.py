from __future__ import annotations
from datetime import datetime, timezone
from typing import Any
import math
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Proofline Analytics", version="0.1.0")

class Question(BaseModel):
    id: str
    type: str
    prompt: str
    dimension: str | None = None
    weight: float = 1.0
    reverseScore: bool = False
    config: dict[str, Any] | None = None

class Response(BaseModel):
    participant: str
    answers: dict[str, Any]
    segments: dict[str, str] = Field(default_factory=dict)

class AnalysisPayload(BaseModel):
    assessmentId: str
    title: str
    objective: str
    questions: list[Question]
    responses: list[Response] = Field(default_factory=list)
    locale: str = "es"
    minCohortSize: int = 7

def numeric_score(question: Question, value: Any) -> float | None:
    if question.type in {"LIKERT", "NPS", "NUMERIC", "RANGE", "PERCENTAGE", "SLIDER"}:
        try:
            n = float(value)
        except (TypeError, ValueError):
            return None
        if question.type == "LIKERT":
            minimum = float((question.config or {}).get("min", 1))
            maximum = float((question.config or {}).get("max", 5))
            if maximum <= minimum:
                return None
            normalized = (n - minimum) / (maximum - minimum) * 100
            return 100 - normalized if question.reverseScore else normalized
        if question.type == "NPS":
            return max(0.0, min(100.0, n * 10))
        return max(0.0, min(100.0, n))
    if question.type == "YES_NO":
        if str(value).lower() in {"yes", "si", "sí", "true", "1"}: return 100.0
        if str(value).lower() in {"no", "false", "0"}: return 0.0
        return None
    if question.type == "SINGLE":
        options = (question.config or {}).get("options", [])
        for option in options:
            if isinstance(option, dict) and str(option.get("value")) == str(value) and option.get("score") is not None:
                return max(0.0, min(100.0, float(option.get("score"))))
        return None
    if question.type == "MATRIX" and isinstance(value, dict):
        columns = (question.config or {}).get("columns", [])
        numeric = []
        for selected in value.values():
            try: numeric.append(float(selected))
            except (TypeError, ValueError): pass
        if not numeric: return None
        col_values=[]
        for col in columns:
            try: col_values.append(float(col.get("value") if isinstance(col,dict) else col))
            except (TypeError,ValueError): pass
        minimum=min(col_values) if col_values else min(numeric); maximum=max(col_values) if col_values else max(numeric)
        if maximum<=minimum: return None
        return max(0.0,min(100.0,(float(np.mean(numeric))-minimum)/(maximum-minimum)*100))
    if question.type == "DUAL" and isinstance(value, dict):
        try:
            minimum=float((question.config or {}).get("min",1)); maximum=float((question.config or {}).get("max",5))
            importance = float(value.get("importance")); performance = float(value.get("performance"))
            if maximum<=minimum: return None
            normalized=(performance-minimum)/(maximum-minimum)*100
            return max(0.0,min(100.0,normalized))
        except (TypeError, ValueError): return None
    return None

def qualitative_themes(payload: AnalysisPayload) -> list[dict[str, Any]]:
    # Deterministic demo fallback. Production will use bounded AI only after PII minimization.
    keywords = {
        "communication": ["comunica", "comunicación", "claridad", "contexto", "decisiones", "explicar", "explain"],
        "recognition": ["reconocimiento", "reconocer", "recognition"],
        "listening": ["escucha", "escuchar", "listen"],
        "timing": ["tarde", "tiempo", "late", "prioridades", "priorities"],
    }
    counts = {key: 0 for key in keywords}
    examples: dict[str, str] = {}
    for response in payload.responses:
        for q in payload.questions:
            if q.type not in {"LONG_TEXT", "SHORT_TEXT"}:
                continue
            value = response.answers.get(q.id)
            if not isinstance(value, str):
                continue
            lower = value.lower()
            for theme, words in keywords.items():
                if any(word in lower for word in words):
                    counts[theme] += 1
                    examples.setdefault(theme, value[:180])
    return [
        {"theme": k, "mentions": v, "example": examples.get(k)}
        for k, v in sorted(counts.items(), key=lambda item: item[1], reverse=True)
        if v > 0
    ]

@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "proofline-analytics", "version": "0.1.0"}

@app.post("/analyze")
def analyze(payload: AnalysisPayload) -> dict[str, Any]:
    question_scores: dict[str, float] = {}
    dimension_values: dict[str, list[tuple[float, float]]] = {}
    dual_gaps: list[dict[str, Any]] = []

    for question in payload.questions:
        values: list[float] = []
        for response in payload.responses:
            raw = response.answers.get(question.id)
            score = numeric_score(question, raw)
            if score is not None and not math.isnan(score):
                values.append(score)
            if question.type == "DUAL" and isinstance(raw, dict):
                try:
                    gap = float(raw.get("performance")) - float(raw.get("importance"))
                    dual_gaps.append({"questionId": question.id, "dimension": question.dimension, "gap": gap})
                except (TypeError, ValueError):
                    pass
        if values:
            mean = float(np.mean(values))
            question_scores[question.id] = round(mean, 1)
            if question.dimension:
                dimension_values.setdefault(question.dimension, []).append((mean, question.weight))

    dimension_scores: dict[str, float] = {}
    for dimension, weighted in dimension_values.items():
        denominator = sum(weight for _, weight in weighted) or 1.0
        dimension_scores[dimension] = round(sum(value * weight for value, weight in weighted) / denominator, 1)

    overall = round(float(np.mean(list(dimension_scores.values()))), 1) if dimension_scores else None
    sorted_dimensions = sorted(dimension_scores.items(), key=lambda item: item[1])
    highlights: list[str] = []
    if sorted_dimensions:
        low_name, low_score = sorted_dimensions[0]
        high_name, high_score = sorted_dimensions[-1]
        if payload.locale == "es":
            highlights.append(f"{high_name} es la dimensión con mayor puntuación: {high_score}/100.")
            if low_name != high_name:
                highlights.append(f"{low_name} es la principal dimensión a investigar: {low_score}/100.")
        else:
            highlights.append(f"{high_name} is the strongest measured dimension at {high_score}/100.")
            if low_name != high_name:
                highlights.append(f"{low_name} is the main area to investigate at {low_score}/100.")
    if dual_gaps:
        avg_gap = round(float(np.mean([item["gap"] for item in dual_gaps])), 2)
        highlights.append((f"Brecha media importancia/desempeño: {avg_gap} puntos en la escala original." if payload.locale == "es" else f"Average importance/performance gap: {avg_gap} points on the original scale."))
    if not payload.responses:
        highlights.append("Todavía no hay respuestas completas." if payload.locale == "es" else "No completed responses are available yet.")

    choice_distributions: dict[str, dict[str, int]] = {}
    ranking_results: dict[str, list[dict[str, Any]]] = {}
    allocation_results: dict[str, dict[str, float]] = {}
    matrix_distributions: dict[str, dict[str, dict[str, int]]] = {}
    for q in payload.questions:
        if q.type in {"SINGLE","MULTI","CHECKBOX","YES_NO"}:
            counts: dict[str,int] = {}
            for r in payload.responses:
                raw=r.answers.get(q.id); vals=raw if isinstance(raw,list) else ([] if raw is None else [raw])
                for item in vals: counts[str(item)]=counts.get(str(item),0)+1
            if counts: choice_distributions[q.id]=counts
        elif q.type == "RANKING":
            ranks: dict[str,list[int]]={}
            for r in payload.responses:
                raw=r.answers.get(q.id)
                if isinstance(raw,list):
                    for pos,item in enumerate(raw,1): ranks.setdefault(str(item),[]).append(pos)
            if ranks: ranking_results[q.id]=sorted([{"option":k,"averageRank":round(float(np.mean(v)),2),"n":len(v)} for k,v in ranks.items()],key=lambda x:x["averageRank"])
        elif q.type == "ALLOCATION":
            vals: dict[str,list[float]]={}
            for r in payload.responses:
                raw=r.answers.get(q.id)
                if isinstance(raw,dict):
                    for k,v in raw.items():
                        try: vals.setdefault(str(k),[]).append(float(v))
                        except (TypeError,ValueError): pass
            if vals: allocation_results[q.id]={k:round(float(np.mean(v)),1) for k,v in vals.items()}
        elif q.type == "MATRIX":
            rows: dict[str,dict[str,int]]={}
            for r in payload.responses:
                raw=r.answers.get(q.id)
                if isinstance(raw,dict):
                    for row,col in raw.items(): rows.setdefault(str(row),{})[str(col)]=rows.setdefault(str(row),{}).get(str(col),0)+1
            if rows: matrix_distributions[q.id]=rows

    cohort_scores: dict[str, dict[str, float]] = {}
    segment_names = sorted({k for r in payload.responses for k in r.segments.keys()})
    for segment in segment_names:
        values = sorted({r.segments.get(segment) for r in payload.responses if r.segments.get(segment)})
        for value in values:
            subset = [r for r in payload.responses if r.segments.get(segment) == value]
            if len(subset) < payload.minCohortSize:
                cohort_scores[f"{segment}:{value}"] = {"suppressed": True, "n": len(subset)}
                continue
            scores=[]
            for r in subset:
                for q in payload.questions:
                    sc=numeric_score(q,r.answers.get(q.id))
                    if sc is not None: scores.append(sc)
            cohort_scores[f"{segment}:{value}"] = {"suppressed": False, "n": len(subset), "score": round(float(np.mean(scores)),1) if scores else None}

    return {
        "engine": {"name": "proofline-deterministic", "version": "0.1.0", "aiUsed": False},
        "assessmentId": payload.assessmentId,
        "objective": payload.objective,
        "completedResponses": len(payload.responses),
        "overallScore": overall,
        "dimensionScores": dimension_scores,
        "questionScores": question_scores,
        "dualGaps": dual_gaps,
        "qualitativeThemes": qualitative_themes(payload),
        "choiceDistributions": choice_distributions,
        "rankingResults": ranking_results,
        "allocationResults": allocation_results,
        "matrixDistributions": matrix_distributions,
        "cohorts": cohort_scores,
        "highlights": highlights,
        "evidencePolicy": "Sólo observación; el motor local no genera afirmaciones causales." if payload.locale == "es" else "Observation only; no causal claim is generated by this local engine.",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
