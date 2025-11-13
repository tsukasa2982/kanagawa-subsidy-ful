import { configure } from 'genkit/config'; 
import { googleAI } from '@genkit-ai/googleai';
import { firebase } from '@genkit-ai/firebase';

const googleApiKey = process.env.GOOGLE_GENAI_API_KEY;
if (!googleApiKey) {
  console.warn("GOOGLE_GENAI_API_KEY is not defined at config time.");
}

export default configure({
  plugins: [
    googleAI({
      apiKey: googleApiKey || "YOUR_API_KEY_HERE",
    }),
    firebase(),
  ],
  logLevel: 'debug',
  enableTracing: true,
});