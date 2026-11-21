# CognitivePulse

A free, science-based memory improvement web application built with React, TypeScript, and Tailwind CSS.

## Features

- **6 Cognitive Games**: Digit Span, Spatial Matrix, Card Pairs, Stroop Challenge, Object Grid, and Rapid Flash
- **Local Progress Tracking**: Store your stats offline without an account
- **Adaptive Difficulty**: Games adjust to your skill level
- **Dark Mode**: Easy on the eyes for extended play sessions
- **Responsive Design**: Works on desktop, tablet, and mobile browsers
- **Zero Cost**: Completely free to use, no paywalls or subscriptions

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── components/       # Reusable UI components
├── data/            # Static game data and configurations
├── games/           # Individual game implementations
├── pages/           # Main page components
├── store/           # Zustand state management
├── types/           # TypeScript type definitions
└── utils/           # Helper functions
```

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand (with localStorage persistence)
- **Routing**: React Router v6
- **Build Tool**: Vite
- **Icons**: Lucide React

## Development

The project is configured for immediate development. All games are fully functional with:

1. Local storage persistence for guest users
2. Score tracking and accuracy calculation
3. Adaptive difficulty scaling
4. Session history recording

To add a new game:

1. Create a new component in `src/games/`
2. Register it in `src/data/games.ts`
3. Add the import in `src/pages/GamePlay.tsx`

## License

MIT
