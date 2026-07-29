# CodeSync – Real-Time Collaborative Code Editor

CodeSync is a collaborative code editor inspired by tools like Replit and Google Docs for code. It allows multiple users to work together in the same coding session with live code synchronization, integrated chat, shared terminal access, video calling, and basic code execution.

The project focuses on solving real-time collaboration problems using Socket.IO and WebRTC rather than building a complete online IDE.

---

## Features

### Real-Time Collaboration
- Create and join coding sessions using a unique room code
- Live code synchronization across all connected users
- Presence indicators showing active collaborators
- Session-based real-time chat
- Automatic code persistence to MongoDB

### Authentication
- User registration and login
- JWT-based authentication
- Password hashing using bcrypt

### Code Execution
- Execute JavaScript and Python code
- Shared output visible to all collaborators
- Execution timeout to prevent infinite loops
- Output size limiting and rate limiting

### Shared Terminal
- Interactive terminal powered by node-pty
- Shared terminal state across all users in a room
- Scrollback history for newly joined participants

### Video Calling
- Peer-to-peer video and audio using WebRTC
- Signaling handled through Socket.IO
- Camera and microphone sharing within a coding session

---

## Tech Stack

### Frontend
- React (Vite)
- Monaco Editor
- Socket.IO Client
- React Router
- Xterm.js

### Backend
- Node.js
- Express.js
- Socket.IO
- MongoDB
- Mongoose
- JWT
- bcryptjs
- node-pty

---

## Project Structure

```
codesync/
├── backend/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── socket/
│   └── server.js
│
└── frontend/
    └── src/
        ├── components/
        ├── context/
        ├── pages/
        └── socket/
```

---

## Running the Project

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Configure the following environment variables:

- MONGO_URI
- JWT_SECRET

For code execution, Node.js and Python should be installed and available in your system PATH.

---

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open two browser windows, log in with different users, create a room, and join it from another browser to test live collaboration.

---

## How It Works

### Live Code Sync

Whenever a user edits the code, changes are broadcast to other participants using Socket.IO. Incoming updates are handled carefully to prevent infinite synchronization loops, while database writes are debounced to reduce unnecessary MongoDB operations.

### Code Execution

When the Run button is clicked, the backend creates a temporary execution environment, runs the selected program, captures the output, applies execution limits, and broadcasts the result to every collaborator in the room.

### Shared Terminal

Each room has its own terminal session managed with node-pty. Commands entered by any participant are executed in the same terminal, allowing collaborators to share one working environment.

### Video Calling

Video communication is implemented using WebRTC. Socket.IO is only used for signaling, while audio and video streams are exchanged directly between connected peers.

---

## Current Limitations

- Code execution currently supports JavaScript and Python.
- The execution environment is intended for local development and demonstration purposes, not public deployment.
- Shared terminals are not container isolated and should only be used in trusted environments.
- Video calls rely on public STUN servers and may not work on all network configurations without a TURN server.

---

## Future Improvements

- Support additional programming languages
- Docker-based isolated code execution
- File explorer with multi-file projects
- Persistent project workspace
- Collaborative debugging
- Integrated Git support
- Role-based permissions for project members

---

## Learning Outcomes

This project helped me gain practical experience with:

- Real-time communication using Socket.IO
- WebRTC signaling and peer connections
- JWT authentication
- Process management with child processes
- Interactive terminals using node-pty
- Monaco Editor integration
- Building scalable full-stack MERN applications

---

## License

This project is available for learning and personal use.