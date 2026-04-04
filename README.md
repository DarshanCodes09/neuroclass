# NeuroClass 🎓

An AI-powered classroom platform where **Instructors** create courses and **Students** learn with the help of an AI Tutor and auto-graded assignments.

---

## 📁 Project Structure

```
neuroclass/
├── README.md                  ← You are here
├── package.json               ← Root scripts to run the whole project
│
├── client/                    ← React Frontend (runs on localhost:5173)
│   ├── .env                   ← Your secret keys (never commit this!)
│   ├── .env.example           ← Copy this to create your .env
│   ├── index.html             ← HTML entry point
│   ├── vite.config.js         ← Vite bundler config
│   ├── package.json           ← Frontend dependencies
│   └── src/
│       ├── main.jsx           ← App entry point (mounts React)
│       ├── App.jsx            ← All page routes defined here
│       ├── index.css          ← Global styles
│       ├── components/        ← Reusable UI pieces
│       │   ├── Layout.jsx     ← Page wrapper (nav + content area)
│       │   ├── SideNavBar.jsx ← Left sidebar navigation
│       │   ├── TopNavBar.jsx  ← Top header bar
│       │   └── RoleRoute.jsx  ← Protects pages by user role
│       ├── pages/             ← One file per screen
│       │   ├── Auth.jsx              ← Login / Sign Up
│       │   ├── StudentDashboard.jsx  ← Student home
│       │   ├── InstructorDashboard.jsx
│       │   ├── Courses.jsx           ← Course list
│       │   ├── CourseHub.jsx         ← Course detail page
│       │   ├── CreateCourse.jsx      ← Instructor: create course
│       │   ├── JoinCourse.jsx        ← Student: join course
│       │   ├── AITutor.jsx           ← AI chat tutor
│       │   ├── AIEvaluatorTraining.jsx ← Train the AI evaluator
│       │   ├── StudentAssignments.jsx
│       │   ├── InstructorAssignments.jsx
│       │   ├── StudentGrades.jsx
│       │   ├── GradeReview.jsx
│       │   └── Leaderboard.jsx
│       ├── context/
│       │   └── AuthContext.jsx ← Manages login state app-wide
│       ├── config/
│       │   └── supabase.js     ← Supabase client (database + auth)
│       └── services/
│           └── aiService.js    ← Calls the Node.js backend for AI
│
├── server/                    ← Node.js + Express Backend (runs on localhost:8000)
│   ├── .env                   ← Your Gemini API key (never commit this!)
│   ├── .env.example           ← Copy this to create your .env
│   ├── package.json           ← Backend dependencies
│   └── src/
│       ├── index.js           ← Server entry point
│       ├── routes/
│       │   └── ai.routes.js   ← API route definitions (/api/chat, /api/evaluate)
│       └── controllers/
│           └── ai.controller.js ← Logic for AI chat and evaluation
│
└── database/
    └── schema.sql             ← Supabase table structure (run this in Supabase SQL editor)
```

---

## 🚀 How to Run Locally

### 1. Install Dependencies

```bash
# Install both client and server packages in one command
npm run install:all
```

### 2. Set Up Environment Variables

**Client (`client/.env`):**
```bash
# Copy the example file
cp client/.env.example client/.env
```
Then open `client/.env` and fill in your **Supabase** credentials:
- Go to [supabase.com](https://supabase.com) → Your Project → **Settings → API**
- Copy `Project URL` → paste as `VITE_SUPABASE_URL`
- Copy `anon public` key → paste as `VITE_SUPABASE_ANON_KEY`

**Server (`server/.env`):**
```bash
cp server/.env.example server/.env
```
Then open `server/.env` and fill in your **Gemini API key**:
- Go to [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)
- Create a key and paste it as `GEMINI_API_KEY`

### 3. Set Up the Database

- Open your [Supabase dashboard](https://supabase.com)
- Go to **SQL Editor**
- Copy and paste the contents of `database/schema.sql` and run it

### 4. Start the App

Open **two terminal windows**:

**Terminal 1 — Frontend:**
```bash
npm run dev:client
# Opens at http://localhost:5173
```

**Terminal 2 — Backend:**
```bash
npm run dev:server
# Runs at http://localhost:8000
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| Styling | Tailwind CSS |
| Auth & Database | Supabase |
| AI Backend | Node.js + Express |
| AI Model | Google Gemini |

---

## 📝 Notes

- The `client/.env` and `server/.env` files contain secret keys — **never commit them to Git**
- `node_modules/` folders are excluded from Git automatically via `.gitignore`
- To rebuild the frontend for production: `npm run build --prefix client`
