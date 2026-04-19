"""
PDF Parser — Anna University Result PDFs
=========================================
Key design:
  • Subject codes span TWO header rows  ("BS31" + "71" → "BS3171")
  • Grades sit at fixed x-positions matching each subject column
  • Register numbers are 12-digit integers (e.g. 910025106001)
  • A semester label + subject header appear only on the FIRST page of
    each semester section.  Subsequent pages for the same semester
    have NO header — just register-number rows starting from the top.
  • Fix: carry (semester, subject_cols) forward until a new semester
    header is detected.
  • Students are returned sorted by register number (ascending).
"""

import re
import pdfplumber
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field

from app.core.constants import (
    Regulation, REGULATION_IDENTIFIERS,
    is_ignored_grade, is_fail_grade,
)

# ──────────────────────────────────────────────────────────────
# CONSTANTS
# ──────────────────────────────────────────────────────────────

GRADE_TOKENS  = {'S','O','A+','A','B+','B','C+','C','U','SA','WC','WD','RA','AB','UA','I'}
FAIL_GRADES   = {'U','SA','UA','RA','AB','I'}
IGNORE_GRADES = {'WC','WD'}

REG_PATTERN = re.compile(r'^\d{12}$')

# Words that appear in the header / footer area and must be skipped
# when extracting subject codes or student names.
SKIP_WORDS = {
    'Subject','Code','-','>','Reg.','Number','Stud.','Name',
    'Grade','Grad','e','->',':','W','WH1','Withdrawal',
    'Inadequate','Attendance','Withheld','Suspected','Malpractice',
    'want','Clarification','approval','etc.','COE',
    'ANNA','CHENNAI','OFFICE','CONTROLLER','EXAMINATIONS',
    'Provisional','Results','Nov.','Dec.','Page','Branch',
    'DATE','PUBLICATION','Inst.Code/Name','University','-',
}


# ──────────────────────────────────────────────────────────────
# DATA CLASSES
# ──────────────────────────────────────────────────────────────

@dataclass
class ParsedSubject:
    subject_code: str
    subject_name: str = ""
    grade: str = ""


@dataclass
class ParsedStudent:
    register_number: str
    name: str
    regulation: Regulation
    semester: int
    subjects: List[ParsedSubject] = field(default_factory=list)


class PDFParserError(Exception):
    pass


# ──────────────────────────────────────────────────────────────
# REGULATION DETECTOR
# ──────────────────────────────────────────────────────────────

def detect_regulation(register_number: str) -> Regulation:
    for regulation, identifiers in REGULATION_IDENTIFIERS.items():
        for identifier in identifiers:
            if identifier in register_number:
                return regulation
    return Regulation.UNKNOWN


# ──────────────────────────────────────────────────────────────
# PAGE-LEVEL HELPERS
# ──────────────────────────────────────────────────────────────

def _is_grade_token(token: str) -> bool:
    return token.upper() in GRADE_TOKENS


def _is_pass(grade: str) -> bool:
    g = grade.upper()
    return g not in FAIL_GRADES and g not in IGNORE_GRADES


def _extract_semester(words: list) -> int:
    """
    Return semester number from 'Semester No. : XX' header, or 0 if absent.
    """
    for i, w in enumerate(words):
        if w['text'] == 'No.':
            for j in range(i + 1, min(i + 5, len(words))):
                val = words[j]['text'].strip(':').strip()
                if val.isdigit():
                    return int(val)
    return 0


def _extract_subject_columns(words: list) -> List[Tuple[float, str]]:
    """
    Build [(x_center, subject_code), ...] from the two-row subject header.

    Row 1 (same line as "Subject Code ->"):  BS31  CS25  CY25 …
    Row 2 (next line):                        71    C01   C01  …
    Combined:                                BS3171 CS25C01 CY25C01 …

    Returns [] if no subject header exists on this page.
    """
    subject_top: Optional[float] = None
    for w in words:
        if w['text'] == 'Subject':
            subject_top = w['top']
            break
    if subject_top is None:
        return []

    reg_top = next((w['top'] for w in words if w['text'] == 'Reg.'), None)

    all_tops = sorted(set(round(w['top'], 1) for w in words))
    row2_top = next(
        (t for t in all_tops
         if t > subject_top + 3 and (reg_top is None or t < reg_top - 2)),
        None,
    )

    part1: Dict[int, str] = {}
    part2: Dict[int, str] = {}

    for w in words:
        if w['text'] in SKIP_WORDS:
            continue
        xc = round((w['x0'] + w['x1']) / 2)
        if xc < 160:          # skip left-margin labels
            continue
        if abs(w['top'] - subject_top) < 3:
            part1[xc] = w['text']
        elif row2_top and abs(w['top'] - row2_top) < 3:
            part2[xc] = w['text']

    result: List[Tuple[float, str]] = []
    for xc, p1 in sorted(part1.items()):
        if part2:
            cx = min(part2.keys(), key=lambda x2: abs(x2 - xc))
            code = p1 + part2[cx] if abs(cx - xc) < 15 else p1
        else:
            code = p1
        result.append((float(xc), code))

    return result


def _merge_subjects(
    existing: Dict[str, ParsedSubject],
    new_subjects: List[ParsedSubject],
) -> None:
    """
    Merge new_subjects into existing dict (subject_code → ParsedSubject).

    Rule: only ADD subjects that are not already captured.
    Do NOT overwrite an existing grade — Anna University PDFs print each
    student exactly once per semester section.  The old logic of
    "pass always wins" was silently replacing fail grades (U/SA/UA) with
    passing grades when the same subject code appeared on a second page
    (continuation page), causing the Failed column to always show 0.
    Mutates existing in place.
    """
    for ns in new_subjects:
        if ns.subject_code not in existing:
            existing[ns.subject_code] = ns
        # If subject already exists → keep the original grade, do not overwrite


# ──────────────────────────────────────────────────────────────
# MAIN PARSER
# ──────────────────────────────────────────────────────────────

class AnnaPDFParser:
    """
    Stateful, page-by-page parser.

    State carried forward across pages:
      _current_semester  — last semester number seen in a page header
      _current_cols      — last subject-column map seen in a page header

    When a page has NO semester header:
      → use _current_semester (carry-forward)
      → use _current_cols     (carry-forward)

    This correctly handles continuation pages that contain only data rows.
    """

    def __init__(self, pdf_path: str):
        self.pdf_path = Path(pdf_path)
        if not self.pdf_path.exists():
            raise PDFParserError(f"PDF not found: {pdf_path}")

        self._current_semester: int = 0
        self._current_cols: List[Tuple[float, str]] = []

    def parse(self) -> List[ParsedStudent]:
        """
        Parse entire PDF.
        Returns students sorted by register number (ascending).
        """
        students: Dict[str, ParsedStudent] = {}

        with pdfplumber.open(str(self.pdf_path)) as pdf:
            for page_num, page in enumerate(pdf.pages, 1):
                try:
                    self._parse_page(page, page_num, students)
                except Exception as exc:
                    print(f"[Parser] Warning — page {page_num}: {exc}")

        # Sort by register number ascending before returning
        return sorted(students.values(), key=lambda s: s.register_number)

    # ──────────────────────────────────────────────
    def _parse_page(
        self,
        page,
        page_num: int,
        students: Dict[str, ParsedStudent],
    ) -> None:
        words = page.extract_words(x_tolerance=3, y_tolerance=3)
        if not words:
            return

        # ── 1. Update semester state ────────────────────────────
        detected_sem = _extract_semester(words)
        if detected_sem > 0:
            self._current_semester = detected_sem

        # ── 2. Update subject column state ─────────────────────
        detected_cols = _extract_subject_columns(words)
        if detected_cols:
            self._current_cols = detected_cols

        # ── 3. Skip page if we still have no state ──────────────
        if self._current_semester == 0 or not self._current_cols:
            return

        semester     = self._current_semester
        subject_cols = self._current_cols
        min_sx       = min(x for x, _ in subject_cols)

        # ── 4. Group words by row (y position) ──────────────────
        rows: Dict[float, List[dict]] = {}
        for w in words:
            top = round(w['top'], 1)
            rows.setdefault(top, []).append(w)

        # ── 5. Parse each data row ───────────────────────────────
        for top in sorted(rows.keys()):
            row_words = sorted(rows[top], key=lambda w: w['x0'])

            # Must contain a 12-digit register number
            reg_no = next(
                (w['text'] for w in row_words if REG_PATTERN.match(w['text'])),
                None,
            )
            if not reg_no:
                continue

            # Name = words between register number and first subject column
            name_parts = [
                w['text'] for w in row_words
                if not REG_PATTERN.match(w['text'])
                and w['x0'] < min_sx - 5
                and not _is_grade_token(w['text'])
                and w['text'] not in SKIP_WORDS
            ]
            name = ' '.join(name_parts).strip()

            # Map each grade token to its subject column by x-proximity
            parsed_subjects: List[ParsedSubject] = []
            for gw in (w for w in row_words if _is_grade_token(w['text'].upper())):
                gx      = (gw['x0'] + gw['x1']) / 2
                closest = min(subject_cols, key=lambda sc: abs(sc[0] - gx))
                if abs(closest[0] - gx) < 15:           # ≤ 15 px tolerance
                    parsed_subjects.append(ParsedSubject(
                        subject_code=closest[1],
                        grade=gw['text'].upper(),
                    ))

            if not parsed_subjects:
                continue

            regulation = detect_regulation(reg_no)

            if reg_no in students:
                # Student already seen (multi-page or arrear re-appearance)
                existing = students[reg_no]
                subj_map = {s.subject_code: s for s in existing.subjects}
                _merge_subjects(subj_map, parsed_subjects)
                existing.subjects = list(subj_map.values())
                if not existing.name and name:
                    existing.name = name
            else:
                students[reg_no] = ParsedStudent(
                    register_number=reg_no,
                    name=name,
                    regulation=regulation,
                    semester=semester,
                    subjects=parsed_subjects,
                )
