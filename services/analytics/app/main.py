from __future__ import annotations
from datetime import datetime, timezone
from hashlib import sha256
from typing import Any
import json
import math
import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="Proofline Analytics", version="0.3.0")


class Question(BaseModel):
    id: str
    code: str | None = None
    type: str
    prompt: str
    dimension: str | None = None
    scored: bool = True
    weight: float = 1.0
    polarity: str = "POSITIVE"
    reverseScore: bool = False
    config: dict[str, Any] | None = None


class Response(BaseModel):
    participant: str
    answers: dict[str, Any]
    segments: dict[str, str] = Field(default_factory=dict)


class AnalysisPayload(BaseModel):
    assessmentId: str
    assessmentVersionId: str | None = None
    assessmentVersion: int | None = None
    assessmentLevel: str = "L2"
    scoringConfig: dict[str, Any] = Field(default_factory=dict)
    title: str
    objective: str
    questions: list[Question]
    responses: list[Response] = Field(default_factory=list)
    locale: str = "es"
    minCohortSize: int = 7
    sourceHash: str | None = None


def _apply_polarity(question: Question, score: float) -> float:
    polarity = (question.polarity or ("REVERSE" if question.reverseScore else "POSITIVE")).upper()
    bounded = max(0.0, min(100.0, score))
    return 100.0 - bounded if polarity == "REVERSE" else bounded


def _normalized_number(value: Any, minimum: float, maximum: float) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if maximum <= minimum or number < minimum or number > maximum:
        return None
    return (number - minimum) / (maximum - minimum) * 100.0


def _custom_score(question: Question, value: Any) -> float | None:
    config = question.config or {}
    custom = config.get("customScores")
    if isinstance(custom, dict) and str(value) in custom:
        try:
            return max(0.0, min(100.0, float(custom[str(value)])))
        except (TypeError, ValueError):
            return None
    return None


def _is_na(value: Any) -> bool:
    return isinstance(value, str) and value.strip().lower() in {"na", "n/a", "no aplica", "not applicable"}


def _is_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and not value.strip():
        return True
    if isinstance(value, (list, dict)) and len(value) == 0:
        return True
    return False


def numeric_score(question: Question, value: Any) -> float | None:
    if not question.scored or _is_na(value):
        return None
    config = question.config or {}
    polarity = (question.polarity or ("REVERSE" if question.reverseScore else "POSITIVE")).upper()

    if polarity == "CUSTOM":
        custom = _custom_score(question, value)
        if custom is not None:
            return custom

    if question.type in {"LIKERT", "NPS", "NUMERIC", "RANGE", "PERCENTAGE", "SLIDER"}:
        default_min = 0 if question.type in {"NPS", "PERCENTAGE"} else 1 if question.type == "LIKERT" else 0
        default_max = 10 if question.type == "NPS" else 100 if question.type in {"PERCENTAGE", "NUMERIC"} else 5 if question.type == "LIKERT" else 10
        normalized = _normalized_number(value, float(config.get("min", default_min)), float(config.get("max", default_max)))
        return None if normalized is None else _apply_polarity(question, normalized)

    if question.type == "YES_NO":
        custom = _custom_score(question, value)
        if custom is not None:
            return custom
        raw = str(value).lower()
        if raw in {"yes", "si", "sí", "true", "1"}:
            return _apply_polarity(question, 100.0)
        if raw in {"no", "false", "0"}:
            return _apply_polarity(question, 0.0)
        return None

    if question.type == "SINGLE":
        options = config.get("options", [])
        for option in options:
            if isinstance(option, dict) and str(option.get("value")) == str(value) and option.get("score") is not None:
                try:
                    return _apply_polarity(question, float(option.get("score")))
                except (TypeError, ValueError):
                    return None
        return _custom_score(question, value)

    if question.type in {"MULTI", "CHECKBOX"} and isinstance(value, list):
        option_map: dict[str, float] = {}
        for option in config.get("options", []):
            if isinstance(option, dict) and option.get("score") is not None:
                try:
                    option_map[str(option.get("value"))] = float(option.get("score"))
                except (TypeError, ValueError):
                    pass
        scores = [option_map[str(item)] for item in value if str(item) in option_map]
        if scores:
            return _apply_polarity(question, float(np.mean(scores)))
        return None

    if question.type == "MATRIX" and isinstance(value, dict):
        columns = config.get("columns", [])
        numeric = []
        for selected in value.values():
            try:
                numeric.append(float(selected))
            except (TypeError, ValueError):
                pass
        if not numeric:
            return None
        column_values = []
        for column in columns:
            try:
                column_values.append(float(column.get("value") if isinstance(column, dict) else column))
            except (TypeError, ValueError):
                pass
        minimum = min(column_values) if column_values else min(numeric)
        maximum = max(column_values) if column_values else max(numeric)
        normalized = _normalized_number(float(np.mean(numeric)), minimum, maximum)
        return None if normalized is None else _apply_polarity(question, normalized)

    if question.type == "DUAL" and isinstance(value, dict):
        try:
            minimum = float(config.get("min", 1))
            maximum = float(config.get("max", 5))
            performance = float(value.get("performance"))
        except (TypeError, ValueError):
            return None
        normalized = _normalized_number(performance, minimum, maximum)
        return None if normalized is None else _apply_polarity(question, normalized)

    return None


def target_score(question: Question) -> float | None:
    config = question.config or {}
    if "target" not in config:
        return None
    target = config.get("target")
    if target is None or target == "":
        return None

    if question.type in {"MULTI", "CHECKBOX"} and isinstance(target, str):
        target = [part.strip() for part in target.split(",") if part.strip()]
    elif question.type == "MATRIX" and not isinstance(target, dict):
        columns = config.get("columns", [])
        column_values: list[float] = []
        for column in columns:
            try:
                column_values.append(float(column.get("value") if isinstance(column, dict) else column))
            except (TypeError, ValueError):
                pass
        if column_values:
            normalized = _normalized_number(target, min(column_values), max(column_values))
            return None if normalized is None else _apply_polarity(question, normalized)
    elif question.type == "DUAL" and not isinstance(target, dict):
        try:
            minimum = float(config.get("min", 1))
            maximum = float(config.get("max", 5))
        except (TypeError, ValueError):
            return None
        normalized = _normalized_number(target, minimum, maximum)
        return None if normalized is None else _apply_polarity(question, normalized)

    return numeric_score(question, target)


def _aggregate_scores(payload: AnalysisPayload, responses: list[Response]) -> dict[str, Any]:
    question_scores: dict[str, float] = {}
    question_samples: dict[str, dict[str, int]] = {}
    dimension_values: dict[str, list[tuple[str, float, float]]] = {}
    response_score_presence: dict[str, set[str]] = {response.participant: set() for response in responses}

    for question in payload.questions:
        if not question.scored:
            continue
        values: list[float] = []
        total = len(responses)
        missing = 0
        na = 0
        invalid = 0
        for response in responses:
            raw = response.answers.get(question.id)
            if _is_missing(raw):
                missing += 1
                continue
            if _is_na(raw):
                na += 1
                continue
            score = numeric_score(question, raw)
            if score is None or math.isnan(score):
                invalid += 1
                continue
            values.append(score)
            response_score_presence[response.participant].add(question.id)
        question_samples[question.id] = {
            "total": total,
            "answered": total - missing,
            "scored": len(values),
            "na": na,
            "missing": missing,
            "invalid": invalid,
        }
        if values:
            mean = float(np.mean(values))
            question_scores[question.id] = round(mean, 1)
            if question.dimension:
                dimension_values.setdefault(question.dimension, []).append((question.id, mean, question.weight))

    dimension_scores: dict[str, float] = {}
    dimension_samples: dict[str, int] = {}
    for dimension, weighted in dimension_values.items():
        denominator = sum(weight for _, _, weight in weighted) or 1.0
        dimension_scores[dimension] = round(sum(value * weight for _, value, weight in weighted) / denominator, 1)
        qids = {qid for qid, _, _ in weighted}
        dimension_samples[dimension] = sum(1 for present in response_score_presence.values() if present.intersection(qids))

    dimension_weights_raw = (payload.scoringConfig or {}).get("dimensionWeights", {})
    dimension_weights = dimension_weights_raw if isinstance(dimension_weights_raw, dict) else {}
    if dimension_scores:
        weighted_total = 0.0
        weight_total = 0.0
        for dimension, score in dimension_scores.items():
            try:
                weight = float(dimension_weights.get(dimension, 1.0))
            except (TypeError, ValueError):
                weight = 1.0
            if weight <= 0:
                weight = 1.0
            weighted_total += score * weight
            weight_total += weight
        overall = round(weighted_total / weight_total, 1) if weight_total else None
    else:
        overall = None

    dimension_question_ids = {qid for weighted in dimension_values.values() for qid, _, _ in weighted}
    overall_n = sum(1 for present in response_score_presence.values() if present.intersection(dimension_question_ids))
    return {
        "questionScores": question_scores,
        "dimensionScores": dimension_scores,
        "overallScore": overall,
        "questionSamples": question_samples,
        "dimensionSamples": dimension_samples,
        "overallN": overall_n,
        "dimensionValues": dimension_values,
        "dimensionWeights": dimension_weights,
    }


def _target_metrics(payload: AnalysisPayload, aggregate: dict[str, Any]) -> dict[str, Any]:
    question_scores: dict[str, float] = aggregate["questionScores"]
    dimension_values: dict[str, list[tuple[str, float, float]]] = aggregate["dimensionValues"]
    dimension_scores: dict[str, float] = aggregate["dimensionScores"]
    dimension_weights: dict[str, Any] = aggregate["dimensionWeights"]

    question_targets: dict[str, float] = {}
    question_gaps: dict[str, float] = {}
    target_warnings: list[dict[str, str]] = []
    questions_by_id = {q.id: q for q in payload.questions}

    for question in payload.questions:
        config = question.config or {}
        if not question.scored or "target" not in config:
            continue
        raw_target = config.get("target")
        if raw_target is None or raw_target == "":
            continue
        target = target_score(question)
        if target is None:
            target_warnings.append({"questionId": question.id, "code": question.code or question.id, "reason": "TARGET_NOT_SCOREABLE"})
            continue
        target = round(target, 1)
        question_targets[question.id] = target
        if question.id in question_scores:
            question_gaps[question.id] = round(target - question_scores[question.id], 1)

    dimension_targets: dict[str, float] = {}
    dimension_gaps: dict[str, float] = {}
    dimension_target_coverage: dict[str, dict[str, int | bool]] = {}
    for dimension, weighted in dimension_values.items():
        observed_qids = [qid for qid, _, _ in weighted]
        targeted = [qid for qid in observed_qids if qid in question_targets]
        complete = bool(observed_qids) and len(targeted) == len(observed_qids)
        dimension_target_coverage[dimension] = {
            "targeted": len(targeted),
            "scored": len(observed_qids),
            "complete": complete,
        }
        if not complete:
            continue
        numerator = 0.0
        denominator = 0.0
        for qid, _, weight in weighted:
            q = questions_by_id[qid]
            normalized_weight = float(q.weight if q.weight > 0 else weight)
            numerator += question_targets[qid] * normalized_weight
            denominator += normalized_weight
        if denominator:
            target = round(numerator / denominator, 1)
            dimension_targets[dimension] = target
            dimension_gaps[dimension] = round(target - dimension_scores[dimension], 1)

    overall_target: float | None = None
    overall_gap: float | None = None
    if dimension_scores and len(dimension_targets) == len(dimension_scores):
        total = 0.0
        denominator = 0.0
        for dimension, target in dimension_targets.items():
            try:
                weight = float(dimension_weights.get(dimension, 1.0))
            except (TypeError, ValueError):
                weight = 1.0
            if weight <= 0:
                weight = 1.0
            total += target * weight
            denominator += weight
        if denominator:
            overall_target = round(total / denominator, 1)
            if aggregate["overallScore"] is not None:
                overall_gap = round(overall_target - aggregate["overallScore"], 1)

    return {
        "questionTargets": question_targets,
        "questionGaps": question_gaps,
        "dimensionTargets": dimension_targets,
        "dimensionGaps": dimension_gaps,
        "dimensionTargetCoverage": dimension_target_coverage,
        "overallTarget": overall_target,
        "overallGap": overall_gap,
        "targetWarnings": target_warnings,
        "gapConvention": "target-minus-observed",
    }


def qualitative_themes(payload: AnalysisPayload) -> list[dict[str, Any]]:
    # Deterministic local fallback. Bounded AI may enrich interpretation later, never scoring.
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


def _structured_distributions(payload: AnalysisPayload) -> dict[str, Any]:
    choice_distributions: dict[str, dict[str, int]] = {}
    ranking_results: dict[str, list[dict[str, Any]]] = {}
    allocation_results: dict[str, dict[str, float]] = {}
    matrix_distributions: dict[str, dict[str, dict[str, int]]] = {}
    for q in payload.questions:
        if q.type in {"SINGLE", "MULTI", "CHECKBOX", "YES_NO"}:
            counts: dict[str, int] = {}
            for r in payload.responses:
                raw = r.answers.get(q.id)
                vals = raw if isinstance(raw, list) else ([] if raw is None else [raw])
                for item in vals:
                    counts[str(item)] = counts.get(str(item), 0) + 1
            if counts:
                choice_distributions[q.id] = counts
        elif q.type == "RANKING":
            ranks: dict[str, list[int]] = {}
            for r in payload.responses:
                raw = r.answers.get(q.id)
                if isinstance(raw, list):
                    for pos, item in enumerate(raw, 1):
                        ranks.setdefault(str(item), []).append(pos)
            if ranks:
                ranking_results[q.id] = sorted(
                    [{"option": k, "averageRank": round(float(np.mean(v)), 2), "n": len(v)} for k, v in ranks.items()],
                    key=lambda x: x["averageRank"],
                )
        elif q.type == "ALLOCATION":
            vals: dict[str, list[float]] = {}
            for r in payload.responses:
                raw = r.answers.get(q.id)
                if isinstance(raw, dict):
                    for k, v in raw.items():
                        try:
                            vals.setdefault(str(k), []).append(float(v))
                        except (TypeError, ValueError):
                            pass
            if vals:
                allocation_results[q.id] = {k: round(float(np.mean(v)), 1) for k, v in vals.items()}
        elif q.type == "MATRIX":
            rows: dict[str, dict[str, int]] = {}
            for r in payload.responses:
                raw = r.answers.get(q.id)
                if isinstance(raw, dict):
                    for row, col in raw.items():
                        bucket = rows.setdefault(str(row), {})
                        bucket[str(col)] = bucket.get(str(col), 0) + 1
            if rows:
                matrix_distributions[q.id] = rows
    return {
        "choiceDistributions": choice_distributions,
        "rankingResults": ranking_results,
        "allocationResults": allocation_results,
        "matrixDistributions": matrix_distributions,
    }


def _cohort_scores(payload: AnalysisPayload) -> dict[str, dict[str, Any]]:
    cohort_scores: dict[str, dict[str, Any]] = {}
    segment_names = sorted({k for r in payload.responses for k in r.segments.keys()})
    for segment in segment_names:
        values = sorted({r.segments.get(segment) for r in payload.responses if r.segments.get(segment)})
        for value in values:
            subset = [r for r in payload.responses if r.segments.get(segment) == value]
            key = f"{segment}:{value}"
            if len(subset) < payload.minCohortSize:
                cohort_scores[key] = {"suppressed": True, "n": len(subset)}
                continue
            aggregate = _aggregate_scores(payload, subset)
            cohort_scores[key] = {"suppressed": False, "n": len(subset), "score": aggregate["overallScore"]}
    return cohort_scores


def _result_hash(value: dict[str, Any]) -> str:
    canonical = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)
    return sha256(canonical.encode("utf-8")).hexdigest()


@app.get("/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "proofline-analytics", "version": "0.3.0"}


@app.post("/analyze")
def analyze(payload: AnalysisPayload) -> dict[str, Any]:
    aggregate = _aggregate_scores(payload, payload.responses)
    targets = _target_metrics(payload, aggregate)

    dual_gaps: list[dict[str, Any]] = []
    for question in payload.questions:
        if question.type != "DUAL":
            continue
        for response in payload.responses:
            raw = response.answers.get(question.id)
            if isinstance(raw, dict):
                try:
                    gap = float(raw.get("performance")) - float(raw.get("importance"))
                    dual_gaps.append({"questionId": question.id, "dimension": question.dimension, "gap": gap})
                except (TypeError, ValueError):
                    pass

    dimension_scores = aggregate["dimensionScores"]
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
        highlights.append(
            f"Brecha media importancia/desempeño: {avg_gap} puntos en la escala original."
            if payload.locale == "es"
            else f"Average importance/performance gap: {avg_gap} points on the original scale."
        )
    if not payload.responses:
        highlights.append("Todavía no hay respuestas completas." if payload.locale == "es" else "No completed responses are available yet.")

    distributions = _structured_distributions(payload)
    sample_metadata = {
        "completedResponses": len(payload.responses),
        "overallN": aggregate["overallN"],
        "questions": aggregate["questionSamples"],
        "dimensions": aggregate["dimensionSamples"],
    }

    result_core: dict[str, Any] = {
        "engine": {"name": "proofline-deterministic", "version": "0.3.0", "contract": "assessment-engine-v1", "aiUsed": False},
        "assessmentId": payload.assessmentId,
        "assessmentVersionId": payload.assessmentVersionId,
        "assessmentVersion": payload.assessmentVersion,
        "assessmentLevel": payload.assessmentLevel,
        "objective": payload.objective,
        "sourceHash": payload.sourceHash,
        "completedResponses": len(payload.responses),
        "overallScore": aggregate["overallScore"],
        "dimensionScores": dimension_scores,
        "questionScores": aggregate["questionScores"],
        **targets,
        "sampleMetadata": sample_metadata,
        "dualGaps": dual_gaps,
        "qualitativeThemes": qualitative_themes(payload),
        **distributions,
        "cohorts": _cohort_scores(payload),
        "highlights": highlights,
        "evidencePolicy": "Sólo observación; el motor local no genera afirmaciones causales." if payload.locale == "es" else "Observation only; no causal claim is generated by this local engine.",
    }
    calculation_hash = _result_hash(result_core)
    return {
        **result_core,
        "calculationHash": calculation_hash,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
