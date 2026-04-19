"""
Anna University Constants
- Regulation identifiers
- Grade mappings (R2021 & R2025)
- Semester/Year mappings
- Current batch register number ranges
- Exam cycle classification logic
"""

from enum import Enum
from typing import Dict, Set, Tuple


# ──────────────────────────────────────────────
# REGULATION CONSTANTS
# ──────────────────────────────────────────────

class Regulation(str, Enum):
    R2021 = "R2021"
    R2025 = "R2025"
    UNKNOWN = "UNKNOWN"


REGULATION_IDENTIFIERS: Dict[Regulation, list] = {
    Regulation.R2025: ["910025", "910026", "910027"],
    Regulation.R2021: ["910021", "910022", "910023", "910024"],
}


# ──────────────────────────────────────────────
# GRADE MAPPINGS
# ──────────────────────────────────────────────

GRADE_POINTS_R2021: Dict[str, float] = {
    "O":  10.0,
    "A+":  9.0,
    "A":   8.0,
    "B+":  7.0,
    "B":   6.0,
    "C":   5.0,
    "U":   0.0,
    "SA":  0.0,
    "UA":  0.0,
    "RA":  0.0,
    "AB":  0.0,
    "I":   0.0,
    "WD":  None,   # Withheld/Detained → ignore
    "WC":  None,
}

GRADE_POINTS_R2025: Dict[str, float] = {
    "S":  10.0,
    "A+":  9.0,
    "A":   8.0,
    "B+":  7.0,
    "B":   6.5,
    "C+":  6.0,
    "C":   5.0,
    "U":   0.0,
    "SA":  0.0,
    "UA":  0.0,
    "RA":  0.0,
    "AB":  0.0,
    "I":   0.0,
    "WC":  None,   # Withheld → ignore
    "WD":  None,
}

GRADE_ORDER_R2021 = ["O", "A+", "A", "B+", "B", "C", "U", "SA", "UA"]
GRADE_ORDER_R2025 = ["S", "A+", "A", "B+", "B", "C+", "C", "U", "SA", "UA"]

# Grades that represent FAILURE (counted as arrears)
FAIL_GRADES: Set[str] = {"U", "SA", "UA", "RA", "AB", "I"}

# Grades to completely IGNORE (no academic impact, not counted as arrear)
IGNORED_GRADES: Set[str] = {"WC", "WD"}


def is_pass_grade(grade: str) -> bool:
    g = grade.upper().strip()
    return g not in FAIL_GRADES and g not in IGNORED_GRADES

def is_fail_grade(grade: str) -> bool:
    return grade.upper().strip() in FAIL_GRADES

def is_ignored_grade(grade: str) -> bool:
    return grade.upper().strip() in IGNORED_GRADES


# ──────────────────────────────────────────────
# SEMESTER / YEAR MAPPING
# ──────────────────────────────────────────────

SEMESTER_TO_YEAR: Dict[int, str] = {
    1: "1st Year",
    2: "1st Year",
    3: "2nd Year",
    4: "2nd Year",
    5: "3rd Year",
    6: "3rd Year",
    7: "4th Year",
    8: "4th Year",
}

ODD_SEMESTERS  = {1, 3, 5, 7}
EVEN_SEMESTERS = {2, 4, 6, 8}

# ──────────────────────────────────────────────
# EXAM CYCLE CONFIGURATION
# Change this ONE variable to switch between Nov-Dec and Apr-May exams.
# NOV_DEC → shows only Odd semester subjects  (Sem 1, 3, 5, 7)
# APR_MAY → shows only Even semester subjects (Sem 2, 4, 6, 8)
# ──────────────────────────────────────────────
CURRENT_EXAM_CYCLE_NAME = "NOV_DEC"   # ← Change to "APR_MAY" for Apr-May exam

# Derived: which semesters are "current" for subject-wise analysis
CURRENT_SEMESTERS = ODD_SEMESTERS if CURRENT_EXAM_CYCLE_NAME == "NOV_DEC" else EVEN_SEMESTERS

YEAR_LABEL_ORDER = ["1st Year", "2nd Year", "3rd Year", "4th Year"]


# ──────────────────────────────────────────────
# CURRENT BATCH REGISTER NUMBER RANGES
# These are the students currently enrolled in each year.
# ──────────────────────────────────────────────

# Each entry: (prefix_digits, start_suffix, end_suffix)
# Register format: 9100XXYYYYYYY  — we match on 6-digit batch ID + roll range
CURRENT_BATCH_RANGES: Dict[str, list] = {
    "1st Year": [
        ("910025106", 1, 70),
    ],
    "2nd Year": [
        ("910024106", 1,   70),
        ("910024106", 301, 320),
        ("910024106", 701, 720),
        ("910024106", 501, 520),
    ],
    "3rd Year": [
        ("910023106", 1,   70),
        ("910023106", 301, 320),
        ("910023106", 701, 720),
        ("910023106", 501, 520),
    ],
    "4th Year": [
        ("910022106", 1,   70),
        ("910022106", 301, 320),
        ("910022106", 701, 720),
        ("910022106", 501, 520),
    ],
}


def _parse_reg_prefix_and_number(register_number: str) -> Tuple[str, int]:
    """
    Split a 12-digit register number into (9-char prefix, 3-digit roll).
    e.g. '910025106001' → ('910025106', 1)
         '910024106301' → ('910024106', 301)
    """
    if len(register_number) != 12:
        return ("", 0)
    prefix = register_number[:9]
    try:
        roll = int(register_number[9:])
    except ValueError:
        roll = 0
    return (prefix, roll)


def is_current_batch_student(register_number: str) -> bool:
    """
    Returns True if the register number falls within any defined current batch range.
    """
    prefix, roll = _parse_reg_prefix_and_number(register_number)
    if not prefix:
        return False
    for year_label, ranges in CURRENT_BATCH_RANGES.items():
        for (range_prefix, start, end) in ranges:
            if prefix == range_prefix and start <= roll <= end:
                return True
    return False


def get_student_year_from_register(register_number: str) -> str:
    """
    Returns the year label if register number is in current batch, else 'Past'.
    """
    prefix, roll = _parse_reg_prefix_and_number(register_number)
    if not prefix:
        return "Past"
    for year_label, ranges in CURRENT_BATCH_RANGES.items():
        for (range_prefix, start, end) in ranges:
            if prefix == range_prefix and start <= roll <= end:
                return year_label
    return "Past"


# ──────────────────────────────────────────────
# EXAM CYCLE → CURRENT STUDENT CLASSIFICATION
#
# Nov-Dec exam → Odd semesters (1,3,5,7) are current batch
# Apr-May exam → Even semesters (2,4,6,8) are current batch
#
# A student is CURRENT if:
#   1. Their register number is in the current batch ranges AND
#   2. The semester they appear in matches their expected exam cycle
#      (e.g. a 1st year in sem 1 during Nov-Dec = current)
# Otherwise → Past Arrear
# ──────────────────────────────────────────────

class ExamCycle(str, Enum):
    NOV_DEC = "nov_dec"   # Odd semesters
    APR_MAY = "apr_may"   # Even semesters


def get_exam_cycle(semester: int) -> ExamCycle:
    """Returns the exam cycle for a given semester number."""
    if semester in ODD_SEMESTERS:
        return ExamCycle.NOV_DEC
    return ExamCycle.APR_MAY


# Expected semesters per year per exam cycle:
# Nov-Dec: 1st Year→Sem1, 2nd Year→Sem3, 3rd Year→Sem5, 4th Year→Sem7
# Apr-May: 1st Year→Sem2, 2nd Year→Sem4, 3rd Year→Sem6, 4th Year→Sem8
YEAR_EXPECTED_SEMESTERS: Dict[str, Dict[ExamCycle, int]] = {
    "1st Year": {ExamCycle.NOV_DEC: 1, ExamCycle.APR_MAY: 2},
    "2nd Year": {ExamCycle.NOV_DEC: 3, ExamCycle.APR_MAY: 4},
    "3rd Year": {ExamCycle.NOV_DEC: 5, ExamCycle.APR_MAY: 6},
    "4th Year": {ExamCycle.NOV_DEC: 7, ExamCycle.APR_MAY: 8},
}


def classify_student(register_number: str, semester: int) -> dict:
    """
    Returns a dict with:
      - is_current_student: bool
      - year_label: str  (e.g. '1st Year', 'Past Arrear')
      - student_type: str ('Current' | 'Past Arrear' | 'Outside Batch')

    Logic:
    1. If reg number is NOT in any current batch range → Past Arrear / Outside Batch
    2. If reg number IS in current batch range → Current Student (regardless of semester).
       The old semester-matching check was removed: it was incorrectly marking current
       students as Past Arrear when the PDF semester did not match the expected exam
       cycle, causing them to disappear from the subject-wise table entirely.
    """
    batch_year = get_student_year_from_register(register_number)

    if batch_year == "Past":
        return {
            "is_current_student": False,
            "year_label": "Past Arrear",
            "student_type": "Outside Batch",
        }

    return {
        "is_current_student": True,
        "year_label": batch_year,
        "student_type": "Current",
    }


# ──────────────────────────────────────────────
# PERCENTAGE CALCULATION METHODS
# ──────────────────────────────────────────────

class PercentageMethod(str, Enum):
    GRADE_POINT_TIMES_10 = "grade_point_x10"


def get_grade_points(regulation: Regulation) -> Dict[str, float]:
    if regulation == Regulation.R2025:
        return GRADE_POINTS_R2025
    return GRADE_POINTS_R2021
