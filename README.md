# Recruiter Assistant UI

React frontend for the [Recruiter Chatbot](../recruiter_chatbot/README.md). The Python backend source is available on [GitHub](https://github.com/akash-sindu/recruiter_chatbot). It accepts job descriptions as pasted text or PDF/DOCX files, displays the parsed role and evidence-based fit analysis, and streams follow-up answers from the Flask API.

## Prerequisites

- Node.js 22.12 or newer
- The `recruiter_chatbot` backend running locally on port `50000`
- A configured Groq API key and a local candidate profile for the backend

## Run Locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The API base URL is currently set in `src/App.jsx` to `http://localhost:50000/api`; change it there if the backend uses another address.

## Checks

```sh
npm run lint
npm run build
```

## Privacy

This interface is a local development demo, not an authenticated public service. Job descriptions, candidate-profile information, and chat messages are processed by the backend and sent to Groq. Use synthetic data for demonstrations unless you have permission to share real data with that provider. Do not publish API keys, resumes, or candidate profiles.