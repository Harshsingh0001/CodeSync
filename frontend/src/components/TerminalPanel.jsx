import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import socket from '../socket/socket';

export default function TerminalPanel({ roomId, token, visible }) {
  const containerRef = useRef(null);
  const termRef = useRef(null);
  const fitAddonRef = useRef(null);

  // Set up the terminal once on mount
  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'Consolas, Monaco, monospace',
      theme: { background: '#1e1e1e', foreground: '#d4d4d4' },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    socket.emit('terminal:join', { roomId, token });

    const onOutput = (data) => term.write(data);
    const onError = ({ message }) => term.write(`\r\n\x1b[31m${message}\x1b[0m\r\n`);
    socket.on('terminal:output', onOutput);
    socket.on('terminal:error', onError);

    // Every keystroke goes straight to the shared shell on the backend
    term.onData((data) => {
      socket.emit('terminal:input', { roomId, data });
    });

    const handleResize = () => {
      fitAddon.fit();
      socket.emit('terminal:resize', { roomId, cols: term.cols, rows: term.rows });
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      socket.off('terminal:output', onOutput);
      socket.off('terminal:error', onError);
      term.dispose();
    };
  }, [roomId, token]);

  // Re-fit whenever the panel is toggled visible (xterm needs a layout pass
  // to size correctly, which doesn't happen while its container is hidden)
  useEffect(() => {
    if (visible && fitAddonRef.current) {
      setTimeout(() => fitAddonRef.current.fit(), 0);
    }
  }, [visible]);

  return <div ref={containerRef} className="terminal-container" style={{ display: visible ? 'block' : 'none' }} />;
}
