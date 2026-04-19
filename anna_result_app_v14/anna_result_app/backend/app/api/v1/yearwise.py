"""Year-wise API Endpoint"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.constants import Regulation
from app.schemas.schemas import YearWiseResponse
from app.services.analytics import get_yearwise_analysis

router = APIRouter()


@router.get("/", response_model=YearWiseResponse)
async def get_yearwise(
    batch_id: Optional[str] = Query(None),
    regulation: Optional[Regulation] = Query(None),
    year_label: Optional[str] = Query(None, description="Filter: '1st Year', '2nd Year', '3rd Year', '4th Year'"),
    db: AsyncSession = Depends(get_db),
):
    """
    Year-wise breakdown: 1st / 2nd / 3rd / 4th Year
    with pass%, average percentage, grade distribution.
    Optionally filter by year_label.
    """
    return await get_yearwise_analysis(
        db,
        batch_id=batch_id,
        regulation=regulation,
        year_label=year_label,
    )
