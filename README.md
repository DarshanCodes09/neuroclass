# 🎓 NeuroClass: Google Classroom Style AI-Powered Evaluation

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/DarshanCodes09/neuroclass)

**NeuroClass** is an AI-enhanced Learning Management System (LMS) that brings the familiar, streamlined evaluation workflow of **Google Classroom** into the age of artificial intelligence. It allows instructors to create assignments and students to submit work, but replaces traditional manual grading with a high-speed, forensic AI evaluation engine.

By combining the intuitive assignment management of Google Classroom with the analytical power of Groq's Llama-3 models, NeuroClass ensures students receive instant, high-quality feedback while instructors maintain complete control through custom rubrics and "gold standard" training samples.

## 🏗️ Architecture Overview

**Frontend (React + Vite)**  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓  
**Backend API (Node.js + Express)**  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓  
**AI Engine (Groq + Gemini)**  
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;↓  
**Vector DB + PostgreSQL (Supabase)**

---

## 📋 Google Classroom Style Workflow

NeuroClass mimics the intuitive flow of Google Classroom to make it instantly familiar:
1. **Assignment Creation**: Instructors post assignments, attach rubrics, and provide baseline "Gold Samples."
2. **Student Submission**: Students submit answers via text, PDF, or DOCX, just like in a standard LMS.
3. **AI Evaluation**: The AI instantly grades the work based on the instructor's rubric (replacing manual review).
4. **Instant Results**: Students get their marks and feedback immediately in their dashboard.
5. **Leaderboard Update**: Successful submissions are automatically ranked on the course leaderboard.

---

### 1. ⚖️ 100% AI-Driven Forensic Evaluator
Powered by **Groq (Llama 3.3 70B)**, our evaluation engine goes beyond simple grading.
- **Relevancy Gate**: Automatically detects off-topic or "Hallucinated" answers and applies a zero-tolerance policy.
- **Gap Analysis**: Identifies exactly what concepts are missing from a student's answer based on the instructor's rubric.
- **Evidence-Based Grades**: Forced to quote the student's work to justify every point awarded or deducted.

### 2. 🕵️ Vector-Based Plagiarism Detection
Built-in peer-to-peer similarity checks.
- Calculates **Cosine Similarity** between submissions within the same assignment.
- Flags suspicious overlaps to instructors before final scores are published.

### 3. 🎓 Socratic AI Tutor
A dedicated chat assistant for students.
- **Non-Directive Support**: Guides students toward the answer using hints and logic instead of giving away solutions.
- **Course Context**: Uses course-specific materials (PDFs, uploads) to provide relevant guidance.

### 4. 🏆 Dynamic Leaderboard & Analytics
- **Live Rankings**: Automatic student spotlight for Top 3 performers (Gold, Silver, Bronze badges).
- **Course Specificity**: Filter rankings by subject or view global performance.

### 5. 🛠️ Instructor Training Suite
Instructors can fine-tune the AI by:
- Uploading custom **Rubrics**.
- Providing **Gold Standard Samples** (High/Medium/Low quality) for few-shot learning accuracy.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | React (Vite), Tailwind CSS, Lucide React, Firebase Auth |
| **Backend** | Node.js, Express, Multer, PDF-Parse, Mammoth |
| **Database** | Supabase (PostgreSQL) |
| **AI Engine** | Groq (Llama 3.1 & 3.3), Google Gemini |
| **Styling** | Vanilla CSS (Modern Aesthetics), Glassmorphism |

---

## ⚙️ Installation & Setup

### 1. Clone the Repository
```bash
git clone https://github.com/DarshanCodes09/neuroclass.git
cd neuroclass
```

### 2. Environment Configuration
Create a `.env` file in both `client` and `server` folders.

**Server (.env):**
```env
PORT=8000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GROQ_API_KEY=your_groq_key
```

**Client (.env):**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_AI_BACKEND_URL=http://localhost:8000/api
```

### 3. Install Dependencies
```bash
# From the root directory
npm run install:all
```

### 4. Start Development Servers
```bash
# Start Backend (Port 8000)
npm run dev:server

# Start Frontend (Vite)
npm run dev:client
```

---

## 🤝 Contributing

We welcome contributions from the community! To contribute to NeuroClass:

1. **Fork** the repository.
2. **Create** a new branch (`git checkout -b feature/amazing-feature`).
3. **Commit** your changes (`git commit -m 'Add some amazing feature'`).
4. **Push** to the branch (`git push origin feature/amazing-feature`).
5. **Open** a Pull Request.

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.

Developed with ❤️ by **Darshan Kushalkar**.
