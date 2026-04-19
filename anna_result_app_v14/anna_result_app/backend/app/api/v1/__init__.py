"""API v1 Router"""
from fastapi import APIRouter
from app.api.v1 import upload, analyze, students, arrears, yearwise, export, classresult

router = APIRouter()
router.include_router(upload.router,      prefix="/upload",      tags=["Upload"])
router.include_router(analyze.router,     prefix="/analyze",     tags=["Analyze"])
router.include_router(students.router,    prefix="/students",    tags=["Students"])
router.include_router(arrears.router,     prefix="/arrears",     tags=["Arrears"])
router.include_router(yearwise.router,    prefix="/yearwise",    tags=["Year-wise"])
router.include_router(export.router,      prefix="/export",      tags=["Export"])
router.include_router(classresult.router, prefix="/classresult", tags=["Class Result"])
