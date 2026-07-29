import { useState, useRef, useEffect } from 'react';

export default function ChatPanel({ messages, onSend }) {
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };

  return (
    <div className="chat-panel">
      <h4>Session Chat</h4>
      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className="chat-message">
            <strong>{m.senderName}:</strong> {m.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input-row" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Message your collaborators..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
