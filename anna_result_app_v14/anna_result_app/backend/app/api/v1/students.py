"""Students API Endpoint"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.core.database import get_db
from app.core.constants import Regulation
from app.models.models import Student, SubjectResult
from app.schemas.schemas import StudentSchema, StudentListItem

router = APIRouter()


@router.get("/", response_model=List[StudentListItem])
async def list_students(
    batch_id: Optional[str] = Query(None),
    regulation: Optional[Regulation] = Query(None),
    semester: Optional[int] = Query(None, ge=1, le=8),
    year_label: Optional[str] = Query(None),
    student_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search by register number or name"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    """List students with optional filters and search."""
    conditions = []
    if batch_id:
        conditions.append(Student.batch_id == batch_id)
    if regulation:
        conditions.append(Student.regulation == regulation)
    if semester:
        conditions.append(Student.semester == semester)
    if year_label:
        conditions.append(Student.year_label == year_label)
    if student_type == "current":
        conditions.append(Student.is_current_student == True)
    elif student_type == "past":
        conditions.append(Student.is_current_student == False)
    if search:
        from sqlalchemy import or_
        conditions.append(or_(
            Student.register_number.ilike(f"%{search}%"),
            Student.name.ilike(f"%{search}%"),
        ))

    stmt = select(Student)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    stmt = stmt.offset(skip).limit(limit)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{register_number}", response_model=StudentSchema)
async def get_student(register_number: str, db: AsyncSession = Depends(get_db)):
    """Get full student details including subject results."""
    stmt = select(Student).where(Student.register_number == register_number)
    result = await db.execute(stmt)
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    # Load subject results
    sr_stmt = select(SubjectResult).where(SubjectResult.student_id == student.id)
    sr_result = await db.execute(sr_stmt)
    student.subject_results = sr_result.scalars().all()

    return student
