// server/src/services/leaderboard.service.js
const { supabase } = require('../supabase');

/**
 * Fetch leaderboard data (global or subject-specific)
 * @param {string} subjectId - Optional subject UUID
 * @returns {Promise<Array>} - Ranked leaderboard data
 */
async function getLeaderboardData(subjectId = null) {
  try {
    // 1. Core query using aggregation
    // We join submissions -> assignments -> profiles
    let query = supabase
      .from('submissions')
      .select(`
        ai_score,
        final_score,
        submitted_at,
        course_id,
        profiles:student_id (
          id,
          full_name
        )
      `)
      .eq('status', 'evaluated'); // Only count evaluated ones

    if (subjectId && subjectId !== 'global') {
      query = query.eq('course_id', subjectId);
    }

    const { data: rawSubmissions, error } = await query;
    if (error) throw error;

    if (!rawSubmissions || rawSubmissions.length === 0) return [];

    // 2. Aggregate data by student in memory (since Supabase select aggregation is limited in JS)
    const studentMap = {};

    rawSubmissions.forEach(sub => {
      const student = sub.profiles;
      if (!student) return;

      if (!studentMap[student.id]) {
        studentMap[student.id] = {
          student_id: student.id,
          student_name: student.full_name || 'Unknown Student',
          total_score: 0,
          count: 0,
          earliest_submission: sub.submitted_at
        };
      }

      const entry = studentMap[student.id];
      // Use final_score if available (instructor grade), else ai_score
      const score = Number(sub.final_score ?? sub.ai_score ?? 0);
      entry.total_score += score;
      entry.count += 1;
      if (new Date(sub.submitted_at) < new Date(entry.earliest_submission)) {
        entry.earliest_submission = sub.submitted_at;
      }
    });

    // 3. Transform to final format and sort
    const results = Object.values(studentMap).map(s => ({
      ...s,
      avg_score: Math.round((s.total_score / s.count) * 10) / 10,
      assignments_completed: s.count
    }));

    // Ranking rules:
    // 1. Sort by avg_score DESC
    // 2. If tie → sort by total_score DESC
    // 3. If tie → earliest submission wins
    results.sort((a, b) => {
      if (b.avg_score !== a.avg_score) return b.avg_score - a.avg_score;
      if (b.total_score !== a.total_score) return b.total_score - a.total_score;
      return new Date(a.earliest_submission) - new Date(b.earliest_submission);
    });

    // 4. Assign ranks and badges
    return results.map((student, index) => {
      const rank = index + 1;
      let badge = null;
      if (rank === 1) badge = 'gold';
      else if (rank === 2) badge = 'silver';
      else if (rank === 3) badge = 'bronze';

      return {
        rank,
        ...student,
        badge
      };
    });

  } catch (error) {
    console.error('Error in getLeaderboardData:', error.message);
    throw error;
  }
}

module.exports = {
  getLeaderboardData
};
