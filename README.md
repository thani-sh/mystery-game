# mystery-game

A proof-of-concept repository for a web-based 2D mystery investigation game.

> **Agents (human or AI): read [AGENTS.md](./AGENTS.md) first** — it documents the current architecture, content schema, and the commands/gates to follow.

## Repository Structure

```
mystery-game/
├── docs/           # Documentation and Architectural Decision Records (+ plans/)
├── game/           # The PixiJS-based mystery game application
└── tools/          # Development tools for asset creation
```

## Documentation

See the [docs](./docs) directory for architectural decisions and design documentation:

- [Architectural Decision Records (ADRs)](./docs/adrs/README.md)

## Development Tools

The [tools](./tools) directory contains development tools for creating game assets:

- **Character Designer**: Web-based tool for generating AI-ready character design prompts

See [tools/README.md](./tools/README.md) for more information.

## Game Application

The main game application is in the [game](./game) directory. See [AGENTS.md](./AGENTS.md) for setup, structure, and development instructions.

## Quick Start

```bash
# Install dependencies
cd game
npm install

# Run development server
npm run start

# Build for production
npm run build
```

## Technology Stack

- **PixiJS v8**: High-performance 2D WebGL rendering
- **TypeScript**: Type-safe development
- **Vite**: Fast build tool and dev server

For detailed information about the game, see [game/README.md](./game/README.md).
