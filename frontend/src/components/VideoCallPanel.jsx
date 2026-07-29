import { useEffect, useRef, useState, useCallback } from 'react';
import socket from '../socket/socket';

// Google's public STUN servers - free, and sufficient for helping two peers
// discover their own public IP/port when they're behind a typical home/college
// NAT. This does NOT include a TURN server - see README for what that means.
const ICE_SERVERS = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
};

export default function VideoCallPanel({ roomId, token, userName }) {
  const [inCall, setInCall] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> { stream, name }

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({}); // socketId -> RTCPeerConnection

  const createPeerConnection = useCallback((peerSocketId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Send our local camera/mic tracks to this peer
    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    // When the browser discovers a possible network path, forward it to the
    // peer via the signaling server - this is the core of NAT traversal.
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('video:ice-candidate', { to: peerSocketId, candidate: event.candidate });
      }
    };

    // When the peer's media actually arrives, attach it to that peer's video tile
    pc.ontrack = (event) => {
      setRemoteStreams((prev) => ({
        ...prev,
        [peerSocketId]: { ...(prev[peerSocketId] || {}), stream: event.streams[0] },
      }));
    };

    peerConnectionsRef.current[peerSocketId] = pc;
    return pc;
  }, []);

  const joinCall = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

    setInCall(true);
    socket.emit('video:join', { roomId, token });
  };

  const leaveCall = () => {
    socket.emit('video:leave', { roomId });
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    Object.values(peerConnectionsRef.current).forEach((pc) => pc.close());
    peerConnectionsRef.current = {};
    setRemoteStreams({});
    setInCall(false);
  };

  useEffect(() => {
    // A brand-new joiner is told who's already here, and is responsible for
    // initiating the offer to each of them - this one-directional rule avoids
    // both sides racing to send offers to each other simultaneously.
    const onExistingPeers = async (peers) => {
      for (const peer of peers) {
        const pc = createPeerConnection(peer.socketId);
        setRemoteStreams((prev) => ({ ...prev, [peer.socketId]: { name: peer.name } }));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('video:offer', { to: peer.socketId, offer });
      }
    };

    const onPeerJoined = ({ socketId, name }) => {
      setRemoteStreams((prev) => ({ ...prev, [socketId]: { name } }));
      // We don't initiate here - we wait for their offer (see onExistingPeers)
    };

    const onOffer = async ({ from, offer }) => {
      const pc = createPeerConnection(from);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('video:answer', { to: from, answer });
    };

    const onAnswer = async ({ from, answer }) => {
      const pc = peerConnectionsRef.current[from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    };

    const onIceCandidate = async ({ from, candidate }) => {
      const pc = peerConnectionsRef.current[from];
      if (pc && candidate) await pc.addIceCandidate(new RTCIceCandidate(candidate));
    };

    const onPeerLeft = ({ socketId }) => {
      peerConnectionsRef.current[socketId]?.close();
      delete peerConnectionsRef.current[socketId];
      setRemoteStreams((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    socket.on('video:existing-peers', onExistingPeers);
    socket.on('video:peer-joined', onPeerJoined);
    socket.on('video:offer', onOffer);
    socket.on('video:answer', onAnswer);
    socket.on('video:ice-candidate', onIceCandidate);
    socket.on('video:peer-left', onPeerLeft);

    return () => {
      socket.off('video:existing-peers', onExistingPeers);
      socket.off('video:peer-joined', onPeerJoined);
      socket.off('video:offer', onOffer);
      socket.off('video:answer', onAnswer);
      socket.off('video:ice-candidate', onIceCandidate);
      socket.off('video:peer-left', onPeerLeft);
    };
  }, [createPeerConnection]);

  // Clean up media/connections if the component unmounts while still in a call
  useEffect(() => {
    return () => {
      if (inCall) leaveCall();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="video-panel">
      <div className="video-header">
        <h4>Video Call</h4>
        {!inCall ? (
          <button className="join-call-btn" onClick={joinCall}>📹 Join Call</button>
        ) : (
          <button className="leave-call-btn" onClick={leaveCall}>Leave Call</button>
        )}
      </div>

      {inCall && (
        <div className="video-grid">
          <div className="video-tile">
            <video ref={localVideoRef} autoPlay muted playsInline />
            <span className="video-label">{userName} (You)</span>
          </div>
          {Object.entries(remoteStreams).map(([socketId, { stream, name }]) => (
            <RemoteVideoTile key={socketId} stream={stream} name={name} />
          ))}
        </div>
      )}
    </div>
  );
}

function RemoteVideoTile({ stream, name }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream;
  }, [stream]);

  return (
    <div className="video-tile">
      <video ref={videoRef} autoPlay playsInline />
      <span className="video-label">{name || 'Connecting...'}</span>
    </div>
  );
}
