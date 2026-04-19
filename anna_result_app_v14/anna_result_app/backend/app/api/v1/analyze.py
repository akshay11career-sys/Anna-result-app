"""
Analyze API Endpoints
GET /api/v1/analyze/dashboard
GET /api/v1/analyze/grades
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.constants import Regulation
from app.schemas.schemas import DashboardSummary, GradeDistributionResponse
from app.services.analytics import get_dashboard_summary, get_grade_distribution

router = APIRouter()


@router.get("/dashboard", response_model=DashboardSummary)
async def dashboard(
    batch_id: Optional[str] = Query(None),
    regulation: Optional[Regulation] = Query(None),
    semester: Optional[int] = Query(None, ge=1, le=8),
    year_label: Optional[str] = Query(None),
    student_type: Optional[str] = Query(None, regex="^(current|past)$"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get overall dashboard summary with filters.
    Includes: pass/fail stats, arrear categories, regulation split, year split.
    """
    return await get_dashboard_summary(
        db,
        batch_id=batch_id,
        regulation=regulation,
        semester=semester,
        year_label=year_label,
        student_type=student_type,
    )


@router.get("/grades", response_model=GradeDistributionResponse)
async def grade_distribution(
    batch_id: Optional[str] = Query(None),
    regulation: Optional[Regulation] = Query(None),
    semester: Optional[int] = Query(None, ge=1, le=8),
    db: AsyncSession = Depends(get_db),
):
    """
    Get grade distribution:
    - Subject-wise (grade counts, pass/fail %)
    - Class-wise (aggregate)
    - Year-wise
    """
    return await get_grade_distribution(
        db,
        batch_id=batch_id,
        regulation=regulation,
        semester=semester,
    )
