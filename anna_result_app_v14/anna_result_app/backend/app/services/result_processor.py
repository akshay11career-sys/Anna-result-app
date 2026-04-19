"""
Result Processor Service
Converts parsed PDF data into DB records and computes:
- Regulation-specific grade points
- Percentage (Grade Point × 10 method)
- Arrear detection
- Student classification (Current / Past Arrear) via register number + semester
"""

from typing import List, Dict, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.models import UploadBatch, Student, SubjectResult
from app.services.pdf_parser import ParsedStudent, ParsedSubject
from app.core.constants import (
    Regulation, SEMESTER_TO_YEAR, PercentageMethod,
    get_grade_points, is_fail_grade, is_ignored_grade,
    FAIL_GRADES, IGNORED_GRADES,
    classify_student,
)


# ──────────────────────────────────────────────
# GRADE POINT RESOLVER
# ──────────────────────────────────────────────

def resolve_grade_point(grade: str, regulation: Regulation) -> Optional[float]:
    grade_map = get_grade_points(regulation)
    return grade_map.get(grade.upper().strip())


# ──────────────────────────────────────────────
# PERCENTAGE CALCULATOR
# ──────────────────────────────────────────────

def calculate_percentage(
    subjects: List[ParsedSubject],
    regulation: Regulation,
    method: PercentageMethod = PercentageMethod.GRADE_POINT_TIMES_10,
) -> Tuple[float, float]:
    """
    Returns (percentage, cgpa).
    Percentage = avg(grade_points) × 10
    Skips WC/WD (ignored grades) and grades with None point values.
    Fail grades (U, SA, UA...) contribute 0 to average.
    """
    grade_map = get_grade_points(regulation)
    valid_points = []

    for subj in subjects:
        grade = subj.grade.upper().strip()
        if grade in IGNORED_GRADES:
            continue
        gp = grade_map.get(grade)
        if gp is None:
            continue
        valid_points.append(gp)

    if not valid_points:
        return 0.0, 0.0

    cgpa = sum(valid_points) / len(valid_points)
    percentage = round(cgpa * 10.0, 2)
    return percentage, round(cgpa, 2)


# ──────────────────────────────────────────────
# ARREAR COUNTER
# ──────────────────────────────────────────────

_FAIL_SET = {"U", "SA", "UA", "RA", "AB", "I"}

def count_arrears(subjects: List[ParsedSubject]) -> int:
    """Count subjects with arrear grade. Ignores WC/WD."""
    return sum(1 for s in subjects if s.grade.upper().strip() in _FAIL_SET)


# ──────────────────────────────────────────────
# BATCH PROCESSOR
# ──────────────────────────────────────────────

async def process_batch(
    db: AsyncSession,
    batch: UploadBatch,
    parsed_students: List[ParsedStudent],
    percentage_method: PercentageMethod = PercentageMethod.GRADE_POINT_TIMES_10,
) -> int:
    """
    Persist all parsed students and subject results to DB.
    Returns number of students saved.
    """
    saved_count = 0

    for ps in parsed_students:
        regulation = ps.regulation
        if regulation == Regulation.UNKNOWN:
            regulation = batch.regulation or Regulation.R2021

        # Semester: use value parsed from PDF page header, fall back to batch
        student_semester = ps.semester if ps.semester > 0 else batch.semester

        # ── classify current vs past arrear ──────────
        classification = classify_student(ps.register_number, student_semester)
        is_current      = classification["is_current_student"]
        year_label      = classification["year_label"]

        # ── compute analytics ─────────────────────────
        percentage, cgpa = calculate_percentage(ps.subjects, regulation, percentage_method)
        arrear_count = count_arrears(ps.subjects)
        valid_subject_count = sum(
            1 for s in ps.subjects if s.grade.upper().strip() not in IGNORED_GRADES
        )

        student = Student(
            batch_id=batch.id,
            register_number=ps.register_number,
            name=ps.name,
            regulation=regulation,
            semester=student_semester,
            year_label=year_label,
            is_current_student=is_current,
            total_subjects=valid_subject_count,
            arrear_count=arrear_count,
            percentage=percentage,
            cgpa=cgpa,
        )
        db.add(student)
        await db.flush()  # get student.id before inserting subject results

        for subj in ps.subjects:
            grade = subj.grade.upper().strip()
            ignored = grade in IGNORED_GRADES
            arrear  = grade in _FAIL_SET and not ignored
            gp = resolve_grade_point(grade, regulation)

            db.add(SubjectResult(
                student_id=student.id,
                batch_id=batch.id,
                subject_code=subj.subject_code,
                subject_name=subj.subject_name or "",
                grade=grade,
                grade_point=gp,
                is_arrear=arrear,
                is_ignored=ignored,
            ))

        saved_count += 1

    await db.flush()
    return saved_count


# ──────────────────────────────────────────────
# GRADE DISTRIBUTION HELPERS
# ──────────────────────────────────────────────

def compute_grade_distribution(subject_results) -> Dict[str, int]:
    """Build grade→count dict, skipping ignored grades."""
    dist: Dict[str, int] = {}
    for r in subject_results:
        if r.is_ignored:
            continue
        g = r.grade.upper().strip()
        dist[g] = dist.get(g, 0) + 1
    return dist


def compute_pass_fail(dist: Dict[str, int]) -> Tuple[int, int]:
    """Returns (pass_count, fail_count) from a grade distribution dict."""
    fail = sum(v for k, v in dist.items() if k in FAIL_GRADES)
    pass_ = sum(v for k, v in dist.items() if k not in FAIL_GRADES)
    return pass_, fail
