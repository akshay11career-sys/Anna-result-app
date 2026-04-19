"""
Pydantic Schemas — Request & Response models
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Optional, Any
from datetime import datetime
from app.core.constants import Regulation, PercentageMethod


# ──────────────────────────────────────────────
# UPLOAD / BATCH
# ──────────────────────────────────────────────

class BatchUploadResponse(BaseModel):
    batch_id: str
    filename: str
    semester: int
    regulation: Optional[Regulation]
    total_students: int
    processing_status: str
    message: str


# ──────────────────────────────────────────────
# SUBJECT RESULT
# ──────────────────────────────────────────────

class SubjectResultSchema(BaseModel):
    subject_code: str
    subject_name: Optional[str]
    grade: str
    grade_point: Optional[float]
    is_arrear: bool
    is_ignored: bool

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# STUDENT
# ──────────────────────────────────────────────

class StudentBase(BaseModel):
    register_number: str
    name: str
    regulation: Regulation
    semester: int
    year_label: Optional[str]
    is_current_student: bool
    total_subjects: int
    arrear_count: int
    percentage: Optional[float]
    cgpa: Optional[float]


class StudentSchema(StudentBase):
    id: str
    batch_id: str
    subject_results: List[SubjectResultSchema] = []

    class Config:
        from_attributes = True


class StudentListItem(StudentBase):
    id: str

    class Config:
        from_attributes = True


# ──────────────────────────────────────────────
# GRADE DISTRIBUTION
# ──────────────────────────────────────────────

class SubjectGradeDistribution(BaseModel):
    subject_code: str
    subject_name: Optional[str]
    total_students: int
    grade_counts: Dict[str, int]
    pass_count: int
    fail_count: int
    pass_percentage: float
    fail_percentage: float


class ClassGradeDistribution(BaseModel):
    total_students: int
    grade_counts: Dict[str, int]
    pass_count: int
    fail_count: int
    pass_percentage: float
    fail_percentage: float


class YearWiseGradeDistribution(BaseModel):
    year_label: str
    total_students: int
    grade_counts: Dict[str, int]
    pass_count: int
    fail_count: int
    pass_percentage: float
    fail_percentage: float


class GradeDistributionResponse(BaseModel):
    subject_wise: List[SubjectGradeDistribution]
    class_wise: ClassGradeDistribution
    year_wise: List[YearWiseGradeDistribution]


# ──────────────────────────────────────────────
# ANALYTICS / DASHBOARD
# ──────────────────────────────────────────────

class ArrearCategoryCount(BaseModel):
    arrear_count: int
    student_count: int
    label: str  # "All Pass", "1 Arrear", etc.


class DashboardSummary(BaseModel):
    total_students: int
    current_students: int
    past_arrear_students: int
    pass_count: int
    fail_count: int
    pass_percentage: float
    fail_percentage: float
    total_arrears: int
    average_percentage: float
    average_cgpa: float
    arrear_categories: List[ArrearCategoryCount]
    regulation_split: Dict[str, int]
    year_split: Dict[str, int]


# ──────────────────────────────────────────────
# ARREAR ANALYSIS
# ──────────────────────────────────────────────

class ArrearStudentSchema(BaseModel):
    register_number: str
    name: str
    regulation: Regulation
    semester: int
    arrear_count: int
    failed_subjects: List[SubjectResultSchema]
    is_current_student: bool

    class Config:
        from_attributes = True


class ArrearAnalyticsResponse(BaseModel):
    total_arrear_students: int
    total_arrear_count: int
    most_repeated_subjects: List[Dict[str, Any]]   # [{subject_code, fail_count}]
    arrear_students: List[ArrearStudentSchema]


# ──────────────────────────────────────────────
# YEAR-WISE ANALYSIS
# ──────────────────────────────────────────────

class SubjectAnalysisRow(BaseModel):
    subject_code:    str
    subject_name:    str
    class_strength:  int   # total current students in that year
    appeared:        int   # students with a non-WC/WD grade for this subject
    passed:          int
    failed:          int
    pass_percentage: float
    fail_percentage: float


class YearWiseAnalysis(BaseModel):
    year_label: str
    total_students: int
    pass_count: int
    fail_count: int
    pass_percentage: float
    average_percentage: float
    average_cgpa: float
    grade_distribution: Dict[str, int]
    subject_analysis: List["SubjectAnalysisRow"] = []   # current-sem subjects only


class YearWiseResponse(BaseModel):
    years: List[YearWiseAnalysis]


# ──────────────────────────────────────────────
# QUERY PARAMS SCHEMA
# ──────────────────────────────────────────────

class AnalysisFilter(BaseModel):
    batch_id: Optional[str] = None
    regulation: Optional[Regulation] = None
    semester: Optional[int] = None
    year_label: Optional[str] = None
    student_type: Optional[str] = None  # "current" | "past"
    percentage_method: PercentageMethod = PercentageMethod.GRADE_POINT_TIMES_10
