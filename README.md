# NeuroClass

AI-powered Learning Management System with Supabase backend.

## Storage Structure

```
📦 Supabase Storage Buckets
│
├── 🗂️ course-materials        (Teacher uploads — PDFs, slides, docs)
│     └── {courseId}/
│           └── teacher/
│                 └── {timestamp}_{filename}
│
├── 🎬 course-videos           (Teacher video lectures)
│     └── {courseId}/
│           └── teacher/
│                 └── {timestamp}_{filename}
│
├── 📝 student-submissions     (Student assignment uploads)
│     └── {courseId}/
│           └── students/
│                 └── {studentId}/
│                       └── {timestamp}_{filename}
│
└── 🖼️ profile-avatars         (Public profile pictures)
      └── {userId}_{timestamp}.jpg
```

## Database Tables

| Table | Purpose |
|---|---|
| `profiles` | User info (auto-created on signup via trigger) |
| `courses` | Course metadata |
| `uploaded_files` | Tracks every file in storage with `uploader_role` (INSTRUCTOR / STUDENT) |
| `student_queries` | Every text query sent by students — used for AI training |
| `enrollments` | Which students are in which courses |

## Setup

### 1. Server
```bash
cd server
cp .env.example .env   # fill in SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm install
npm start
```

### 2. Client
```bash
cd client
npm install
npm start
```

### 3. Supabase
- Run `database/schema.sql` in Supabase → SQL Editor
- Verify 4 buckets exist in Storage: `course-materials`, `course-videos`, `student-submissions`, `profile-avatars`

### 4. Google Colab (AI Training)
```
notebooks/supabase_langchain.py
```
Set these in Colab Secrets (Tools → Secrets):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `OPENAI_API_KEY`

## API Endpoints

### File Upload
```
POST /api/files/upload
Content-Type: multipart/form-data
Authorization: Bearer <jwt>

Fields:
  file         — the file
  courseId     — UUID of the course
  fileType     — document | video | submission | image
  isInstructor — true (teacher) | false (student)
  uploaderName — display name
  isPublic     — true | false
```

### List Course Files
```
GET /api/files/course/:courseId?role=INSTRUCTOR
GET /api/files/course/:courseId?role=STUDENT
```
Returns `{ raw: [...], grouped: { teacher: [...], students: [...] } }`

### Download (Signed URL)
```
GET /api/files/download/:fileId
```

### Save Student Query
```
POST /api/queries
{ queryText, courseId, context, queryType, sessionId }
```

### Export Queries for AI Training
```
GET /api/queries/export?courseId=...&limit=1000
```
