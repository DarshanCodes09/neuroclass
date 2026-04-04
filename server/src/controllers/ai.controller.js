const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({});
const MODEL_NAME = 'gemini-2.5-flash';

const chat = async (req, res) => {
  try {
    const { message, courseId, history } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const formattedHistory = (history || []).map(msg => ({
      role: msg.role === 'model' ? 'model' : 'user',
      parts: [{ text: msg.content || msg.text || '' }]
    }));

    const systemPrompt = "You are a helpful AI tutor for a course platform called NeuroClass. Provide clear, concise, and educational answers focusing on guiding the student rather than just giving away the solution.";

    formattedHistory.unshift({
      role: 'user',
      parts: [{ text: `SYSTEM CONTEXT: ${systemPrompt}` }]
    });
    
    formattedHistory.unshift({
      role: 'model',
      parts: [{ text: "Understood. I will act as the AI Tutor." }]
    });

    formattedHistory.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: formattedHistory
    });

    const reply = response.text || "I'm sorry, I couldn't generate a response.";
    res.json({ reply });
  } catch (error) {
    console.error('Error in chat controller:', error);
    res.status(500).json({ error: 'Failed to communicate with AI Tutor' });
  }
};

const evaluate = async (req, res) => {
  try {
    const { assignmentPrompt, fileUrl, fileName, maxScore, textContent } = req.body;

    const dataToEvaluate = textContent || `The file URL is: ${fileUrl} (Name: ${fileName})`;

    const prompt = `
You are an expert Auto-Evaluator for NeuroClass.
Evaluate the following student submission based on this assignment prompt/rubric.

Assignment Prompt/Rubric:
${assignmentPrompt || 'Evaluate for general quality.'}

Maximum Possible Score: ${maxScore || 100}

Student Submission:
${dataToEvaluate}

Please respond with a JSON object ONLY containing exactly two keys: "score" (a number) and "feedback" (a string formatted in markdown explaining the score). Do not wrap the JSON in code blocks like \`\`\`json.
`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt
    });

    const outputText = response.text || "{}";
    
    let evaluationData = { score: 0, feedback: "Failed to parse AI response." };
    try {
      const cleanText = outputText.replace(/```json/g, '').replace(/```/g, '').trim();
      evaluationData = JSON.parse(cleanText);
    } catch (parseError) {
      console.error("Failed to parse Gemini JSON output:", parseError, "Raw output:", outputText);
      evaluationData = { score: 0, feedback: outputText };
    }

    res.json(evaluationData);
  } catch (error) {
    console.error('Error in evaluate controller:', error);
    res.status(500).json({ error: 'Failed to evaluate submission' });
  }
};

module.exports = {
  chat,
  evaluate
};
