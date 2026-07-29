export default function PresenceBar({ users, roomCode }) {
  const copyCode = () => {
    navigator.clipboard.writeText(roomCode);
  };

  return (
    <div className="presence-bar">
      <div className="room-code-chip" onClick={copyCode} title="Click to copy">
        Room: {roomCode} 📋
      </div>
      <div className="avatars">
        {users.map((u) => (
          <div key={u.socketId} className="avatar" style={{ background: u.color }} title={u.name}>
            {u.name.charAt(0).toUpperCase()}
          </div>
        ))}
        <span className="online-count">{users.length} online</span>
      </div>
    </div>
  );
}
