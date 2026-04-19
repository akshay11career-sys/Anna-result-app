"""
Analytics Service
Computes all dashboard analytics:
- Dashboard summary
- Grade distributions (subject/class/year)
- Arrear analysis
- Year-wise breakdown
"""

from typing import List, Dict, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, distinct

from app.models.models import Student, SubjectResult, UploadBatch
from app.schemas.schemas import (
    DashboardSummary, ArrearCategoryCount,
    SubjectGradeDistribution, ClassGradeDistribution,
    YearWiseGradeDistribution, GradeDistributionResponse,
    ArrearStudentSchema, ArrearAnalyticsResponse,
    YearWiseAnalysis, YearWiseResponse, SubjectAnalysisRow,
)
from app.core.constants import (
    Regulation, FAIL_GRADES, IGNORED_GRADES,
    GRADE_ORDER_R2021, GRADE_ORDER_R2025, YEAR_LABEL_ORDER,
    CURRENT_SEMESTERS, YEAR_EXPECTED_SEMESTERS, CURRENT_EXAM_CYCLE_NAME,
)
from app.services.result_processor import compute_grade_distribution, compute_pass_fail


# ──────────────────────────────────────────────
# SUBJECT NAME LOOKUP (R2021 + R2025 + Electives)
# ──────────────────────────────────────────────
SUBJECT_DB: Dict[str, str] = {
    "IP3151":"Induction Programme","HS3152":"Professional English I","MA3151":"Matrices and Calculus",
    "PH3151":"Engineering Physics","CY3151":"Engineering Chemistry",
    "GE3151":"Problem Solving and Python Programming","GE3152":"Heritage of Tamils",
    "GE3171":"Python Programming Laboratory","BS3171":"Physics and Chemistry Laboratory",
    "GE3172":"English Laboratory","HS3252":"Professional English II",
    "MA3251":"Statistics and Numerical Methods","PH3254":"Physics for Electronics Engineering",
    "BE3254":"Electrical and Instrumentation Engineering","GE3251":"Engineering Graphics",
    "EC3251":"Circuit Analysis","GE3252":"Tamils and Technology",
    "GE3271":"Engineering Practices Laboratory","EC3271":"Circuits Analysis Laboratory",
    "GE3272":"Communication Laboratory","MA3355":"Random Processes and Linear Algebra",
    "CS3353":"C Programming and Data Structures","EC3354":"Signals and Systems",
    "EC3353":"Electronic Devices and Circuits","EC3351":"Control Systems",
    "EC3352":"Digital Systems Design","EC3361":"Electronic Devices and Circuits Laboratory",
    "CS3362":"C Programming and Data Structures Laboratory","GE3361":"Professional Development",
    "EC3452":"Electromagnetic Fields","EC3401":"Networks and Security",
    "EC3451":"Linear Integrated Circuits","EC3492":"Digital Signal Processing",
    "EC3491":"Communication Systems","GE3451":"Environmental Sciences and Sustainability",
    "EC3461":"Communication Systems Laboratory","EC3462":"Linear Integrated Circuits Laboratory",
    "EC3501":"Wireless Communication","EC3552":"VLSI and Chip Design",
    "EC3551":"Transmission Lines and RF Systems","EC3561":"VLSI Laboratory",
    "ET3491":"Embedded Systems and IoT Design","CS3491":"Artificial Intelligence and Machine Learning",
    "GE3791":"Human Values and Ethics","EC3711":"Summer Internship","EC3811":"Project Work",
    "GE3751":"Principles of Management","GE3752":"Total Quality Management",
    "GE3753":"Engineering Economics and Financial Accounting",
    "GE3754":"Human Resource Management","GE3755":"Knowledge Management",
    "GE3792":"Industrial Management",
    # R2025
    "MA25C01":"Applied Calculus","EN25C01":"English Essentials I","UC25H01":"Heritage of Tamils",
    "EE25C04":"Basic Electronics and Electrical Engineering","PH25C01":"Applied Physics I",
    "CY25C01":"Applied Chemistry I","CS25C01":"Computer Programming C","ME25C04":"Makerspace",
    "UC25A01":"Life Skills for Engineers I","UC25A02":"Physical Education I",
    "MA25C02":"Linear Algebra","UC25H02":"Tamils and Technology","EN25C02":"English Essentials II",
    "EC25C01":"Electron Devices","EC25C02":"Circuits and Network Analysis",
    "CS25C05":"Data Structures using C++","ME25C05":"Re-Engineering for Innovation",
    "UC25A03":"Life Skills for Engineers II","EC25C03":"Devices and Circuits Laboratory",
    "UC25A04":"Physical Education II",
    # Professional Electives
    "CEC363":"Wide Bandgap Devices","CEC361":"Validation and Testing Technology",
    "CEC370":"Low Power IC Design","CEC362":"VLSI Testing and Design For Testability",
    "CEC342":"Mixed Signal IC Design Testing","CEC334":"Analog IC Design",
    "CEC332":"Advanced Digital Signal Processing","CEC366":"Image Processing",
    "CEC356":"Speech Processing","CEC355":"Software Defined Radio",
    "CEC337":"DSP Architecture and Programming","CCS338":"Computer Vision",
    "CEC350":"RF Transceivers","CEC353":"Signal Integrity","CEC335":"Antenna Design",
    "CEC341":"MICs and RF System Design","CEC338":"EMI/EMC Pre Compliance Testing",
    "CEC349":"RFID System Design and Testing",
    "CBM370":"Wearable Devices","CBM352":"Human Assist Devices","CBM368":"Therapeutic Equipment",
    "CBM355":"Medical Imaging Systems","CBM342":"Brain Computer Interface and Applications",
    "CBM341":"Body Area Networks","CBM348":"Foundation Skills in Integrated Product Development",
    "CBM333":"Assistive Technology","CBM356":"Medical Informatics",
    "CEC359":"Underwater Instrumentation System",
    "CEC358":"Underwater Imaging Systems and Image Processing",
    "CEC357":"Underwater Communication","CEC344":"Ocean Observation Systems",
    "CEC360":"Underwater Navigation Systems","CEC343":"Ocean Acoustics",
    "CEC369":"IoT Processors","CEC368":"IoT Based Systems Design",
    "CEC365":"Wireless Sensor Network Design","CEC367":"Industrial IoT and Industry 4.0",
    "CEC340":"MEMS Design","CEC339":"Fundamentals of Nanoelectronics",
    "CEC347":"Radar Technologies","CEC336":"Avionics Systems",
    "CEC346":"Positioning and Navigation Systems","CEC352":"Satellite Communication",
    "CEC348":"Remote Sensing","CEC351":"Rocketry and Space Mechanics",
    "CEC345":"Optical Communication & Networks","CEC364":"Wireless Broad Band Networks",
    "CEC331":"4G/5G Communication Networks","CEC354":"Software Defined Networks",
    "CEC371":"Massive MIMO Networks","CEC333":"Advanced Wireless Communication Techniques",
    # Open Electives
    "OAS351":"Space Science","OIE351":"Introduction to Industrial Engineering",
    "OBT351":"Food, Nutrition and Health","OCE351":"Environmental and Social Impact Assessment",
    "OEE351":"Renewable Energy System","OEI351":"Introduction to Industrial Instrumentation and Control",
    "OMA351":"Graph Theory","CCS355":"Neural Networks and Deep Learning","CCW332":"Digital Marketing",
    "OIE352":"Resource Management Techniques","OMG351":"Fintech Regulation",
    "OFD351":"Holistic Nutrition","AI3021":"IT in Agricultural System",
    "OEI352":"Introduction to Control Engineering","OPY351":"Pharmaceutical Nanotechnology",
    "OAE351":"Aviation Management","CCS342":"DevOps","CCS361":"Robotic Process Automation",
    "OHS351":"English for Competitive Examinations","OMG352":"NGOs and Sustainable Development",
    "OMG353":"Democracy and Good Governance","CME365":"Renewable Energy Technologies",
    "OME354":"Applied Design Thinking","MF3003":"Reverse Engineering",
    "OPR351":"Sustainable Manufacturing","AU3791":"Electric and Hybrid Vehicles",
    "OAS352":"Space Engineering","OIM351":"Industrial Management","OIE354":"Quality Engineering",
    "OSF351":"Fire Safety Engineering","OML351":"Introduction to Non-Destructive Testing",
    "OMR351":"Mechatronics","ORA351":"Foundation of Robotics",
    "OAE352":"Fundamentals of Aeronautical Engineering","OGI351":"Remote Sensing Concepts",
    "OAI351":"Urban Agriculture","OEN351":"Drinking Water Supply and Treatment",
    "OEE352":"Electric Vehicle Technology","OEI353":"Introduction to PLC Programming",
    "OCH351":"Nano Technology","OCH352":"Functional Materials","OFD352":"Traditional Indian Foods",
    "OFD353":"Introduction to Food Processing","OPY352":"IPR for Pharma Industry",
    "OTT351":"Basics of Textile Finishing","OTT352":"Industrial Engineering for Garment Industry",
    "OTT353":"Basics of Textile Manufacture",
    "OPE351":"Introduction to Petroleum Refining and Petrochemicals",
    "CPE334":"Energy Conservation and Management","OPT351":"Basics of Plastics Processing",
    "OMA352":"Operations Research","OMA353":"Algebra and Number Theory","OMA354":"Linear Algebra",
    "OCE353":"Lean Concepts, Tools and Practices","OBT352":"Basics of Microbial Technology",
    "OBT353":"Basics of Biomolecules","OBT354":"Fundamentals of Cell and Molecular Biology",
    "OHS352":"Project Report Writing","OMA355":"Advanced Numerical Methods",
    "OMA356":"Random Processes","OMA357":"Queuing and Reliability Modelling",
    "OMG354":"Production and Operations Management for Entrepreneurs",
    "OMG355":"Multivariate Data Analysis","OME352":"Additive Manufacturing",
    "CME343":"New Product Development","OME355":"Industrial Design & Rapid Prototyping Techniques",
    "MF3010":"Micro and Precision Engineering","OMF354":"Cost Management of Engineering Projects",
    "AU3002":"Batteries and Management System","AU3008":"Sensors and Actuators",
    "OAS353":"Space Vehicles","OIM352":"Management Science","OIM353":"Production Planning and Control",
    "OIE353":"Operations Management","OSF352":"Industrial Hygiene","OSF353":"Chemical Process Safety",
    "OML352":"Electrical, Electronic and Magnetic Materials",
    "OML353":"Nanomaterials and Applications","OMR352":"Hydraulics and Pneumatics","OMR353":"Sensors",
    "ORA352":"Concepts in Mobile Robots","MV3501":"Marine Propulsion","OMV351":"Marine Merchant Vessels",
    "OMV352":"Elements of Marine Engineering","CRA332":"Drone Technologies",
    "OGI352":"Geographical Information System","OAI352":"Agriculture Entrepreneurship Development",
    "OEN352":"Biodiversity Conservation","OEE353":"Introduction to Control Systems",
    "OEI354":"Introduction to Industrial Automation Systems","OCH353":"Energy Technology",
    "OCH354":"Surface Science","OFD354":"Fundamentals of Food Engineering",
    "OFD355":"Food Safety and Quality Regulations","OPY353":"Nutraceuticals",
    "OTT354":"Basics of Dyeing and Printing","FT3201":"Fibre Science",
    "OTT355":"Garment Manufacturing Technology","OPE353":"Industrial Safety",
    "OPE354":"Unit Operations in Petro Chemical Industries",
    "OPT352":"Plastic Materials for Engineers","OPT353":"Properties and Testing of Plastics",
    "OCE354":"Basics of Integrated Water Resources Management",
    "OBT355":"Biotechnology for Waste Management","OBT356":"Lifestyle Diseases",
    "OBT357":"Biotechnology in Health Care",
}


# ──────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────

def _pct(part: int, total: int) -> float:
    return round((part / total) * 100, 2) if total > 0 else 0.0


def _build_filter(
    batch_id: Optional[str] = None,
    regulation: Optional[Regulation] = None,
    semester: Optional[int] = None,
    year_label: Optional[str] = None,
    student_type: Optional[str] = None,
):
    """Build SQLAlchemy filter conditions for Student."""
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
    return conditions


# ──────────────────────────────────────────────
# DASHBOARD SUMMARY
# ──────────────────────────────────────────────

async def get_dashboard_summary(
    db: AsyncSession,
    batch_id: Optional[str] = None,
    regulation: Optional[Regulation] = None,
    semester: Optional[int] = None,
    year_label: Optional[str] = None,
    student_type: Optional[str] = None,
) -> DashboardSummary:
    conditions = _build_filter(batch_id, regulation, semester, year_label, student_type)

    stmt = select(Student)
    if conditions:
        stmt = stmt.where(and_(*conditions))

    result = await db.execute(stmt)
    students: List[Student] = result.scalars().all()

    total = len(students)
    if total == 0:
        return DashboardSummary(
            total_students=0, current_students=0, past_arrear_students=0,
            pass_count=0, fail_count=0, pass_percentage=0.0, fail_percentage=0.0,
            total_arrears=0, average_percentage=0.0, average_cgpa=0.0,
            arrear_categories=[], regulation_split={}, year_split={}
        )

    current_count = sum(1 for s in students if s.is_current_student)
    past_count = total - current_count
    pass_count = sum(1 for s in students if s.arrear_count == 0)
    fail_count = total - pass_count
    total_arrears = sum(s.arrear_count for s in students)
    avg_pct = round(sum(s.percentage or 0 for s in students) / total, 2)
    avg_cgpa = round(sum(s.cgpa or 0 for s in students) / total, 2)

    # Arrear categories
    arrear_dist: Dict[int, int] = {}
    for s in students:
        arrear_dist[s.arrear_count] = arrear_dist.get(s.arrear_count, 0) + 1

    arrear_categories = []
    for count in sorted(arrear_dist.keys()):
        label = "All Pass" if count == 0 else f"{count} Arrear{'s' if count > 1 else ''}"
        arrear_categories.append(ArrearCategoryCount(
            arrear_count=count,
            student_count=arrear_dist[count],
            label=label,
        ))

    # Regulation split
    reg_split: Dict[str, int] = {}
    for s in students:
        key = s.regulation.value if s.regulation else "Unknown"
        reg_split[key] = reg_split.get(key, 0) + 1

    # Year split
    year_split: Dict[str, int] = {}
    for s in students:
        key = s.year_label or "Unknown"
        year_split[key] = year_split.get(key, 0) + 1

    return DashboardSummary(
        total_students=total,
        current_students=current_count,
        past_arrear_students=past_count,
        pass_count=pass_count,
        fail_count=fail_count,
        pass_percentage=_pct(pass_count, total),
        fail_percentage=_pct(fail_count, total),
        total_arrears=total_arrears,
        average_percentage=avg_pct,
        average_cgpa=avg_cgpa,
        arrear_categories=arrear_categories,
        regulation_split=reg_split,
        year_split=year_split,
    )


# ──────────────────────────────────────────────
# GRADE DISTRIBUTION
# ──────────────────────────────────────────────

async def get_grade_distribution(
    db: AsyncSession,
    batch_id: Optional[str] = None,
    regulation: Optional[Regulation] = None,
    semester: Optional[int] = None,
) -> GradeDistributionResponse:
    """
    Compute subject-wise, class-wise, and year-wise grade distributions.
    """
    # Get students matching filters
    student_conditions = _build_filter(batch_id, regulation, semester)
    student_stmt = select(Student.id, Student.regulation, Student.year_label)
    if student_conditions:
        student_stmt = student_stmt.where(and_(*student_conditions))
    student_result = await db.execute(student_stmt)
    student_rows = student_result.all()
    student_ids = [r[0] for r in student_rows]
    student_year_map = {r[0]: r[2] for r in student_rows}  # id → year_label

    if not student_ids:
        return GradeDistributionResponse(subject_wise=[], class_wise=_empty_class_dist(), year_wise=[])

    # Load all subject results for these students
    sr_stmt = select(SubjectResult).where(
        and_(
            SubjectResult.student_id.in_(student_ids),
            SubjectResult.is_ignored == False,
        )
    )
    sr_result = await db.execute(sr_stmt)
    all_results: List[SubjectResult] = sr_result.scalars().all()

    # ── Subject-wise distribution ──
    subject_map: Dict[str, List[SubjectResult]] = {}
    for r in all_results:
        subject_map.setdefault(r.subject_code, []).append(r)

    subject_wise = []
    for code, results in subject_map.items():
        dist = compute_grade_distribution(results)
        p, f = compute_pass_fail(dist)
        total = p + f
        subject_name = results[0].subject_name if results else ""
        subject_wise.append(SubjectGradeDistribution(
            subject_code=code,
            subject_name=subject_name,
            total_students=total,
            grade_counts=dist,
            pass_count=p,
            fail_count=f,
            pass_percentage=_pct(p, total),
            fail_percentage=_pct(f, total),
        ))

    # ── Class-wise distribution ──
    class_dist = compute_grade_distribution(all_results)
    cp, cf = compute_pass_fail(class_dist)
    class_total = cp + cf
    class_wise = ClassGradeDistribution(
        total_students=len(student_ids),
        grade_counts=class_dist,
        pass_count=cp,
        fail_count=cf,
        pass_percentage=_pct(cp, class_total),
        fail_percentage=_pct(cf, class_total),
    )

    # ── Year-wise distribution ──
    year_results: Dict[str, List[SubjectResult]] = {}
    year_students: Dict[str, set] = {}
    for r in all_results:
        year = student_year_map.get(r.student_id, "Unknown")
        year_results.setdefault(year, []).append(r)
        year_students.setdefault(year, set()).add(r.student_id)

    year_wise = []
    for year in YEAR_LABEL_ORDER:
        if year not in year_results:
            continue
        results = year_results[year]
        dist = compute_grade_distribution(results)
        p, f = compute_pass_fail(dist)
        total = p + f
        year_wise.append(YearWiseGradeDistribution(
            year_label=year,
            total_students=len(year_students.get(year, set())),
            grade_counts=dist,
            pass_count=p,
            fail_count=f,
            pass_percentage=_pct(p, total),
            fail_percentage=_pct(f, total),
        ))

    return GradeDistributionResponse(
        subject_wise=sorted(subject_wise, key=lambda x: x.subject_code),
        class_wise=class_wise,
        year_wise=year_wise,
    )


def _empty_class_dist() -> ClassGradeDistribution:
    return ClassGradeDistribution(
        total_students=0, grade_counts={}, pass_count=0,
        fail_count=0, pass_percentage=0.0, fail_percentage=0.0
    )


# ──────────────────────────────────────────────
# ARREAR ANALYSIS
# ──────────────────────────────────────────────

async def get_arrear_analysis(
    db: AsyncSession,
    batch_id: Optional[str] = None,
    regulation: Optional[Regulation] = None,
    semester: Optional[int] = None,
) -> ArrearAnalyticsResponse:
    conditions = _build_filter(batch_id, regulation, semester)
    conditions.append(Student.arrear_count > 0)

    stmt = select(Student)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    result = await db.execute(stmt)
    arrear_students: List[Student] = result.scalars().all()

    # Load their failed subjects
    student_ids = [s.id for s in arrear_students]
    if student_ids:
        sr_stmt = select(SubjectResult).where(
            and_(
                SubjectResult.student_id.in_(student_ids),
                SubjectResult.is_arrear == True,
            )
        )
        sr_result = await db.execute(sr_stmt)
        all_failed: List[SubjectResult] = sr_result.scalars().all()
    else:
        all_failed = []

    # Most repeated arrear subjects
    subject_fail_count: Dict[str, int] = {}
    for r in all_failed:
        subject_fail_count[r.subject_code] = subject_fail_count.get(r.subject_code, 0) + 1

    most_repeated = sorted(
        [{"subject_code": k, "fail_count": v} for k, v in subject_fail_count.items()],
        key=lambda x: x["fail_count"],
        reverse=True,
    )[:10]

    # Build failed subject map per student
    failed_map: Dict[str, List[SubjectResult]] = {}
    for r in all_failed:
        failed_map.setdefault(r.student_id, []).append(r)

    student_schemas = []
    for s in arrear_students:
        failed_subjects = failed_map.get(s.id, [])
        student_schemas.append(ArrearStudentSchema(
            register_number=s.register_number,
            name=s.name,
            regulation=s.regulation,
            semester=s.semester,
            arrear_count=s.arrear_count,
            failed_subjects=[
                {
                    "subject_code": r.subject_code,
                    "subject_name": r.subject_name,
                    "grade": r.grade,
                    "grade_point": r.grade_point,
                    "is_arrear": r.is_arrear,
                    "is_ignored": r.is_ignored,
                }
                for r in failed_subjects
            ],
            is_current_student=s.is_current_student,
        ))

    return ArrearAnalyticsResponse(
        total_arrear_students=len(arrear_students),
        total_arrear_count=sum(s.arrear_count for s in arrear_students),
        most_repeated_subjects=most_repeated,
        arrear_students=student_schemas,
    )


# ──────────────────────────────────────────────
# YEAR-WISE ANALYSIS
# ──────────────────────────────────────────────

async def get_yearwise_analysis(
    db: AsyncSession,
    batch_id: Optional[str] = None,
    regulation: Optional[Regulation] = None,
    year_label: Optional[str] = None,
) -> YearWiseResponse:
    """
    Year-wise analysis.
    Subject-wise table uses ONLY:
      - Current students (is_current_student=True)
      - Current-semester subjects (is_arrear=False, is_ignored=False)
    The overall student counts / pass% still use ALL students in the year group.
    """
    conditions = _build_filter(batch_id, regulation)
    if year_label:
        conditions.append(Student.year_label == year_label)
    stmt = select(Student)
    if conditions:
        stmt = stmt.where(and_(*conditions))
    result = await db.execute(stmt)
    students: List[Student] = result.scalars().all()

    # Group ALL students by year (for overall counts)
    year_groups: Dict[str, List[Student]] = {}
    for s in students:
        key = s.year_label or "Unknown"
        year_groups.setdefault(key, []).append(s)

    all_ids = [s.id for s in students]

    # ── Subject results for grade distribution (all non-ignored) ─────────────
    if all_ids:
        sr_stmt = select(SubjectResult).where(
            and_(
                SubjectResult.student_id.in_(all_ids),
                SubjectResult.is_ignored == False,
            )
        )
        sr_result = await db.execute(sr_stmt)
        all_sr: List[SubjectResult] = sr_result.scalars().all()
    else:
        all_sr = []

    student_year_map = {s.id: (s.year_label or "Unknown") for s in students}
    year_subject_results: Dict[str, List[SubjectResult]] = {}
    for r in all_sr:
        y = student_year_map.get(r.student_id, "Unknown")
        year_subject_results.setdefault(y, []).append(r)

    # ── Subject results for subject-wise table ───────────────────────────────
    # Strategy:
    # 1. Find the "canonical" subject codes for each year by looking at students
    #    who appear in the CORRECT semester page (e.g. Sem 7 for 4th Year Nov-Dec).
    #    These are the subjects that belong to this exam cycle.
    # 2. Then include ALL current students in that year, but only their results
    #    for the canonical subject codes.
    # This correctly includes students who appear on wrong-semester pages (due to
    # arrears) but still have current-semester subjects in their result — while
    # keeping only the right subjects in the analysis.
    exam_key = "NOV_DEC" if CURRENT_EXAM_CYCLE_NAME == "NOV_DEC" else "APR_MAY"
    YEAR_EXPECTED_SEM = {
        "1st Year": {"NOV_DEC": 1, "APR_MAY": 2},
        "2nd Year": {"NOV_DEC": 3, "APR_MAY": 4},
        "3rd Year": {"NOV_DEC": 5, "APR_MAY": 6},
        "4th Year": {"NOV_DEC": 7, "APR_MAY": 8},
    }

    # Step 1: build canonical subject code sets per year
    correct_sem_student_ids: Dict[str, set] = {}   # year → set of student ids in correct sem
    for s in students:
        if not s.is_current_student:
            continue
        expected = YEAR_EXPECTED_SEM.get(s.year_label or "", {}).get(exam_key, -1)
        if s.semester == expected:
            year = s.year_label or "Unknown"
            correct_sem_student_ids.setdefault(year, set()).add(s.id)

    canonical_subjects: Dict[str, set] = {}   # year → set of subject codes
    for r in all_sr:
        for year, sid_set in correct_sem_student_ids.items():
            if r.student_id in sid_set:
                canonical_subjects.setdefault(year, set()).add(r.subject_code)

    # Step 2: build subject results for ALL current students, filtered to canonical codes only
    all_current_ids = {s.id for s in students if s.is_current_student}
    cur_sr_by_year: Dict[str, List[SubjectResult]] = {}
    for r in all_sr:
        if r.student_id not in all_current_ids:
            continue
        y = student_year_map.get(r.student_id, "Unknown")
        if r.subject_code not in canonical_subjects.get(y, set()):
            continue   # skip subjects that don't belong to this exam cycle
        cur_sr_by_year.setdefault(y, []).append(r)

    year_analyses = []
    for year in YEAR_LABEL_ORDER:
        group = year_groups.get(year, [])
        if not group:
            continue
        total  = len(group)
        pass_c = sum(1 for s in group if s.arrear_count == 0)
        fail_c = total - pass_c
        avg_pct  = round(sum(s.percentage or 0 for s in group) / total, 2) if total else 0.0
        avg_cgpa = round(sum(s.cgpa or 0 for s in group) / total, 2) if total else 0.0
        sr_list   = year_subject_results.get(year, [])
        grade_dist = compute_grade_distribution(sr_list)

        # class_strength = ALL current students in this year (regardless of which
        # semester page they appeared on in the PDF)
        current_strength = sum(1 for s in group if s.is_current_student)
        subj_map: Dict[str, dict] = {}

        for sr in cur_sr_by_year.get(year, []):
            grade = (sr.grade or "").upper().strip()
            code  = sr.subject_code or "UNKNOWN"
            name  = (sr.subject_name or "").strip()
            # Enrich with SUBJECT_DB if name missing
            if not name:
                name = SUBJECT_DB.get(code, "")

            if code not in subj_map:
                subj_map[code] = {
                    "subject_code": code,
                    "subject_name": name,
                    "appeared": 0, "passed": 0, "failed": 0,
                }
            if name and not subj_map[code]["subject_name"]:
                subj_map[code]["subject_name"] = name

            subj_map[code]["appeared"] += 1
            if grade in {"U","SA","UA","RA","AB","I"}:
                subj_map[code]["failed"] += 1
            else:
                subj_map[code]["passed"] += 1

        subject_rows = []
        for sno, data in enumerate(
            sorted(subj_map.values(), key=lambda x: x["subject_code"]), start=1
        ):
            ap = data["appeared"]; pa = data["passed"]; fa = data["failed"]
            subject_rows.append(SubjectAnalysisRow(
                subject_code=data["subject_code"],
                subject_name=data["subject_name"],
                class_strength=current_strength,
                appeared=ap,
                passed=pa,
                failed=fa,
                pass_percentage=round((pa/ap*100) if ap>0 else 0.0, 2),
                fail_percentage=round((fa/ap*100) if ap>0 else 0.0, 2),
            ))

        year_analyses.append(YearWiseAnalysis(
            year_label=year,
            total_students=total,
            pass_count=pass_c,
            fail_count=fail_c,
            pass_percentage=_pct(pass_c, total),
            average_percentage=avg_pct,
            average_cgpa=avg_cgpa,
            grade_distribution=grade_dist,
            subject_analysis=subject_rows,
        ))

    return YearWiseResponse(years=year_analyses)
