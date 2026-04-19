"""Arrears API Endpoint"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.constants import Regulation
from app.schemas.schemas import ArrearAnalyticsResponse
from app.services.analytics import get_arrear_analysis

router = APIRouter()


@router.get("/", response_model=ArrearAnalyticsResponse)
async def get_arrears(
    batch_id: Optional[str] = Query(None),
    regulation: Optional[Regulation] = Query(None),
    semester: Optional[int] = Query(None, ge=1, le=8),
    db: AsyncSession = Depends(get_db),
):
    """
    Get full arrear analysis:
    - Students with arrears
    - Most repeated failed subjects
    - Arrear trends
    """
    return await get_arrear_analysis(db, batch_id=batch_id, regulation=regulation, semester=semester)
