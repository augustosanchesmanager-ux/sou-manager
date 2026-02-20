import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.API_KEY || '';

// Initialize only if key is present to avoid runtime crashes in dev without env
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

export const generateBusinessInsights = async (metrics: any): Promise<string> => {
  if (!ai) return "API Key not configured.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Analyze these barber shop metrics and provide a concise, 1-paragraph strategic insight for the owner to improve revenue: ${JSON.stringify(metrics)}`,
    });
    return response.text || "No insights generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Could not generate insights at this time.";
  }
};