import { io } from 'socket.io-client';

// A single shared socket instance for the whole app. We connect lazily
// (autoConnect: false) so we control exactly when the connection opens -
// specifically, once the user has actually loaded a room page.
const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000', {
  autoConnect: false,
});

export default socket;
