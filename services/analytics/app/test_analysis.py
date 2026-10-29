from app.main import AnalysisPayload, Question, Response, analyze


def test_spanish_scores_and_cohort_suppression():
    payload = AnalysisPayload(
        assessmentId="a1",
        title="Clima",
        objective="Comprender clima",
        locale="es",
        minCohortSize=3,
        sourceHash="source-a1",
        questions=[Question(id="q1", type="LIKERT", prompt="Confianza", dimension="Confianza", config={"min": 1, "max": 5})],
        responses=[
            Response(participant="p1", segments={"department": "Comercial"}, answers={"q1": 5}),
            Response(participant="p2", segments={"department": "Comercial"}, answers={"q1": 4}),
            Response(participant="p3", segments={"department": "Finanzas"}, answers={"q1": 3}),
        ],
    )
    result = analyze(payload)
    assert result["dimensionScores"]["Confianza"] > 0
    assert "mayor puntuación" in result["highlights"][0]
    assert result["cohorts"]["department:Comercial"]["suppressed"] is True
    assert result["cohorts"]["department:Finanzas"]["suppressed"] is True
    assert result["engine"]["aiUsed"] is False
    assert result["sourceHash"] == "source-a1"
    assert len(result["calculationHash"]) == 64


def test_builder_question_types_produce_structured_results():
    payload = AnalysisPayload(
        assessmentId="builder",
        title="Builder",
        objective="Validate structured question results",
        locale="es",
        minCohortSize=2,
        questions=[
            Question(id="yes", type="YES_NO", prompt="¿Está claro?", dimension="Claridad", config={"allowNA": False}),
            Question(id="single", type="SINGLE", prompt="Elige", config={"options": [{"value": "a", "label": "A"}, {"value": "b", "label": "B"}]}),
            Question(id="rank", type="RANKING", prompt="Ordena", scored=False, config={"options": [{"value": "a", "label": "A"}, {"value": "b", "label": "B"}]}),
            Question(id="alloc", type="ALLOCATION", prompt="Reparte", scored=False, config={"total": 100, "options": [{"value": "a", "label": "A"}, {"value": "b", "label": "B"}]}),
            Question(id="matrix", type="MATRIX", prompt="Matriz", dimension="Experiencia", config={"rows": [{"value": "r1", "label": "R1"}], "columns": [{"value": 1, "label": "1"}, {"value": 5, "label": "5"}]}),
        ],
        responses=[
            Response(participant="p1", answers={"yes": "yes", "single": "a", "rank": ["a", "b"], "alloc": {"a": 60, "b": 40}, "matrix": {"r1": 5}}),
            Response(participant="p2", answers={"yes": "no", "single": "b", "rank": ["b", "a"], "alloc": {"a": 40, "b": 60}, "matrix": {"r1": 1}}),
        ],
    )
    result = analyze(payload)
    assert result["choiceDistributions"]["single"] == {"a": 1, "b": 1}
    assert len(result["rankingResults"]["rank"]) == 2
    assert result["allocationResults"]["alloc"]["a"] == 50.0
    assert result["matrixDistributions"]["matrix"]["r1"]["5"] == 1
    assert "Claridad" in result["dimensionScores"]


def test_targets_gaps_na_and_sample_metadata():
    payload = AnalysisPayload(
        assessmentId="targets",
        title="Targets",
        objective="Validate target and sample contracts",
        locale="es",
        scoringConfig={"dimensionWeights": {"Confianza": 2, "Claridad": 1}},
        questions=[
            Question(
                id="likert",
                code="Q001",
                type="LIKERT",
                prompt="Confianza",
                dimension="Confianza",
                weight=2,
                config={"min": 1, "max": 5, "target": 5},
            ),
            Question(
                id="yes",
                code="Q002",
                type="YES_NO",
                prompt="Claridad",
                dimension="Claridad",
                config={"allowNA": True, "target": "yes"},
            ),
        ],
        responses=[
            Response(participant="p1", answers={"likert": 4, "yes": "yes"}),
            Response(participant="p2", answers={"likert": 3, "yes": "no"}),
            Response(participant="p3", answers={"likert": 5, "yes": "na"}),
            Response(participant="p4", answers={"likert": 4}),
        ],
    )
    result = analyze(payload)
    assert result["questionTargets"]["likert"] == 100.0
    assert result["questionTargets"]["yes"] == 100.0
    assert result["questionGaps"]["likert"] == 25.0
    assert result["questionGaps"]["yes"] == 50.0
    assert result["dimensionTargets"] == {"Confianza": 100.0, "Claridad": 100.0}
    assert result["overallTarget"] == 100.0
    assert result["overallGap"] > 0
    assert result["gapConvention"] == "target-minus-observed"
    assert result["sampleMetadata"]["questions"]["yes"] == {
        "total": 4,
        "answered": 3,
        "scored": 2,
        "na": 1,
        "missing": 1,
        "invalid": 0,
    }
    assert result["sampleMetadata"]["overallN"] == 4
    assert result["targetWarnings"] == []


def test_reproducibility_and_dimension_weights_are_deterministic():
    payload = AnalysisPayload(
        assessmentId="deterministic",
        assessmentVersionId="v1",
        assessmentVersion=1,
        assessmentLevel="L3",
        sourceHash="d" * 64,
        title="Deterministic",
        objective="Same source, same scoring result",
        locale="en",
        scoringConfig={"dimensionWeights": {"A": 3, "B": 1}},
        questions=[
            Question(id="a", type="LIKERT", prompt="A", dimension="A", config={"min": 1, "max": 5, "target": 5}),
            Question(id="b", type="LIKERT", prompt="B", dimension="B", config={"min": 1, "max": 5, "target": 5}),
        ],
        responses=[
            Response(participant="p1", answers={"a": 5, "b": 1}),
            Response(participant="p2", answers={"a": 5, "b": 1}),
        ],
    )
    first = analyze(payload)
    second = analyze(payload)
    assert first["overallScore"] == 75.0
    assert first["sourceHash"] == second["sourceHash"] == "d" * 64
    assert first["calculationHash"] == second["calculationHash"]
    assert first["dimensionScores"] == second["dimensionScores"]
    assert first["questionScores"] == second["questionScores"]
    assert first["sampleMetadata"] == second["sampleMetadata"]
