from app.main import AnalysisPayload, Question, Response, analyze

def test_spanish_scores_and_cohort_suppression():
    payload=AnalysisPayload(
        assessmentId="a1", title="Clima", objective="Comprender clima", locale="es", minCohortSize=3,
        questions=[Question(id="q1",type="LIKERT",prompt="Confianza",dimension="Confianza",config={"min":1,"max":5})],
        responses=[
            Response(participant="p1",segments={"department":"Comercial"},answers={"q1":5}),
            Response(participant="p2",segments={"department":"Comercial"},answers={"q1":4}),
            Response(participant="p3",segments={"department":"Finanzas"},answers={"q1":3}),
        ],
    )
    result=analyze(payload)
    assert result["dimensionScores"]["Confianza"] > 0
    assert "mayor puntuación" in result["highlights"][0]
    assert result["cohorts"]["department:Comercial"]["suppressed"] is True
    assert result["cohorts"]["department:Finanzas"]["suppressed"] is True
    assert result["engine"]["aiUsed"] is False

def test_builder_question_types_produce_structured_results():
    payload=AnalysisPayload(
        assessmentId="builder",title="Builder",objective="Validate structured question results",locale="es",minCohortSize=2,
        questions=[
            Question(id="yes",type="YES_NO",prompt="¿Está claro?",dimension="Claridad",config={"allowNA":False}),
            Question(id="single",type="SINGLE",prompt="Elige",config={"options":[{"value":"a","label":"A"},{"value":"b","label":"B"}]}),
            Question(id="rank",type="RANKING",prompt="Ordena",config={"options":[{"value":"a","label":"A"},{"value":"b","label":"B"}]}),
            Question(id="alloc",type="ALLOCATION",prompt="Reparte",config={"total":100,"options":[{"value":"a","label":"A"},{"value":"b","label":"B"}]}),
            Question(id="matrix",type="MATRIX",prompt="Matriz",dimension="Experiencia",config={"rows":[{"value":"r1","label":"R1"}],"columns":[{"value":1,"label":"1"},{"value":5,"label":"5"}]}),
        ],
        responses=[
            Response(participant="p1",answers={"yes":"yes","single":"a","rank":["a","b"],"alloc":{"a":60,"b":40},"matrix":{"r1":5}}),
            Response(participant="p2",answers={"yes":"no","single":"b","rank":["b","a"],"alloc":{"a":40,"b":60},"matrix":{"r1":1}}),
        ],
    )
    result=analyze(payload)
    assert result["choiceDistributions"]["single"] == {"a":1,"b":1}
    assert len(result["rankingResults"]["rank"]) == 2
    assert result["allocationResults"]["alloc"]["a"] == 50.0
    assert result["matrixDistributions"]["matrix"]["r1"]["5"] == 1
    assert "Claridad" in result["dimensionScores"]
