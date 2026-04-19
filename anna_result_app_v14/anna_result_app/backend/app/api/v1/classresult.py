"""
Class Result Analysis API Endpoint
GET /api/v1/classresult/

Returns subject-wise pass/fail analysis for current students,
filtered to ODD semesters only (Nov-Dec examination: Sem 1, 3, 5, 7).
To switch to Apr-May (Even semesters), change CURRENT_EXAM_CYCLE_NAME
in app/core/constants.py from "NOV_DEC" to "APR_MAY".
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.constants import Regulation, YEAR_EXPECTED_SEMESTERS, CURRENT_SEMESTERS, CURRENT_EXAM_CYCLE_NAME
from app.services.analytics import get_yearwise_analysis

router = APIRouter()

# Map year label → expected semester for the current exam cycle
YEAR_SEMESTER_MAP = {
    year: sems["NOV_DEC"] if CURRENT_EXAM_CYCLE_NAME == "NOV_DEC" else sems["APR_MAY"]
    for year, sems in {
        "1st Year": {"NOV_DEC": 1, "APR_MAY": 2},
        "2nd Year": {"NOV_DEC": 3, "APR_MAY": 4},
        "3rd Year": {"NOV_DEC": 5, "APR_MAY": 6},
        "4th Year": {"NOV_DEC": 7, "APR_MAY": 8},
    }.items()
}


@router.get("/")
async def get_class_result(
    batch_id:   Optional[str]        = Query(None),
    regulation: Optional[Regulation] = Query(None),
    year_label: Optional[str]        = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Class Result Analysis: subject-wise pass/fail per year block.

    Only includes:
      - Current students (register number in current batch ranges)
      - Subjects from the current exam cycle semesters:
          Nov-Dec → Sem 1, 3, 5, 7 (Odd)
          Apr-May → Sem 2, 4, 6, 8 (Even)

    Response shape (matches ClassResultAnalysis.jsx):
      { year_blocks: [ { year_label, semester, class_strength,
                          total_passed, total_failed,
                          overall_pass_percentage, subjects: [...] } ] }
    """
    yearwise = await get_yearwise_analysis(
        db,
        batch_id=batch_id,
        regulation=regulation,
        year_label=year_label,
    )

    year_blocks = []
    for yr in yearwise.years:
        subjects_raw = yr.subject_analysis or []

        # Build per-subject list (subjects already filtered to current semesters
        # by get_yearwise_analysis, which now uses CURRENT_SEMESTERS)
        subjects = []
        for s in subjects_raw:
            subjects.append({
                "subject_code":    s.subject_code,
                "subject_name":    s.subject_name,
                "class_strength":  s.class_strength,
                "appeared":        s.appeared,
                "passed":          s.passed,
                "failed":          s.failed,
                "pass_percentage": s.pass_percentage,
                "fail_percentage": s.fail_percentage,
            })

        # Overall pass/fail: count of current students in this year with 0 arrears
        total_passed = yr.pass_count
        total_failed = yr.fail_count
        class_strength = yr.total_students

        year_blocks.append({
            "year_label":              yr.year_label,
            "semester":                YEAR_SEMESTER_MAP.get(yr.year_label, 0),
            "exam_cycle":              CURRENT_EXAM_CYCLE_NAME,
            "class_strength":          class_strength,
            "total_passed":            total_passed,
            "total_failed":            total_failed,
            "overall_pass_percentage": yr.pass_percentage,
            "subjects":                subjects,
        })

    return {"year_blocks": year_blocks}
