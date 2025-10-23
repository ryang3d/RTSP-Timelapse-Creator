module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

# ============================================
# .env.example
# ============================================
# Save as: .env.example (copy to .env for local development)

# Backend
PORT=3001
WS_PORT=3002
NODE_ENV=development

# Frontend
REACT_APP_API_URL=http://localhost:3001
REACT_APP_WS_URL=ws://localhost:3002