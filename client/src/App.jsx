import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Auth from './pages/Auth';
import InstructorDashboard from './pages/InstructorDashboard';
import StudentDashboard from './pages/StudentDashboard';
import CreateCourse from './pages/CreateCourse';
import JoinCourse from './pages/JoinCourse';
import Courses from './pages/Courses';
import InstructorAssignments from './pages/InstructorAssignments';
import StudentAssignments from './pages/StudentAssignments';
import GradeReview from './pages/GradeReview';
import StudentGrades from './pages/StudentGrades';
import AITutor from './pages/AITutor';
import AIEvaluatorTraining from './pages/AIEvaluatorTraining';
import RoleRoute from './components/RoleRoute';
import CourseHub from './pages/CourseHub';
import Leaderboard from './pages/Leaderboard';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Auth />} />

      {/* Instructor Module */}
      <Route path="/instructor" element={<RoleRoute allowedRole="Instructor" />}>
        <Route element={<Layout />}>
          <Route path="dashboard" element={<InstructorDashboard />} />
          <Route path="courses" element={<Courses />} />
          <Route path="create-course" element={<CreateCourse />} />
          <Route path="evaluator-training" element={<AIEvaluatorTraining />} />
          <Route path="assignments" element={<InstructorAssignments />} />
          <Route path="grade-review" element={<GradeReview />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="course/:courseId" element={<CourseHub />} />
        </Route>
      </Route>

      {/* Student Module */}
      <Route path="/student" element={<RoleRoute allowedRole="Student" />}>
        <Route element={<Layout />}>
          <Route path="dashboard" element={<StudentDashboard />} />
          <Route path="courses" element={<Courses />} />
          <Route path="join-course" element={<JoinCourse />} />
          <Route path="ai-tutor" element={<AITutor />} />
          <Route path="assignments" element={<StudentAssignments />} />
          <Route path="grades" element={<StudentGrades />} />
          <Route path="leaderboard" element={<Leaderboard />} />
          <Route path="course/:courseId" element={<CourseHub />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
