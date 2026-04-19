"""
SQLAlchemy ORM Models
"""

from sqlalchemy import (
    Column, String, Integer, Float, Boolean,
    ForeignKey, DateTime, Text, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base
from app.core.constants import Regulation
import uuid


def gen_uuid():
    return str(uuid.uuid4())


class UploadBatch(Base):
    """Tracks each uploaded PDF batch."""
    __tablename__ = "upload_batches"

    id = Column(String, primary_key=True, default=gen_uuid)
    filename = Column(String, nullable=False)
    semester = Column(Integer, nullable=False)
    regulation = Column(SAEnum(Regulation), nullable=True)
    academic_year = Column(String, nullable=True)   # e.g. "2024-25"
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())
    total_students = Column(Integer, default=0)
    processing_status = Column(String, default="pending")  # pending/done/error
    error_message = Column(Text, nullable=True)

    students = relationship("Student", back_populates="batch", cascade="all, delete-orphan")


class Student(Base):
    """Stores each student's metadata."""
    __tablename__ = "students"

    id = Column(String, primary_key=True, default=gen_uuid)
    batch_id = Column(String, ForeignKey("upload_batches.id"), nullable=False)
    register_number = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    regulation = Column(SAEnum(Regulation), nullable=False)
    semester = Column(Integer, nullable=False)
    year_label = Column(String, nullable=True)           # "1st Year", etc.
    is_current_student = Column(Boolean, default=True)   # False = past arrear student
    total_subjects = Column(Integer, default=0)
    arrear_count = Column(Integer, default=0)
    percentage = Column(Float, nullable=True)
    cgpa = Column(Float, nullable=True)

    batch = relationship("UploadBatch", back_populates="students")
    subject_results = relationship("SubjectResult", back_populates="student", cascade="all, delete-orphan")


class SubjectResult(Base):
    """
    One row per student × subject.
    If a subject is re-attempted, multiple rows exist; the latest pass is used.
    """
    __tablename__ = "subject_results"

    id = Column(String, primary_key=True, default=gen_uuid)
    student_id = Column(String, ForeignKey("students.id"), nullable=False)
    batch_id = Column(String, ForeignKey("upload_batches.id"), nullable=False)
    subject_code = Column(String, nullable=False, index=True)
    subject_name = Column(String, nullable=True)
    grade = Column(String, nullable=False)
    grade_point = Column(Float, nullable=True)
    is_arrear = Column(Boolean, default=False)
    is_ignored = Column(Boolean, default=False)    # WC / WD subjects
    attempt_number = Column(Integer, default=1)   # for re-attempts

    student = relationship("Student", back_populates="subject_results")
