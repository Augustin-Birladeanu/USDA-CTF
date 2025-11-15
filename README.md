# React + Vite
This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.
Currently, two official plugins are available:
- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Setup

### 1. Install Dependencies
Run the following command to install all required dependencies:
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory of your project and add the following environment variables:

```
VITE_APP_FIREBASE_API_KEY=
VITE_APP_FIREBASE_AUTH_DOMAIN=
VITE_APP_FIREBASE_DATABASE_URL=
VITE_APP_FIREBASE_PROJECT_ID=
VITE_APP_FIREBASE_STORAGE_BUCKET=
VITE_APP_FIREBASE_MESSAGING_SENDER_ID=
VITE_APP_FIREBASE_APP_ID=
VITE_APP_FIREBASE_MEASUREMENT_ID=
```

Fill in your Firebase configuration values for each variable.

### 3. Add Google Gemini API Key
To enable the chatbot functionality, you'll also need to add a Google Gemini 2.0 Flash API key. Add the following to your `.env` file:

```
VITE_APP_GEMINI_API_KEY=
```

Obtain your API key from the [Google AI Studio](https://aistudio.google.com) and paste it into the `.env` file.

## React Compiler
The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.
Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration
If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and `typescript-eslint`](https://typescript-eslint.io) in your project.
