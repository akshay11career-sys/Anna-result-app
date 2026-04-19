"""Export API Endpoint"""
import os
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.core.constants import Regulation, CURRENT_EXAM_CYCLE_NAME, YEAR_EXPECTED_SEMESTERS
from app.models.models import Student
from app.services.analytics import (
    get_dashboard_summary, get_grade_distribution,
    get_arrear_analysis, get_yearwise_analysis,
)
from app.services.export_service import export_excel_with_class_result, export_pdf_report

router = APIRouter()

# Expected semester per year for current exam cycle
_EXAM_KEY = "NOV_DEC" if CURRENT_EXAM_CYCLE_NAME == "NOV_DEC" else "APR_MAY"
_YEAR_SEM = {
    "1st Year": {"NOV_DEC": 1, "APR_MAY": 2},
    "2nd Year": {"NOV_DEC": 3, "APR_MAY": 4},
    "3rd Year": {"NOV_DEC": 5, "APR_MAY": 6},
    "4th Year": {"NOV_DEC": 7, "APR_MAY": 8},
}


async def _gather_export_data(db, batch_id, regulation, semester):
    summary       = await get_dashboard_summary(db, batch_id=batch_id, regulation=regulation, semester=semester)
    grade_dist    = await get_grade_distribution(db, batch_id=batch_id, regulation=regulation, semester=semester)
    arrear_data   = await get_arrear_analysis(db, batch_id=batch_id, regulation=regulation, semester=semester)
    yearwise_data = await get_yearwise_analysis(db, batch_id=batch_id, regulation=regulation)

    conditions = []
    if batch_id:   conditions.append(Student.batch_id   == batch_id)
    if regulation: conditions.append(Student.regulation == regulation)
    if semester:   conditions.append(Student.semester   == semester)

    stmt = select(Student)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    result = await db.execute(stmt)
    students = result.scalars().all()
    student_dicts = [
        {
            "register_number": s.register_number,
            "name":            s.name,
            "regulation":      s.regulation.value if s.regulation else "",
            "semester":        s.semester,
            "year_label":      s.year_label,
            "total_subjects":  s.total_subjects,
            "arrear_count":    s.arrear_count,
            "percentage":      s.percentage,
            "cgpa":            s.cgpa,
            "is_current_student": s.is_current_student,
        }
        for s in students
    ]

    # Build class_result_data (subject-wise per year, odd semesters only)
    class_result_data = {"year_blocks": []}
    for yr in yearwise_data.years:
        subjects = []
        for s in (yr.subject_analysis or []):
            subjects.append({
                "subject_code":    s.subject_code,
                "subject_name":    s.subject_name or s.subject_code,
                "class_strength":  s.class_strength,
                "appeared":        s.appeared,
                "passed":          s.passed,
                "failed":          s.failed,
                "pass_percentage": s.pass_percentage,
                "fail_percentage": s.fail_percentage,
            })
        class_result_data["year_blocks"].append({
            "year_label":              yr.year_label,
            "semester":                _YEAR_SEM.get(yr.year_label, {}).get(_EXAM_KEY, 0),
            "exam_cycle":              CURRENT_EXAM_CYCLE_NAME,
            "class_strength":          yr.total_students,
            "total_passed":            yr.pass_count,
            "total_failed":            yr.fail_count,
            "overall_pass_percentage": yr.pass_percentage,
            "subjects":                subjects,
        })

    return (student_dicts, summary.dict(), grade_dist.dict(),
            arrear_data.dict(), yearwise_data.dict(), class_result_data)


@router.get("/excel")
async def export_to_excel(
    batch_id:   Optional[str]        = Query(None),
    regulation: Optional[Regulation] = Query(None),
    semester:   Optional[int]        = Query(None, ge=1, le=8),
    db: AsyncSession = Depends(get_db),
):
    students, summary, grade_dist, arrear_data, yearwise_data, class_result_data = \
        await _gather_export_data(db, batch_id, regulation, semester)
    path = export_excel_with_class_result(
        students, summary, grade_dist, arrear_data, yearwise_data, class_result_data
    )
    if not os.path.exists(path):
        raise HTTPException(status_code=500, detail="Failed to generate Excel.")
    return FileResponse(path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=os.path.basename(path))


@router.get("/pdf")
async def export_to_pdf(
    batch_id:   Optional[str]        = Query(None),
    regulation: Optional[Regulation] = Query(None),
    semester:   Optional[int]        = Query(None, ge=1, le=8),
    db: AsyncSession = Depends(get_db),
):
    students, summary, grade_dist, *_ = await _gather_export_data(db, batch_id, regulation, semester)
    path = export_pdf_report(students, summary, grade_dist)
    if not os.path.exists(path):
        raise HTTPException(status_code=500, detail="Failed to generate PDF.")
    return FileResponse(path, media_type="application/pdf", filename=os.path.basename(path))
