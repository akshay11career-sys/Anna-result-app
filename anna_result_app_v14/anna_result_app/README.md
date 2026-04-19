# Anna University Result Analysis System — v4

Full-stack result analysis for Anna University students (R2021 & R2025), with automatic classification of current vs past arrear students based on register number ranges and exam cycles.

---

## 🚀 Quick Start

### Backend
```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
API docs: http://localhost:8000/docs

### Frontend
```bash
cd frontend
npm install
npm run dev
```
App: http://localhost:3000

---

## 📐 Architecture

```
backend/app/
├── core/
│   ├── constants.py       ← Grade maps, batch ranges, exam cycle logic
│   ├── database.py        ← Async SQLAlchemy (SQLite/PostgreSQL)
│   └── config.py          ← Settings
├── services/
│   ├── pdf_parser.py      ← Column-based x-coordinate parser
│   ├── result_processor.py ← Grade points, %, arrear count, classification
│   ├── analytics.py       ← Dashboard, grade dist, year-wise, arrears
│   └── export_service.py  ← Excel (7 sheets) + PDF reports
├── api/v1/
│   ├── upload.py          ← POST /upload (background task, commit-first)
│   ├── analyze.py         ← GET /analyze/dashboard + /analyze/grades
│   ├── students.py        ← GET /students
│   ├── arrears.py         ← GET /arrears
│   ├── yearwise.py        ← GET /yearwise?year_label=
│   └── export.py          ← GET /export/excel + /export/pdf
└── models/models.py       ← UploadBatch, Student, SubjectResult

frontend/src/
├── pages/
│   ├── Dashboard.jsx       ← Stats, charts (no CGPA, no filters)
│   ├── UploadPage.jsx      ← Drag-drop only (no dropdowns)
│   ├── StudentAnalysis.jsx ← Search + table (no filter cards, no CGPA col)
│   ├── ArrearAnalysis.jsx  ← Charts + expandable list (no filter cards)
│   └── YearwiseAnalysis.jsx ← Year buttons (1st/2nd/3rd/4th Year)
└── components/
    ├── Layout.jsx          ← Sidebar navigation
    └── ui.jsx              ← StatCard, GradeTag, ProgressBar, etc.
```

---

## 🎯 Current Batch Register Ranges

| Year | Register Number Ranges |
|------|----------------------|
| 1st Year | 910025106001–055 |
| 2nd Year | 910024106001–055, 910024106301–305, 910024106701–704 |
| 3rd Year | 910023106001–055, 910023106301–305, 910023106701–703 |
| 4th Year | 910022106001–052, 910022106302–303, 910022106701–703 |

---

## 📅 Exam Cycle → Current Student Logic

| Exam | Semesters | Current if reg matches batch range AND |
|------|-----------|---------------------------------------|
| Nov–Dec | Odd (1,3,5,7) | In expected year's odd semester |
| Apr–May | Even (2,4,6,8) | In expected year's even semester |

Any register number in batch range appearing in the **wrong semester** = **Past Arrear**.  
Any register number **outside all batch ranges** = **Past Arrear / Outside Batch**.

---

## ⚙️ Grade Mappings

| Grade | R2021 | R2025 |
|-------|-------|-------|
| S / O | O=10  | S=10  |
| A+    | 9     | 9     |
| A     | 8     | 8     |
| B+    | 7     | 7     |
| B     | 6     | 6.5   |
| C+    | —     | 6     |
| C     | 5     | 5     |
| U/SA/UA/RA/AB/I | 0 | 0 |
| WC/WD | Ignored | Ignored |

**Percentage** = Average Grade Point × 10  
**Arrear** = U, SA, UA, RA, AB, or I grade  
**Ignored** = WC or WD (not counted in percentage or arrears)

---

## 🔧 Key Bugs Fixed

1. **Background task race condition** — `db.commit()` before enqueuing task (was `flush`)
2. **UA / I not counted as fail** — added to `FAIL_GRADES` set
3. **Semester hardcoded** — each student now uses semester read from their PDF page
4. **"Final Year" → "4th Year"** — consistent label throughout
5. **PDF column parser** — x-coordinate matching for Anna University's split-header format

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/upload/` | Upload result PDF |
| GET | `/api/v1/upload/status/{id}` | Poll processing status |
| GET | `/api/v1/upload/batches` | List all batches |
| GET | `/api/v1/analyze/dashboard` | Overall summary |
| GET | `/api/v1/analyze/grades` | Grade distribution |
| GET | `/api/v1/students/` | Student list (search, paginate) |
| GET | `/api/v1/students/{reg_no}` | Single student detail |
| GET | `/api/v1/arrears/` | Arrear analysis |
| GET | `/api/v1/yearwise/?year_label=` | Year-wise breakdown |
| GET | `/api/v1/export/excel` | Download Excel report |
| GET | `/api/v1/export/pdf` | Download PDF report |

---

## 🗄️ Database (SQLite default / PostgreSQL optional)

```
upload_batches  — id, filename, semester, regulation, processing_status, total_students
students        — id, batch_id, register_number, name, regulation, semester,
                  year_label, is_current_student, total_subjects, arrear_count, percentage, cgpa
subject_results — id, student_id, batch_id, subject_code, subject_name, grade,
                  grade_point, is_arrear, is_ignored
```

Switch to PostgreSQL in `.env`:
```
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/anna_results
```
