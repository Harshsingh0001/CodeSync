import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import api from '../api/axios';
import socket from '../socket/socket';
import { useAuth } from '../context/AuthContext';
import PresenceBar from '../components/PresenceBar';
import ChatPanel from '../components/ChatPanel';
import OutputPanel from '../components/OutputPanel';
import TerminalPanel from '../components/TerminalPanel';
import VideoCallPanel from '../components/VideoCallPanel';

const LANGUAGES = ['javascript', 'python', 'java', 'cpp', 'typescript', 'html', 'css'];

// Only these languages actually have a backend runner (services/codeExecutor.js).
// Others are still selectable for syntax highlighting, but Run is disabled for them.
const EXECUTABLE_LANGUAGES = ['javascript', 'python'];

export default function RoomPage() {
  const { roomId } = useParams();
  const { getToken, user } = useAuth();

  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('javascript');
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [output, setOutput] = useState(null);
  const [running, setRunning] = useState(false);
  const [bottomPanel, setBottomPanel] = useState('output'); // 'output' | 'terminal'

  // Guards against feedback loops: when we apply a code update that came
  // FROM the socket, we don't want that change to be re-broadcast as if
  // the local user typed it.
  const isRemoteChange = useRef(false);
  const editorRef = useRef(null);

  // --- Load initial room state from the REST API, then open the socket ---
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      try {
        const { data } = await api.get(`/rooms/${roomId}`);
        if (!isMounted) return;
        setCode(data.room.code);
        setLanguage(data.room.language);
        setMessages(data.messages);
      } catch (err) {
        if (isMounted) setNotFound(true);
        return;
      } finally {
        if (isMounted) setLoading(false);
      }

      socket.connect();
      socket.emit('join-room', { roomId, token: getToken() });
    };

    init();

    // --- Socket event listeners ---
    const onRoomState = ({ code: initialCode, users: initialUsers }) => {
      isRemoteChange.current = true;
      setCode(initialCode);
      setUsers(initialUsers);
    };
    const onCodeUpdate = ({ code: newCode }) => {
      isRemoteChange.current = true;
      setCode(newCode);
    };
    const onUserJoined = ({ users: updatedUsers }) => setUsers(updatedUsers);
    const onUserLeft = ({ users: updatedUsers }) => setUsers(updatedUsers);
    const onNewMessage = (msg) => setMessages((prev) => [...prev, msg]);
    const onLanguageUpdate = ({ language: newLang }) => setLanguage(newLang);
    const onRunOutput = ({ output: remoteOutput, ranBy }) => setOutput({ ...remoteOutput, ranBy });

    socket.on('room-state', onRoomState);
    socket.on('code-update', onCodeUpdate);
    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);
    socket.on('new-message', onNewMessage);
    socket.on('language-update', onLanguageUpdate);
    socket.on('run-output', onRunOutput);

    return () => {
      isMounted = false;
      socket.off('room-state', onRoomState);
      socket.off('code-update', onCodeUpdate);
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
      socket.off('new-message', onNewMessage);
      socket.off('language-update', onLanguageUpdate);
      socket.off('run-output', onRunOutput);
      socket.disconnect();
    };
  }, [roomId]);

  // --- Local user typed in the editor ---
  const handleEditorChange = (value) => {
    if (isRemoteChange.current) {
      // This change came from a remote update being applied - don't re-broadcast it
      isRemoteChange.current = false;
      setCode(value);
      return;
    }
    setCode(value);
    socket.emit('code-change', { roomId, code: value });
  };

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    socket.emit('language-change', { roomId, language: newLang });
  };

  const handleSendMessage = (text) => {
    socket.emit('send-message', { roomId, text });
  };

  const handleRun = async () => {
    if (!EXECUTABLE_LANGUAGES.includes(language)) {
      setOutput({ stderr: `Running "${language}" isn't supported yet - only JavaScript and Python can execute right now.` });
      return;
    }
    setRunning(true);
    setOutput(null);
    try {
      const { data } = await api.post('/execute', { language, code });
      const result = { ...data, ranBy: 'You' };
      setOutput(result);
      // Let everyone else in the room see this run's output too
      socket.emit('broadcast-output', { roomId, output: data, ranBy: 'a collaborator' });
    } catch (err) {
      setOutput({ stderr: err.response?.data?.message || 'Failed to run code' });
    } finally {
      setRunning(false);
    }
  };

  if (loading) return <p style={{ padding: '2rem' }}>Loading session...</p>;
  if (notFound) return <p style={{ padding: '2rem' }}>Room not found. Check the code and try again.</p>;

  return (
    <div className="room-page">
      <div className="room-topbar">
        <Link to="/">&larr; Dashboard</Link>
        <select value={language} onChange={handleLanguageChange}>
          {LANGUAGES.map((lang) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>
        <PresenceBar users={users} roomCode={roomId} />
      </div>

      <div className="room-body">
        <div className="editor-column">
          <div className="editor-wrapper">
            <Editor
              height="100%"
              language={language}
              value={code}
              onChange={handleEditorChange}
              onMount={(editor) => (editorRef.current = editor)}
              theme="vs-dark"
              options={{ fontSize: 14, minimap: { enabled: false }, automaticLayout: true }}
            />
          </div>
          <div className="bottom-panel-tabs">
            <button
              className={bottomPanel === 'output' ? 'tab active' : 'tab'}
              onClick={() => setBottomPanel('output')}
            >
              Output
            </button>
            <button
              className={bottomPanel === 'terminal' ? 'tab active' : 'tab'}
              onClick={() => setBottomPanel('terminal')}
            >
              Terminal
            </button>
          </div>
          <div style={{ display: bottomPanel === 'output' ? 'flex' : 'none', flex: 1, minHeight: 0 }}>
            <OutputPanel output={output} running={running} onRun={handleRun} />
          </div>
          {/* Terminal stays mounted even when hidden, so the shell session and
              its socket connection aren't torn down every time you switch tabs */}
          <div style={{ display: bottomPanel === 'terminal' ? 'block' : 'none', height: 220 }}>
            <TerminalPanel roomId={roomId} token={getToken()} visible={bottomPanel === 'terminal'} />
          </div>
        </div>
        <div className="sidebar-column">
          <VideoCallPanel roomId={roomId} token={getToken()} userName={user?.name} />
          <ChatPanel messages={messages} onSend={handleSendMessage} />
        </div>
      </div>
    </div>
  );
}
