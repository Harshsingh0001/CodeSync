import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const [rooms, setRooms] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const { data } = await api.get('/rooms');
      setRooms(data);
    } catch (err) {
      console.error('Failed to load rooms', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    const { data } = await api.post('/rooms', { title: newTitle || 'Untitled Session' });
    navigate(`/room/${data.roomId}`);
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    navigate(`/room/${joinCode.trim()}`);
  };

  return (
    <div>
      <nav className="navbar">
        <h2>CodeSync</h2>
        <div className="user-info">
          <span>Hi, {user?.name}</span>
          <button onClick={logout}>Log out</button>
        </div>
      </nav>

      <div className="dashboard">
        <div className="dashboard-grid">
          <form className="panel" onSubmit={handleCreateRoom}>
            <h3>Start a new session</h3>
            <input
              type="text"
              placeholder="Session name (e.g. DSA Practice)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <button type="submit">Create Session</button>
          </form>

          <form className="panel" onSubmit={handleJoinRoom}>
            <h3>Join an existing session</h3>
            <input
              type="text"
              placeholder="Paste room code (e.g. a1b2c3d4)"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
            />
            <button type="submit">Join Session</button>
          </form>
        </div>

        <h1 style={{ marginTop: '2rem' }}>Your Sessions</h1>
        {loading ? (
          <p>Loading...</p>
        ) : rooms.length === 0 ? (
          <p>No sessions yet. Create one above to get started.</p>
        ) : (
          <div className="room-grid">
            {rooms.map((room) => (
              <Link key={room._id} to={`/room/${room.roomId}`} className="room-card">
                <strong>{room.title}</strong>
                <span className="room-code">Code: {room.roomId}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
