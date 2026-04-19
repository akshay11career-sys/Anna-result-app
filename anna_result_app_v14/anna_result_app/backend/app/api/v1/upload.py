"""
Upload API Endpoint
POST /api/v1/upload
"""

import os
import uuid
from typing import Optional

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db, AsyncSessionLocal
from app.core.config import settings
from app.core.constants import Regulation
from app.models.models import UploadBatch
from app.schemas.schemas import BatchUploadResponse
from app.services.pdf_parser import AnnaPDFParser, PDFParserError
from app.services.result_processor import process_batch

router = APIRouter()


# ──────────────────────────────────────────────
# BACKGROUND PROCESSING TASK
# ──────────────────────────────────────────────

async def _process_pdf_background(batch_id: str, pdf_path: str):
    """
    Standalone async background task with its OWN DB session.
    The batch row is fully committed before this runs, so it's always visible.
    """
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(UploadBatch).where(UploadBatch.id == batch_id)
        )
        batch = result.scalar_one_or_none()
        if not batch:
            print(f"[Upload] ERROR: batch {batch_id} not found in DB")
            return

        try:
            batch.processing_status = "processing"
            await session.commit()

            if not os.path.exists(pdf_path):
                raise PDFParserError(f"PDF file missing on disk: {pdf_path}")

            parser = AnnaPDFParser(pdf_path)
            parsed_students = parser.parse()

            if not parsed_students:
                batch.processing_status = "error"
                batch.error_message = (
                    "No students found in PDF. "
                    "Ensure it is a valid Anna University result PDF."
                )
                await session.commit()
                return

            # Auto-detect regulation from first matched student
            if not batch.regulation or batch.regulation == Regulation.UNKNOWN:
                for ps in parsed_students:
                    if ps.regulation != Regulation.UNKNOWN:
                        batch.regulation = ps.regulation
                        break

            count = await process_batch(session, batch, parsed_students)
            batch.total_students = count
            batch.processing_status = "done"
            await session.commit()

        except PDFParserError as e:
            await session.rollback()
            async with AsyncSessionLocal() as err_session:
                res = await err_session.execute(
                    select(UploadBatch).where(UploadBatch.id == batch_id)
                )
                b = res.scalar_one_or_none()
                if b:
                    b.processing_status = "error"
                    b.error_message = str(e)
                    await err_session.commit()

        except Exception as e:
            await session.rollback()
            import traceback
            print(f"[Upload] Unexpected error batch={batch_id}: {traceback.format_exc()}")
            async with AsyncSessionLocal() as err_session:
                res = await err_session.execute(
                    select(UploadBatch).where(UploadBatch.id == batch_id)
                )
                b = res.scalar_one_or_none()
                if b:
                    b.processing_status = "error"
                    b.error_message = f"{type(e).__name__}: {str(e)}"
                    await err_session.commit()


# ──────────────────────────────────────────────
# UPLOAD ENDPOINT
# ──────────────────────────────────────────────

@router.post("/", response_model=BatchUploadResponse, status_code=202)
async def upload_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    semester: int = Form(0),   # placeholder — parser reads real semester from PDF header
    regulation: Optional[Regulation] = Form(None),
    academic_year: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload an Anna University result PDF.
    Commits batch record first, then runs processing as a background task.
    Poll GET /upload/status/{batch_id} to track progress.
    """
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum: {settings.MAX_UPLOAD_SIZE_MB} MB",
        )
    if len(content) < 100:
        raise HTTPException(status_code=400, detail="File appears to be empty or corrupt.")

    # Save PDF to disk
    batch_id = str(uuid.uuid4())
    safe_name = f"{batch_id}_{file.filename}"
    pdf_path = os.path.join(settings.UPLOAD_DIR, safe_name)
    with open(pdf_path, "wb") as f:
        f.write(content)

    # Create and COMMIT batch record before enqueuing background task.
    # Background task opens its own session — it must see this row.
    batch = UploadBatch(
        id=batch_id,
        filename=file.filename,
        semester=semester,
        regulation=regulation,
        academic_year=academic_year,
        processing_status="pending",
        total_students=0,
    )
    db.add(batch)
    await db.commit()  # full commit, NOT flush

    background_tasks.add_task(_process_pdf_background, batch_id, pdf_path)

    return BatchUploadResponse(
        batch_id=batch_id,
        filename=file.filename,
        semester=semester,
        regulation=regulation,
        total_students=0,
        processing_status="pending",
        message="PDF uploaded. Poll /upload/status/{batch_id} for progress.",
    )


# ──────────────────────────────────────────────
# STATUS & LIST
# ──────────────────────────────────────────────

@router.get("/status/{batch_id}")
async def get_batch_status(batch_id: str, db: AsyncSession = Depends(get_db)):
    """Check processing status of a batch."""
    result = await db.execute(select(UploadBatch).where(UploadBatch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")
    return {
        "batch_id":       batch.id,
        "filename":       batch.filename,
        "semester":       batch.semester,
        "regulation":     batch.regulation,
        "academic_year":  batch.academic_year,
        "total_students": batch.total_students,
        "status":         batch.processing_status,
        "error":          batch.error_message,
        "uploaded_at":    batch.uploaded_at.isoformat() if batch.uploaded_at else None,
    }


@router.get("/batches")
async def list_batches(db: AsyncSession = Depends(get_db)):
    """List all uploaded batches, newest first."""
    result = await db.execute(
        select(UploadBatch).order_by(UploadBatch.uploaded_at.desc())
    )
    batches = result.scalars().all()
    return [
        {
            "batch_id":       b.id,
            "filename":       b.filename,
            "semester":       b.semester,
            "regulation":     b.regulation,
            "academic_year":  b.academic_year,
            "total_students": b.total_students,
            "status":         b.processing_status,
            "error":          b.error_message,
            "uploaded_at":    b.uploaded_at.isoformat() if b.uploaded_at else None,
        }
        for b in batches
    ]


@router.delete("/batches/{batch_id}", status_code=204)
async def delete_batch(batch_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a batch and all its associated student records."""
    result = await db.execute(select(UploadBatch).where(UploadBatch.id == batch_id))
    batch = result.scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found.")
    await db.delete(batch)
    await db.commit()
