# Real-Time Collaborative Drawing Canvas

A multi-user drawing application with real-time synchronization, featuring shape tools, text support, room-based collaboration, and export capabilities.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development (client + server)
npm run dev
```

**The app will be available at:**
- **Client**: http://localhost:5173
- **Server**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

## 🧪 Testing with Multiple Users

1. Open `http://localhost:5173` in **two or more browser windows**
2. Draw in one window → see it appear immediately in other windows
3. Test global undo: Draw in Window A, then press Ctrl+Z in Window B
4. Test rooms: Click "New Room" and share the URL

## 🏠 Room Collaboration

### Creating a Room
1. Click "Create Room" button in the toolbar
2. A unique room ID is generated
3. Share the URL with collaborators

### Joining a Room
- **Via URL**: Open a shared link (e.g., `http://localhost:5173?room=ABC123`)
- **Via ID**: Enter the room ID in the input field and click "Join"

### Sharing
- Click "Copy Link" to copy the room URL to clipboard
- Each room has completely isolated canvas state

## 📁 Project Structure

```
collaborative-canvas/
├── client/
│   ├── src/
│   │   ├── main.ts         # App orchestrator
│   │   ├── canvas.ts       # Drawing engine (raw Canvas API)
│   │   ├── ui.ts           # Toolbar management
│   │   ├── websocket.ts    # Socket.io client
│   │   └── utils.ts        # Utilities
│   ├── index.html
│   └── style.css
├── server/
│   ├── server.ts           # Express + Socket.io server
│   ├── rooms.ts            # Room management logic
│   ├── drawing-state.ts    # Canvas state management
│   └── production.ts       # Production bundle
├── shared/
│   └── types.ts            # TypeScript interfaces
├── package.json
├── README.md
├── ARCHITECTURE.md         # Technical documentation
├── Dockerfile
└── docker-compose.yml
```

## ✨ Features

### Phase 1 ✅ Complete
- [x] Full-screen canvas with DPR scaling
- [x] Smooth line drawing (lineCap='round', lineJoin='round')
- [x] Brush & Eraser tools (B/E shortcuts)
- [x] Color picker with 8 preset colors
- [x] Adjustable stroke width (1-50px, [ / ] shortcuts)
- [x] Local undo/redo stack
- [x] Keyboard shortcuts (Ctrl+Z, Ctrl+Y, Delete)

### Phase 2 ✅ Complete
- [x] Socket.io WebSocket integration
- [x] Real-time stroke synchronization
- [x] Multi-user support with unique usernames/colors
- [x] Ghost cursors showing other users
- [x] Users list panel
- [x] Full canvas state sync on join

### Phase 3 ✅ Complete
- [x] Connection state management (5 states)
- [x] Auto-reconnection with exponential backoff
- [x] Connection status UI indicator
- [x] Offline stroke queuing
- [x] Server-side input validation
- [x] Line smoothing algorithm

### Phase 4 ✅ Complete
- [x] Multi-stage Dockerfile (~50MB image)
- [x] Docker Compose configuration
- [x] Production server (esbuild bundled)
- [x] Environment configuration
- [x] Health check endpoint
- [x] Comprehensive documentation

### Phase 5 ✅ Complete
- [x] Shape tools (rectangle, circle, line) with R/C/L shortcuts
- [x] Shape preview while drawing
- [x] Fill toggle for shapes (F shortcut)
- [x] Text tool with click-to-place (T shortcut)
- [x] Export to PNG
- [x] Export to SVG
- [x] Room-based collaboration
- [x] Create/join rooms by ID
- [x] URL-based room sharing
- [x] Per-room canvas state
- [x] **FPS/Latency display** (real-time performance metrics)

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| B | Brush tool |
| E | Eraser tool |
| R | Rectangle tool |
| C | Circle tool |
| L | Line tool |
| T | Text tool |
| F | Toggle fill |
| Ctrl+Z | Undo (global) |
| Ctrl+Y / Ctrl+Shift+Z | Redo (global) |
| [ | Decrease stroke width |
| ] | Increase stroke width |

## 🛠️ Tech Stack

- **Frontend**: TypeScript, HTML5 Canvas API (raw, no libraries), CSS3
- **Backend**: Node.js, Express.js, Socket.io
- **Build**: Vite, esbuild
- **Deployment**: Docker, docker-compose

## ⚠️ Known Limitations

1. **No Persistence**: Drawings are stored in memory only; server restart clears all data
2. **No Authentication**: Users are anonymous with auto-generated names
3. **Browser Support**: Tested on Chrome, Firefox, Safari (modern versions)
4. **Mobile**: Touch support works but optimized for desktop

## ⏱️ Time Spent

| Phase | Time |
|-------|------|
| Phase 1: Basic Canvas | 2-3 hours |
| Phase 2: WebSocket Sync | 3-4 hours |
| Phase 3: Error Handling | 2-3 hours |
| Phase 4: Docker/Production | 2 hours |
| Phase 5: Advanced Features | 3-4 hours |
| Documentation | 1-2 hours |
| **Total** | **~15 hours** |

## �️ Detailed Setup Instructions

### Prerequisites

- **Node.js** v20.x or higher
- **npm** v9.x or higher
- **Docker** & **Docker Compose** (for production deployment)

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd collaborative-canvas
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development servers**
   ```bash
   npm run dev
   ```
   This starts both the client (Vite) and server (Node.js) concurrently:
   - **Client**: http://localhost:5173 (Vite dev server with HMR)
   - **Server**: http://localhost:3000 (Express + Socket.io)
   - **Health Check**: http://localhost:3000/health

4. **Test multi-user collaboration**
   - Open http://localhost:5173 in 2+ browser windows
   - Draw in one window → see it sync instantly in others
   - Check the FPS/Latency display in the top-left corner

### Production Setup (Docker)

1. **Build and run with Docker Compose** (Recommended)
   ```bash
   docker compose up --build
   ```
   The app will be available at http://localhost:3000

2. **Or build manually with Docker**
   ```bash
   # Build the image
   docker build -t collaborative-canvas .

   # Run the container
   docker run -p 3000:3000 collaborative-canvas
   ```

3. **Verify deployment**
   - Open http://localhost:3000 in your browser
   - Check health: http://localhost:3000/health
   - Expected response: `{"status":"healthy","connections":0,"rooms":0,...}`

### Available npm Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start client + server in development mode |
| `npm run dev:client` | Start only the Vite client |
| `npm run dev:server` | Start only the Node.js server |
| `npm run build` | Build both client and server for production |
| `npm run build:client` | Build client only |
| `npm run build:server` | Build server only |
| `npm run start` | Start production server (after build) |
| `npm run preview` | Preview production build locally |

### Environment Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | development | Environment mode |

### Troubleshooting

**Port 3000 already in use:**
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <pid> /F

# Linux/Mac
lsof -i :3000
kill -9 <pid>
```

**Docker build fails:**
```bash
# Remove old containers and rebuild
docker compose down
docker compose up --build --force-recreate
```

**WebSocket connection fails:**
- Ensure server is running on port 3000
- Check browser console for errors
- Verify no firewall blocking WebSocket connections

## 🐳 Docker Architecture

The Docker setup uses a multi-stage build for minimal image size (~50MB):

```dockerfile
# Stage 1: Build environment (node:20-alpine)
# - Install dependencies
# - Build client (Vite) and server (esbuild)

# Stage 2: Production runtime
# - Copy only built artifacts
# - No dev dependencies
```

**Docker Compose features:**
- Health check every 30s
- Auto-restart on failure
- Port 3000 exposed

## ✅ Feature Verification (Dev & Prod)

Both development (`server.ts`) and production (`production.ts`) servers support:

| Feature | Dev Server | Prod Server |
|---------|------------|-------------|
| Real-time strokes | ✅ | ✅ |
| Shape tools (rect/circle/line) | ✅ | ✅ |
| Text tool | ✅ | ✅ |
| Room collaboration | ✅ | ✅ |
| Global undo/redo | ✅ | ✅ |
| Ghost cursors | ✅ | ✅ |
| Users list | ✅ | ✅ |
| Ping/Pong latency | ✅ | ✅ |
| Health endpoint | ✅ | ✅ |

## 📖 Documentation

- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Technical architecture, data flow, WebSocket protocol, undo/redo strategy

## 📄 License

MIT
