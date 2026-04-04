// src/services/aiService.js

/**
 * Configure this base URL to point exactly to your backend server.
 * By default, it expects a local server running on port 8000.
 */
const API_BASE_URL = import.meta.env.VITE_AI_BACKEND_URL || 'http://localhost:8000/api';

export const aiService = {
  /**
   * Evaluate a student's file submission against an assignment rubric.
   * 
   * @param {Object} payload 
   * @param {string} payload.fileUrl - Firebase Storage URL of the submitted file
   * @param {string} payload.fileName - Name of the file
   * @param {string} payload.courseId - ID of the course
   * @param {string} payload.assignmentPrompt - Instructor's description/rubric
   * @param {number} payload.maxScore - Maximum possible score
   * @returns {Promise<{score: number, feedback: string}>}
   */
  async evaluateSubmission(payload) {
    try {
      // Convert older frontend generic payload to strictly match the new robust backend requirements
      const backendPayload = {
        submission: payload.textContent || `The student submitted a file. Find the details here: ${payload.fileUrl} (Name: ${payload.fileName})`,
        rubric: {
          "logic": 40,
          "efficiency": 30,
          "documentation": 30
        },
        notes: payload.assignmentPrompt || "Please evaluate this submission."
      };

      const response = await fetch(`${API_BASE_URL}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendPayload)
      });
      
      if (!response.ok) {
        throw new Error(`Backend Error ${response.status}: Ensure your Node server is running.`);
      }
      
      const data = await response.json();
      
      return {
        score: typeof data.score === 'number' ? data.score : 0, 
        feedback: data.feedback || "The AI returned an empty evaluation."
      };
    } catch (error) {
      console.error("[aiService] Evaluation Request Failed:", error);
      throw error; // Propagate up to the UI to show the user the error flag
    }
  },

  /**
   * Send a chat message to the AI Tutor for a specific course.
   * 
   * @param {string} message - The student's latest question
   * @param {string} courseId - The context ID for the curriculum RAG
   * @param {Array} history - Array of previous { role: 'user'|'model', content: string }
   * @returns {Promise<string>} - The AI's markdown response
   */
  async chatWithTutor(message, courseId, history = []) {
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, courseId, history })
      });
      
      if (!response.ok) {
        throw new Error(`Backend Error ${response.status}: Ensure your Node server is running.`);
      }
      
      const data = await response.json();
      return data.reply || data.response || "Silence from the AI.";
    } catch (error) {
      console.error("[aiService] Chat Request Failed:", error);
      throw error;
    }
  }
};
