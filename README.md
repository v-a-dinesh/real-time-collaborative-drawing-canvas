# 🎨 Flamdraw - Real-Time Collaborative Whiteboard

<div align="center">

![Flamdraw](https://img.shields.io/badge/Flamdraw-Real--Time%20Collaborative%20Canvas-6366F1?style=for-the-badge&logo=canvas&logoColor=white)

[![Live Demo](https://img.shields.io/badge/🚀%20Live%20Demo-Visit%20Flamdraw-4CAF50?style=for-the-badge)](https://real-time-collaborative-drawing-canvas-rqd8.onrender.com/)
[![GitHub](https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github)](https://github.com/v-a-dinesh/real-time-collaborative-drawing-canvas)

**A professional-grade multi-user drawing application with real-time synchronization, built with TypeScript, Socket.io, and HTML5 Canvas.**

[Live Demo](https://real-time-collaborative-drawing-canvas-rqd8.onrender.com/) • [Architecture Docs](ARCHITECTURE.md) • [Features](#-features) • [Quick Start](#-quick-start)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Live Demo](#-live-demo)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [Usage Guide](#-usage-guide)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [API Documentation](#-api-documentation)
- [Deployment](#-deployment)
- [Architecture](#-architecture)
- [Performance](#-performance)
- [Known Limitations](#-known-limitations)
- [Future Roadmap](#-future-roadmap)

---

## 🎯 Overview

**Flamdraw** is a feature-rich collaborative whiteboard application that enables multiple users to draw, create shapes, and add text on a shared canvas in real-time. Inspired by tools like Excalidraw and Figma, it provides a seamless collaborative experience with zero signup required.

### Key Highlights

| Feature | Description |
|---------|-------------|
| 🔄 **Real-Time Sync** | Instant synchronization of all drawing actions across users |
| 🏠 **Room-Based** | Create isolated rooms for team collaboration |
| 🎨 **Rich Tools** | Brush, eraser, shapes (rectangle, circle, line), and text |
| ↩️ **Global Undo/Redo** | Cross-user undo - anyone can undo any action |
| 👻 **Ghost Cursors** | See other users' cursors in real-time |
| 📱 **Mobile Responsive** | Full touch support for tablets and phones |
| 📤 **Export** | Save your work as PNG or SVG |

---

## 🚀 Live Demo

### Production URL
**[https://real-time-collaborative-drawing-canvas-rqd8.onrender.com/](https://real-time-collaborative-drawing-canvas-rqd8.onrender.com/)**

### Test Multi-User Collaboration
1. Open the link in **two or more browser windows/devices**
2. Enter different usernames in each window
3. Start drawing - see changes sync instantly!
4. Create a room and share the URL for isolated collaboration

> **Note:** The app is hosted on Render.com's free tier. Initial load may take 30-60 seconds if the server is cold.

---

## ✨ Features

### Drawing Tools
| Tool | Description |
|------|-------------|
| **Brush** | Smooth freehand drawing with adjustable stroke width (1-50px) |
| **Eraser** | Erase strokes with variable size |
| **Rectangle** | Draw rectangles with optional fill |
| **Circle** | Draw circles/ellipses with optional fill |
| **Line** | Draw straight lines |
| **Text** | Click anywhere to add text labels |

### Real-Time Collaboration
- **Live Synchronization** - All strokes, shapes, and text sync instantly
- **Ghost Cursors** - See collaborators' cursor positions with their names
- **User Presence** - View all connected users in the room panel
- **Room System** - Create/join isolated rooms via URL or room ID

### Canvas Controls
- **Undo/Redo** - Global undo affects all users' actions (timestamp-based)
- **Clear Canvas** - Wipe the entire canvas (in menu)
- **Zoom Controls** - Zoom in/out with percentage display
- **Export Options** - Download as PNG or SVG

### User Experience
- **No Signup Required** - Just enter a display name and start drawing
- **Keyboard Shortcuts** - Full keyboard support for power users
- **Mobile Responsive** - Optimized touch controls for mobile devices
- **Excalidraw-Inspired UI** - Clean, minimal, professional interface

### Technical Features
- **Connection Recovery** - Auto-reconnection with exponential backoff
- **Offline Queue** - Strokes queued during disconnection
- **Input Validation** - Server-side validation for all inputs
- **Performance Metrics** - Real-time FPS and latency display

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **TypeScript** | Type-safe JavaScript with strict mode |
| **HTML5 Canvas API** | Raw Canvas API (no libraries like Fabric.js) |
| **CSS3** | Modern styling with CSS variables |
| **Socket.io Client** | WebSocket communication |
| **Vite** | Fast development server with HMR |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js** | JavaScript runtime (v20+) |
| **Express.js** | HTTP server and routing |
| **Socket.io** | Real-time bidirectional communication |
| **TypeScript** | Type-safe server code |
| **esbuild** | Fast production bundling |

### DevOps
| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization (~50MB image) |
| **Docker Compose** | Multi-container orchestration |
| **Render.com** | Cloud deployment platform |

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** v20.x or higher
- **npm** v9.x or higher
- **Git**

### Installation

```bash
# Clone the repository
git clone https://github.com/v-a-dinesh/real-time-collaborative-drawing-canvas.git
cd real-time-collaborative-drawing-canvas

# Install dependencies
npm install

# Start development servers
npm run dev
```

### Access Points

| Service | URL | Description |
|---------|-----|-------------|
| Landing Page | http://localhost:5173 | Marketing/landing page |
| Canvas | http://localhost:5173/index.html | Drawing canvas |
| Server | http://localhost:3000 | WebSocket server |
| Health Check | http://localhost:3000/health | Server health status |

### Test Multi-User Locally

1. Open `http://localhost:5173` in **2+ browser windows**
2. Click "Free Whiteboard" → Enter different usernames
3. Draw in one window → See it appear in others instantly
4. Press `Ctrl+Z` in Window B to undo Window A's last stroke

---

## 📁 Project Structure

```
collaborative-canvas/
├── 📂 client/                    # Frontend application
│   ├── index.html                # Canvas page (Excalidraw-style UI)
│   ├── landing.html              # Marketing landing page
│   ├── style.css                 # Canvas styles (1300+ lines)
│   ├── landing.css               # Landing page styles
│   └── 📂 src/
│       ├── main.ts               # App orchestrator & initialization
│       ├── canvas.ts             # Drawing engine (Canvas API)
│       ├── ui.ts                 # Toolbar & UI interactions
│       ├── websocket.ts          # Socket.io client wrapper
│       └── utils.ts              # Utility functions
│
├── 📂 server/                    # Backend application
│   ├── server.ts                 # Development server (Express + Socket.io)
│   ├── production.ts             # Production server (bundled)
│   ├── rooms.ts                  # Room management logic
│   └── drawing-state.ts          # Canvas state management
│
├── 📂 shared/                    # Shared code
│   └── types.ts                  # TypeScript interfaces & types
│
├── 📄 package.json               # Dependencies & scripts
├── 📄 tsconfig.json              # TypeScript configuration
├── 📄 vite.config.ts             # Vite configuration
├── 📄 Dockerfile                 # Multi-stage Docker build
├── 📄 docker-compose.yml         # Docker Compose config
├── 📄 README.md                  # This file
└── 📄 ARCHITECTURE.md            # Technical architecture docs
```

---

## 📖 Usage Guide

### Creating a Room

1. Click the **hamburger menu** (☰) in the top-left
2. The room panel shows your current room
3. Click **"New Room"** to create an isolated workspace
4. Share the URL with collaborators

### Joining a Room

- **Via URL**: Open a shared link containing `?room=ROOM_ID`
- **Via Room ID**: Enter the room ID in the join input field

### Drawing Tools

| Tool | Icon | Shortcut | Description |
|------|------|----------|-------------|
| Selection | ↖️ | `V` | Select elements (future) |
| Brush | ✏️ | `B` | Freehand drawing |
| Rectangle | ⬜ | `R` | Draw rectangles |
| Circle | ⭕ | `C` | Draw circles/ellipses |
| Line | ➖ | `L` | Draw straight lines |
| Text | 🔤 | `T` | Add text labels |
| Eraser | 🧹 | `E` | Erase strokes |

### Customization

- **Colors**: 8 preset colors + custom color picker
- **Fill Styles**: Solid, Hachure, Cross-hatch
- **Stroke Width**: 8 preset widths (1px to 50px)

### Exporting

1. Click the **hamburger menu** (☰)
2. Select **"Export PNG"** or **"Export SVG"**
3. File downloads automatically

---

## ⌨️ Keyboard Shortcuts

### Tools
| Shortcut | Action |
|----------|--------|
| `V` | Selection tool |
| `B` | Brush tool |
| `E` | Eraser tool |
| `R` | Rectangle tool |
| `C` | Circle tool |
| `L` | Line tool |
| `T` | Text tool |

### Actions
| Shortcut | Action |
|----------|--------|
| `Ctrl+Z` | Undo (global) |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo (global) |
| `[` | Decrease stroke width |
| `]` | Increase stroke width |
| `F` | Toggle shape fill |
| `?` | Toggle help panel |

---

## 📡 API Documentation

### WebSocket Events

#### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `stroke:start` | `{strokeId, x, y, color, width, tool}` | Begin new stroke |
| `stroke:move` | `{strokeId, x, y}` | Add point to stroke |
| `stroke:end` | `{strokeId}` | Finalize stroke |
| `shape:add` | `{shape: Shape}` | Add completed shape |
| `text:add` | `{text: TextElement}` | Add text element |
| `cursor:move` | `{x, y}` | Update cursor position |
| `undo` | - | Request global undo |
| `redo` | - | Request global redo |
| `room:join` | `{roomId}` | Join specific room |

#### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `stroke:broadcast` | `{stroke: Stroke}` | New stroke from other user |
| `shape:broadcast` | `{shape: Shape}` | New shape from other user |
| `cursor:update` | `{userId, x, y, color, name}` | Cursor position update |
| `state:full` | `{strokes, shapes, textElements}` | Full canvas state |
| `users:list` | `{users, currentUser}` | All users in room |
| `undo:redo:broadcast` | `{strokes, shapes, textElements}` | State after undo/redo |

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Landing page |
| `/canvas` | GET | Canvas application |
| `/health` | GET | Server health status |

### Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2026-02-01T12:00:00.000Z",
  "connections": 5,
  "rooms": 2,
  "uptime": 3600
}
```

---

## 🐳 Deployment

### Docker (Recommended)

```bash
# Build and run with Docker Compose
docker compose up --build

# Or build manually
docker build -t flamdraw .
docker run -p 3000:3000 flamdraw
```

The app will be available at `http://localhost:3000`

### Render.com (Cloud)

The app is configured for automatic deployment on Render.com:

1. Connect your GitHub repository to Render
2. Render automatically detects the Dockerfile
3. Deploys on every push to `main` branch

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | production | Environment mode |
| `MAX_STROKES` | 5000 | Max strokes per room |
| `MAX_UNDO_HISTORY` | 50 | Max undo stack size |

---

## 🏗️ Architecture

For detailed technical documentation, see [**ARCHITECTURE.md**](ARCHITECTURE.md).

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                          │
│  ┌─────────┐  ┌────────┐  ┌──────────┐  ┌───────────────┐   │
│  │ main.ts │──│ ui.ts  │──│canvas.ts │──│ websocket.ts  │   │
│  └─────────┘  └────────┘  └──────────┘  └───────┬───────┘   │
└─────────────────────────────────────────────────┼───────────┘
                                                  │ Socket.io
┌─────────────────────────────────────────────────▼───────────┐
│                    SERVER (Node.js)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Room Manager│  │State Manager│  │ Event Handler       │  │
│  │ (per-room)  │  │ (strokes)   │  │ (Socket.io)         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Raw Canvas API** | Full control, no library overhead |
| **Timestamp-based Undo** | Enables cross-user undo/redo |
| **Full State Broadcast** | Simplicity over complexity (vs CRDT) |
| **Room Isolation** | Independent canvas state per room |
| **Server Authority** | Single source of truth for consistency |

---

## ⚡ Performance

### Optimizations Implemented

- **60 FPS Cursor Throttling** - Cursor updates throttled to 16ms
- **Point Smoothing** - Exponential moving average for smoother lines
- **DPR Scaling** - Canvas scaled by devicePixelRatio for crisp rendering
- **Incremental Drawing** - Only new points drawn, not full redraw
- **Efficient Serialization** - Minimal payload for stroke moves

### Resource Limits

| Resource | Limit | Purpose |
|----------|-------|---------|
| Max Strokes/Room | 5,000 | Memory management |
| Max Shapes/Room | 1,000 | Memory management |
| Max Points/Stroke | 10,000 | Prevent abuse |
| Max Undo Stack | 50 | Memory management |

---

## ⚠️ Known Limitations

| Limitation | Description | Workaround |
|------------|-------------|------------|
| **No Persistence** | Drawings lost on server restart | Export before leaving |
| **No Authentication** | Anonymous users only | Use unique room IDs |
| **Memory-Based** | All state in server memory | For demo purposes |
| **Single Server** | Not horizontally scalable | Use Redis for scale |

---

## 🔮 Future Roadmap

- [ ] **Persistence** - Save drawings to database
- [ ] **User Authentication** - Sign in with GitHub/Google
- [ ] **Selection Tool** - Select and move elements
- [ ] **Layers** - Separate layers per user
- [ ] **Image Upload** - Add images to canvas
- [ ] **Presentation Mode** - Share read-only views
- [ ] **Mobile App** - React Native version

---

## 📊 Development Timeline

| Phase | Duration | Features |
|-------|----------|----------|
| Phase 1 | 2-3 hours | Basic canvas, brush, eraser, colors |
| Phase 2 | 3-4 hours | WebSocket sync, ghost cursors |
| Phase 3 | 2-3 hours | Error handling, reconnection |
| Phase 4 | 2 hours | Docker, production build |
| Phase 5 | 3-4 hours | Shapes, text, rooms, export |
| Phase 6 | 2-3 hours | Excalidraw UI, mobile responsive |
| Documentation | 1-2 hours | README, Architecture docs |
| **Total** | **~18 hours** | Full-featured collaborative canvas |

---

## 👨‍💻 Author

**V A Dinesh**

- GitHub: [@v-a-dinesh](https://github.com/v-a-dinesh)
- Project: [real-time-collaborative-drawing-canvas](https://github.com/v-a-dinesh/real-time-collaborative-drawing-canvas)

---

## 📄 License

This project is licensed under the MIT License.

---

<div align="center">

**Built with ❤️ for Flam Assignment**

[⬆ Back to Top](#-flamdraw---real-time-collaborative-whiteboard)

</div>
