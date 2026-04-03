# Entra ID Authentication Frontend

React application demonstrating Azure Entra ID authentication flows.

## Features

✅ **Device Code Flow UI** - Complete user interface with code display and polling  
✅ **PRT Information Display** - Educational content about Primary Refresh Tokens  
✅ **Silent Authentication Demo** - Simulates PRT-like token refresh  
✅ **Clean Modern UI** - Professional styling with status indicators

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure `.env` file:
```env
VITE_API_URL=http://localhost:5000
```

3. Start development server:
```bash
npm run dev
```

4. Open browser to `http://localhost:5173`

## Usage

### Device Code Flow
1. Click "Start Device Code Flow"
2. Copy the displayed code
3. Open the verification URL in a new tab
4. Enter the code and sign in
5. Return to the app - it will auto-detect completion

### PRT Simulation
1. First authenticate using Device Code Flow
2. Click "Simulate PRT Silent Auth"
3. See how cached tokens enable silent authentication

## Build
```bash
npm run build
```

Output in `dist/` folder.

## Architecture

- React 18 with hooks
- Vite for fast development
- Vanilla CSS (no frameworks)
- REST API integration with backend