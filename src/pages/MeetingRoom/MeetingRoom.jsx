import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { 
  Copy, Check, PhoneOff, Users, MessageSquare, X, Send, Paperclip, FileText, ExternalLink, Smile, Download, Bold, Italic, Palette, Underline as UnderlineIcon,
  Volume2, VolumeX, CornerUpLeft, ArrowDown, CheckCheck, Crown, Shield,
  Type, Hand, Mic, MicOff, Video, VideoOff, Circle, Square, MoreVertical
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  ControlBar,
  useTracks,
  LayoutContextProvider,
  useLayoutContext,
  useChat,
  useLocalParticipant,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  LiveKitRoom,
  useRoomContext,
} from "@livekit/components-react";
import { Track, setLogLevel } from 'livekit-client';
setLogLevel('silent');
import "@livekit/components-styles";
import { toast } from 'sonner';
import EmojiPicker from 'emoji-picker-react';
import './MeetingRoom.css';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || "wss://miradioip-yposn36u.livekit.cloud";
import { getApiUrl } from '../../context/AuthContext';

function MeetingRoom() {
  const navigate = useNavigate();
  const { meetingId } = useParams();
  const location = useLocation();
  
  // Get token and options from PreLobby
  const { token, isMicOn, isCameraOn, name, isHost } = location.state || {};
  const { authFetch } = useAuth();
  
  const [isCopied, setIsCopied] = useState(false);
  const [isMeetingEnded, setIsMeetingEnded] = useState(false);
  const [endedSummary, setEndedSummary] = useState(null);
  const startTimeRef = useRef(Date.now());

  // If no token, redirect back to lobby
  useEffect(() => {
    if (!token) {
      toast.error("Sesión no válida o token expirado.");
      navigate(`/pre-lobby/${meetingId}`);
    }
  }, [token, navigate, meetingId]);

  const copyMeetingLink = () => {
    const link = `${window.location.origin}/pre-lobby/${meetingId}`;
    navigator.clipboard.writeText(link);
    setIsCopied(true);
    toast.success("Enlace copiado");
    setTimeout(() => setIsCopied(false), 2000);
  };

  const [isExiting, setIsExiting] = useState(false);

  // ... (existing code)

  // ... (previous state declarations)

  const onDisconnected = () => {
     // This event is triggered when the room is disconnected (manually or by error)
     if (!isMeetingEnded) {
       const duration = Date.now() - startTimeRef.current;
       setEndedSummary({ duration, participantCount: '?' });
       setIsMeetingEnded(true);
     }
  };

  const endMeeting = async () => {
    // This function is now passed to MeetingContent to be called BEFORE disconnect
    // actually, we will move the 'cleaning' logic to after disconnect or concurrent
    
    try {
      // 1. Avisar al backend para limpieza remota
      // We do this first to ensure the backend knows, even if local connection drops
      await authFetch('/meetings/end', {
        method: 'POST',
        body: JSON.stringify({ link: meetingId })
      });
      toast.success("Reunión finalizada");
    } catch (err) {
      console.error("Error ending meeting:", err);
    }
  };

  if (!token) return null;

  return (
    <div className="active-meeting-container">
      {!isMeetingEnded ? (
        <LiveKitRoom
          video={isCameraOn}
          audio={isMicOn}
          token={token} // Use original token, don't clear it reactively here
          serverUrl={LIVEKIT_URL}
          connectOptions={{
            autoSubscribe: true,
            publishDefaults: {
              dtlsRetries: 10,
              // @ts-ignore
              publishTimeout: 30000, // Aumentado a 30s para mitigar timeouts de publicación
            },
            adaptiveStream: true,
            dynacast: true,
          }}
          data-lk-theme="default"
          style={{ height: "100vh" }}
          onDisconnected={onDisconnected}
          onError={(error) => {
             // Ignore specific connection state mismatch errors or closed pc during disconnection
             const msg = error?.message?.toLowerCase() || '';
             if (
               msg.includes('connection state mismatch') || 
               msg.includes('peer connection') || 
               msg.includes('closed') || 
               msg.includes('createoffer') ||
               msg.includes('datachannel')
             ) {
               console.warn("Handled LiveKit background disconnect signal:", error.message);
               return;
             }
             console.error("LiveKit Error:", error);
             toast.error(`Error: ${error.message || 'Error desconocido'}`);
          }}
        >
          <RoomAudioRenderer />
          <MeetingContent 
            meetingId={meetingId} 
            copyMeetingLink={copyMeetingLink} 
            onEndMeetingAction={endMeeting}
            isHost={isHost}
            isCopied={isCopied}
          />
        </LiveKitRoom>
      ) : (
        <MeetingEndedScreen 
          summary={endedSummary} 
          onGoHome={() => navigate('/')} 
          onRejoin={() => window.location.reload()} 
        />
      )}
    </div>
  );
}

const playNotificationSound = async () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // 🔥 Fix for AudioContext autoplay policy
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (e) {
        console.warn("Could not resume AudioContext:", e);
        return; // Silent fail if not allowed
      }
    }
    
    // Creating a more "pop/ding" natural sound instead of a simple beep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    // Frequency sweep for a more natural "pop"
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);

    // Auto-close context after short delay
    setTimeout(() => ctx.close(), 200);
  } catch (error) {
    console.warn("Audio signal failed:", error);
  }
};

function MeetingContent({ meetingId, copyMeetingLink, onEndMeetingAction, isHost, isCopied }) {
  const [showChat, setShowChat] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [raisedHands, setRaisedHands] = useState({});
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [isCaptionsOn, setIsCaptionsOn] = useState(false);
  const [activeCaptions, setActiveCaptions] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  
  const recognitionRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const recordingStreamRef = useRef(null);
  const { chatMessages, send } = useChat();
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();
  const { user, memberships } = useAuth(); // Get auth info
  
  const [isOrgCopied, setIsOrgCopied] = useState(false);

  // Logic for displaying Org Code
  const currentOrg = memberships.find(m => m.id === user?.organization_id);
  const isOrgAdmin = currentOrg?.role === 'admin';
  const orgJoinCode = currentOrg?.join_code;
  const canShowOrgCode = isHost && isOrgAdmin && orgJoinCode;

  const copyOrgCode = () => {
    if (orgJoinCode) {
      navigator.clipboard.writeText(orgJoinCode);
      setIsOrgCopied(true);
      toast.success("Código de organización copiado");
      setTimeout(() => setIsOrgCopied(false), 2000);
    }
  };
  
  // --- RECORDING LOGIC ---
  const startRecording = async () => {
    try {
      toast.info("Para grabar la reunión, elige 'Esta pestaña' (o 'Microsoft Edge Tab') y marca la casilla 'Compartir audio'", {
        duration: 6000,
        position: 'top-center'
      });

      // 1. Capture stream with system audio
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          displaySurface: "browser"
        },
        audio: true, // Simplificado para mejor soporte
        // @ts-ignore
        preferCurrentTab: true,
        selfBrowserSurface: 'include',
        systemAudio: 'include'
      });

      recordingStreamRef.current = stream;
      chunksRef.current = [];

      // 2. Setup MediaRecorder
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm';
      }

      const recorder = new MediaRecorder(stream, options);
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        await saveRecording(blob);
        // Clean up stream tracks
        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      };

      recorderRef.current = recorder;
      recorder.start(1000); // Save chunks every second
      setIsRecording(true);
      toast.success("Grabación iniciada. Asegúrate de compartir el audio de la pestaña.");
      
      // Stop recording if the user stops sharing via browser UI
      stream.getVideoTracks()[0].onended = () => {
        if (recorderRef.current?.state === 'recording') {
          recorderRef.current.stop();
        }
      };

    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        console.error("Error starting recording:", err);
        toast.error("No se pudo iniciar la grabación: " + err.message);
      }
    }
  };

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  };

  const saveRecording = async (blob) => {
    try {
      // Check if File System Access API is supported
      if ('showSaveFilePicker' in window) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `reunion-${meetingId}-${new Date().toISOString().slice(0,10)}.webm`,
          types: [{
            description: 'Video WebM',
            accept: { 'video/webm': ['.webm'] },
          }],
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        toast.success("Grabación guardada correctamente");
      } else {
        // Fallback for older browsers
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `reunion-${meetingId}.webm`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
        }, 100);
        toast.success("Descarga de grabación iniciada");
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error("Error saving recording:", err);
        toast.error("Error al guardar la grabación");
      }
    }
  };

  const handleEndMeeting = async () => {
    if (!window.confirm("¿Estás seguro de que quieres finalizar la reunión para todos?")) {
      return;
    }
    
    // 0. Stop local activities that use data channels
    stopTranscription();
    
    // 1. Call backend to invalidate meeting and wait for it
    if (onEndMeetingAction) {
       try {
         await onEndMeetingAction();
       } catch (e) {
         console.warn("Backend end meeting failed, proceeding with local disconnect", e);
       }
    }

    // 2. Disconnect from LiveKit room
    if (room) {
      try {
        await room.disconnect();
      } catch (e) {
        console.warn("Local disconnect warning:", e);
      }
    }
  };

  const handleLeave = async () => {
      stopTranscription();
      if (room) {
          try {
            await room.disconnect();
          } catch (e) {
             console.warn("Local leave disconnect warning:", e);
          }
      }
  };


  const triggerFloatingReaction = (identity, emoji) => {
    const id = Date.now() + Math.random();
    setFloatingReactions(prev => [...prev, { id, identity, emoji }]);
    
    // Remove after animation finish (3.5s)
    setTimeout(() => {
      setFloatingReactions(prev => prev.filter(r => r.id !== id));
    }, 3500);
  };

  // --- TRANSCRIPTION LOGIC ---
  useEffect(() => {
    if (isCaptionsOn) {
      startTranscription();
    } else {
      stopTranscription();
    }
    return () => stopTranscription();
  }, [isCaptionsOn]);

  const startTranscription = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Tu navegador no soporta el reconocimiento de voz.");
      setIsCaptionsOn(false);
      return;
    }

    if (recognitionRef.current) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'es-ES';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
        // Send to others ONLY if connected
        if (room.state === 'connected') {
          try {
            const payload = JSON.stringify({ type: 'transcription', text: finalTranscript });
            const encoder = new TextEncoder();
            room.localParticipant.publishData(encoder.encode(payload), { reliable: true }).catch(err => {
              // Ignore typical disconnection errors
              if (!err.message?.includes('Abort') && !err.message?.includes('closed')) {
                console.warn("Transcription publish error:", err);
              }
            });
          } catch (e) {
            console.error("Error formatting transcription:", e);
          }
        }

        // Update locally
        setActiveCaptions(prev => ({
          ...prev,
          [localParticipant.identity]: { text: finalTranscript, timestamp: Date.now() }
        }));
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech Recognition Error:", event.error);
      if (event.error === 'not-allowed') {
        toast.error("Permiso de micrófono denegado para subtítulos.");
        setIsCaptionsOn(false);
      }
    };

    recognition.onend = () => {
      if (isCaptionsOn) {
        recognition.start(); // Keep it alive
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    toast.info("Subtítulos activados");
  };

  const stopTranscription = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setActiveCaptions({});
  };
  
  // Track unread messages when chat is closed and play sound for incoming messages
  useEffect(() => {
    if (chatMessages.length === 0) return;
    
    const lastMsg = chatMessages[chatMessages.length - 1];
    const isIncoming = !lastMsg.from?.isLocal;

    if (isIncoming) {
      if (!isMuted) {
        playNotificationSound();
      }
      if (!showChat) {
        setUnreadCount(prev => prev + 1);
      }
    }
  }, [chatMessages.length, isMuted, showChat]);

  // Reset count when chat is opened
  useEffect(() => {
    if (showChat) {
      setUnreadCount(0);
    }
  }, [showChat]);

  // Toggle raise hand
  const toggleRaiseHand = () => {
    const newState = !isHandRaised;
    setIsHandRaised(newState);
    
    // Update local state
    setRaisedHands(prev => ({
      ...prev,
      [localParticipant.identity]: newState
    }));
    
    // Broadcast to other participants ONLY if connected
    if (room.state === 'connected') {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(JSON.stringify({ 
          type: 'raiseHand', 
          isRaised: newState 
        }));
        localParticipant.publishData(data, { reliable: true }).catch(err => {
          if (!err.message?.includes('Abort') && !err.message?.includes('closed')) {
            console.warn("Hand raise publish error:", err);
          }
        });
      } catch (e) {
        console.error("Error broadcasting hand raise:", e);
      }
    }
  };

  // Listen for hand raise events from other participants
  useEffect(() => {
    const handleData = (payload, participant) => {
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));
        if (data.type === 'raiseHand') {
          setRaisedHands(prev => ({
            ...prev,
            [participant.identity]: data.isRaised
          }));
        } else if (data.type === 'hostMuteCommand' && data.targetIdentity === localParticipant.identity) {
          // Host is commanding this participant to mute
          const audioTrack = localParticipant.getTrackPublication(Track.Source.Microphone);
          if (audioTrack && !audioTrack.isMuted) {
            // Use setMicrophoneEnabled to allow user to unmute later
            room.localParticipant.setMicrophoneEnabled(false);
            toast.info('El anfitrión ha silenciado tu micrófono');
          }
        } else if (data.type === 'hostUnmuteCommand' && data.targetIdentity === localParticipant.identity) {
          // Host is commanding this participant to unmute
          const audioTrack = localParticipant.getTrackPublication(Track.Source.Microphone);
          if (audioTrack && audioTrack.isMuted) {
            room.localParticipant.setMicrophoneEnabled(true);
            toast.info('El anfitrión ha activado tu micrófono');
          }
        } else if (data.type === 'hostCameraOffCommand' && data.targetIdentity === localParticipant.identity) {
          // Host is commanding this participant to turn off camera
          const videoTrack = localParticipant.getTrackPublication(Track.Source.Camera);
          if (videoTrack && !videoTrack.isMuted) {
            room.localParticipant.setCameraEnabled(false);
            toast.info('El anfitrión ha desactivado tu cámara');
          }
        } else if (data.type === 'hostCameraOnCommand' && data.targetIdentity === localParticipant.identity) {
          // Host is commanding this participant to turn on camera
          const videoTrack = localParticipant.getTrackPublication(Track.Source.Camera);
          if (videoTrack && videoTrack.isMuted) {
        room.localParticipant.setCameraEnabled(true);
        toast.info('El anfitrión ha activado tu cámara');
      }
    } else if (data.type === 'reaction') {
      const { emoji } = data;
      triggerFloatingReaction(participant.identity, emoji);
    } else if (data.type === 'transcription') {
      const { text } = data;
      setActiveCaptions(prev => ({
        ...prev,
        [participant.identity]: { text, timestamp: Date.now() }
      }));
      
      // Clear caption after 4 seconds of silence from that participant
      const captionTimeout = setTimeout(() => {
        setActiveCaptions(current => {
          if (current[participant.identity]?.timestamp <= Date.now() - 3900) {
            const next = { ...current };
            delete next[participant.identity];
            return next;
          }
          return current;
        });
      }, 4000);
      
      // We can't easily clear this timeout from outside, but the component unmount will handle 
      // the room.off, preventing state updates on unmounted components in React 18/19.
      // However, it's better to track it if we have many participants.
      // For now, let's at least fix the main listeners.
    }
  } catch (e) {
        console.error("Error parsing data:", e);
      }
    };

    const handleParticipantDisconnected = (participant) => {
      // Limpiar manos levantadas
      setRaisedHands(prev => {
        const next = { ...prev };
        delete next[participant.identity];
        return next;
      });
      // Limpiar subtítulos
      setActiveCaptions(prev => {
        const next = { ...prev };
        delete next[participant.identity];
        return next;
      });
    };

    room.on('dataReceived', handleData);
    room.on('participantDisconnected', handleParticipantDisconnected);
    return () => {
      room.off('dataReceived', handleData);
      room.off('participantDisconnected', handleParticipantDisconnected);
    };
  }, [room, localParticipant]); // Solo 'room' como dependencia, localParticipant se accede directamente

  // Host function to toggle mute/unmute a participant
  const toggleParticipantMute = (participantIdentity, shouldMute) => {
    if (!isHost) return;
    
    // Broadcast ONLY if connected
    if (room.state === 'connected') {
      try {
        const encoder = new TextEncoder();
        const commandType = shouldMute ? 'hostMuteCommand' : 'hostUnmuteCommand';
        const data = encoder.encode(JSON.stringify({ 
          type: commandType, 
          targetIdentity: participantIdentity 
        }));
        localParticipant.publishData(data, { reliable: true }).catch(err => {
          // Ignore errors if we are shutting down or if it's an abort error
          const msg = err.message || '';
          if (!msg.includes('Abort') && !msg.includes('closed')) {
            console.warn("Mute/Unmute command publish error:", err);
          }
        });
        toast.success(shouldMute ? 'Comando de silenciar enviado' : 'Comando de activar audio enviado');
      } catch (e) {
        console.error("Error sending mute/unmute command:", e);
      }
    }
  };

  // Host function to toggle camera on/off for a participant
  const toggleParticipantCamera = (participantIdentity, shouldTurnOff) => {
    if (!isHost) return;
    
    // Broadcast ONLY if connected
    if (room.state === 'connected') {
      try {
        const encoder = new TextEncoder();
        const commandType = shouldTurnOff ? 'hostCameraOffCommand' : 'hostCameraOnCommand';
        const data = encoder.encode(JSON.stringify({ 
          type: commandType, 
          targetIdentity: participantIdentity 
        }));
        localParticipant.publishData(data, { reliable: true }).catch(err => {
          const msg = err.message || '';
          if (!msg.includes('Abort') && !msg.includes('closed')) {
            console.warn("Camera toggle command publish error:", err);
          }
        });
        toast.success(shouldTurnOff ? 'Comando de desactivar cámara enviado' : 'Comando de activar cámara enviado');
      } catch (e) {
        console.error("Error sending camera toggle command:", e);
      }
    }
  };

  // Filter tracks to avoid "Element not part of the array" error with placeholders
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  ).filter(track => {
    // Ensure we don't pass broken placeholder tracks that might confuse GridLayout
    // If it's a placeholder (track.publication is undefined or track.track is undefined), make sure proper info exists
    return track.participant && (track.publication || track.source === Track.Source.Camera);
  });

  return (
    <div className="lk-video-conference">
      <div className="lk-video-conference-inner">
        <div className="lk-main-view">
          <GridLayout tracks={tracks}>
            <ParticipantTile />
          </GridLayout>

          {/* Overlay original de info y botón finalizar */}
          <div className="meeting-custom-overlay">
            <div className="meeting-details-left">
              {/* Movido a la barra de controles */}
            </div>

            <div className="meeting-actions-right">
              {/* Espacio reservado o vacío si no hay más acciones aquí */}
            </div>
          </div>

          {/* Raised Hands Overlay */}
          {Object.entries(raisedHands).map(([identity, isRaised], index) => {
            if (!isRaised) return null;
            const participant = room.remoteParticipants.get(identity) || 
                              (localParticipant.identity === identity ? localParticipant : null);
            if (!participant) return null;
            
            return (
              <div 
                key={identity} 
                className="raised-hand-floating-indicator" 
                style={{ top: `${80 + index * 52}px` }}
              >
                <Hand size={24} />
                <span>{participant.name || participant.identity}</span>
              </div>
            );
          })}
        </div>

        {/* CHAT PERSONALIZADO - Ahora flotante y persistente */}
        <CustomChat 
          onClose={() => setShowChat(false)} 
          meetingId={meetingId}
          visible={showChat}
          isMuted={isMuted}
          onToggleMute={() => setIsMuted(prev => !prev)}
          onSendReaction={(emoji) => triggerFloatingReaction(localParticipant.identity, emoji)}
        />

        {/* Participants Panel */}
        {showParticipants && (
          <ParticipantsPanel 
            room={room}
            localParticipant={localParticipant}
            isHost={isHost}
            onClose={() => setShowParticipants(false)}
            onToggleParticipantMute={toggleParticipantMute}
            onToggleParticipantCamera={toggleParticipantCamera}
          />
        )}
      </div>

      <div className="custom-control-bar-wrapper">
        <div className="meeting-info-pill-docked">
          <span className="meeting-id-text">{meetingId}</span>
          <div className="hide-on-mobile">
            <button className="pill-copy-btn" onClick={copyMeetingLink} title="Copiar enlace de reunión">
              {isCopied ? <Check size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />}
            </button>
          </div>
          
          {canShowOrgCode && (
            <>
              <div className="hide-on-mobile" style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.2)', margin: '0 8px' }}></div>
                <span className="meeting-id-text" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ opacity: 0.6, fontSize: '10px', textTransform: 'uppercase' }}>ORG:</span>
                  {orgJoinCode}
                </span>
                <button className="pill-copy-btn" onClick={copyOrgCode} title="Copiar código de organización">
                  {isOrgCopied ? <Check size={16} style={{ color: '#10b981' }} /> : <Copy size={16} />}
                </button>
              </div>
            </>
          )}
        </div>
        <ControlBar 
          variation="minimal" 
          controls={{ chat: false }} 
        />
        <button 
          className="lk-button more-menu-btn"
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          title="Más opciones"
        >
          <MoreVertical size={20} />
        </button>

        {showMoreMenu && (
          <div className="more-menu-dropdown">
            <button 
              className={`lk-button lk-raise-hand-toggle ${isHandRaised ? 'active' : ''}`}
              onClick={() => { toggleRaiseHand(); setShowMoreMenu(false); }}
              title={isHandRaised ? "Bajar la mano" : "Levantar la mano"}
            >
              <Hand size={20} />
              <span>Levantar mano</span>
            </button>
            

            <button 
              className={`lk-button control-btn-cc ${isCaptionsOn ? 'active' : ''}`}
              onClick={() => { setIsCaptionsOn(!isCaptionsOn); setShowMoreMenu(false); }}
              title="Subtítulos"
            >
              <Type size={20} />
              <span>Subtítulos</span>
              {isCaptionsOn && <span className="btn-status-dot"></span>}
            </button>

            {isHost && (
              <button 
                className={`lk-button lk-participants-toggle ${showParticipants ? 'active' : ''}`}
                onClick={() => { setShowParticipants(!showParticipants); setShowMoreMenu(false); }}
                title="Participantes"
              >
                <Users size={20} />
                <span>Participantes</span>
              </button>
            )}

            {/* Mobile-only: move org code actions into the More menu to avoid overlap on small screens */}
            {canShowOrgCode && (
              <button
                className={`lk-button show-on-mobile-only mobile-org-copy`}
                onClick={() => { copyOrgCode(); setShowMoreMenu(false); }}
                title="Copiar código de organización"
              >
                <Copy size={18} />
                <span>Copiar código de organización</span>
              </button>
            )}

            {/* Mobile-only: copy meeting link action placed in More menu */}
            <button
              className={`lk-button show-on-mobile-only mobile-meeting-copy`}
              onClick={() => { copyMeetingLink(); setShowMoreMenu(false); }}
              title="Copiar enlace de reunión"
            >
              <Copy size={18} />
              <span>Copiar enlace de reunión</span>
            </button>

            {isHost && (
              <button 
                className={`lk-button control-btn-record ${isRecording ? 'active' : ''}`}
                onClick={() => { isRecording ? stopRecording() : startRecording(); setShowMoreMenu(false); }}
                title="Grabar"
              >
                {isRecording ? <Square size={20} fill="#ef4444" color="#ef4444" /> : <Circle size={20} />}
                <span>{isRecording ? "Detener grabación" : "Grabar"}</span>
                {isRecording && <span className="recording-dot-pulser"></span>}
              </button>
            )}

            <button 
              className={`lk-button lk-chat-toggle ${showChat ? 'active' : ''}`}
              onClick={() => { setShowChat(!showChat); setShowMoreMenu(false); }}
              title="Chat"
            >
              <MessageSquare size={20} />
              <span>Chat {unreadCount > 0 ? `(${unreadCount})` : ''}</span>
              {unreadCount > 0 && <span className="notification-dot" style={{ top: 'auto', right: '12px', position: 'absolute' }}></span>}
            </button>

            {isHost && (
              <button 
                className="lk-button end-meeting-btn" 
                onClick={() => { handleEndMeeting(); setShowMoreMenu(false); }}
                title="Finalizar reunión"
                style={{ color: '#ef4444' }}
              >
                <PhoneOff size={20} />
                <span>Finalizar reunión</span>
              </button>
            )}
          </div>
        )}

        <button 
          className={`lk-button lk-raise-hand-toggle desktop-only ${isHandRaised ? 'active' : ''}`}
          onClick={toggleRaiseHand}
          title={isHandRaised ? "Bajar la mano" : "Levantar la mano"}
        >
          <Hand size={20} />
        </button>


        {/* Botón de Subtítulos (CC) */}
        <button 
          className={`lk-button control-btn-cc desktop-only ${isCaptionsOn ? 'active' : ''}`}
          onClick={() => setIsCaptionsOn(!isCaptionsOn)}
          title={isCaptionsOn ? "Desactivar subtítulos" : "Activar subtítulos"}
        >
          <Type size={20} />
          {isCaptionsOn && <span className="btn-status-dot"></span>}
        </button>

        {isHost && (
          <button 
            className={`lk-button lk-participants-toggle desktop-only ${showParticipants ? 'active' : ''}`}
            onClick={() => setShowParticipants(!showParticipants)}
            title="Participantes"
          >
            <Users size={20} />
          </button>
        )}
        {isHost && (
          <button 
            className={`lk-button control-btn-record desktop-only ${isRecording ? 'active' : ''}`}
            onClick={isRecording ? stopRecording : startRecording}
            title={isRecording ? "Detener grabación" : "Grabar reunión"}
          >
            {isRecording ? <Square size={20} fill="#ef4444" color="#ef4444" /> : <Circle size={20} />}
            {isRecording && <span className="recording-dot-pulser"></span>}
          </button>
        )}
        <button 
          className={`lk-button lk-chat-toggle desktop-only ${showChat ? 'active' : ''}`}
          onClick={() => {
             console.log("Chat toggled", !showChat);
             setShowChat(!showChat);
          }}
          title="Chat"
        >
          <MessageSquare size={20} />
          {unreadCount > 0 && <span className="notification-dot"></span>}
        </button>
        {isHost && (
          <button 
            className="lk-button end-meeting-btn desktop-only" 
            onClick={handleEndMeeting}
            title="Finalizar reunión para todos"
          >
            <PhoneOff size={20} />
          </button>
        )}
      </div>

      {/* Floating Reactions Global Overlay */}
      <FloatingReactionsLayer reactions={floatingReactions} />

      {/* Styled Live Captions Overlay */}
      <LiveCaptionsOverlay captions={activeCaptions} />
    </div>
  );
}

// Global component to render theater-style captions
function LiveCaptionsOverlay({ captions }) {
  const entries = Object.entries(captions);
  if (entries.length === 0) return null;

  return (
    <div className="live-captions-container">
      {entries.map(([identity, data]) => (
        <CaptionItem key={identity} identity={identity} text={data.text} />
      ))}
    </div>
  );
}

function CaptionItem({ identity, text }) {
  const room = useRoomContext();
  const participant = room.getParticipantByIdentity(identity);
  const name = participant?.name || (participant?.metadata ? JSON.parse(participant.metadata).name : identity);

  return (
    <div className="caption-item-wrapper">
      <span className="caption-speaker">{name}:</span>
      <span className="caption-text">{text}</span>
    </div>
  );
}

// Global component to render floating emojis over tiles
function FloatingReactionsLayer({ reactions }) {
  return (
    <div className="floating-reactions-global-layer">
      {reactions.map(r => (
        <FloatingEmoji key={r.id} identity={r.identity} emoji={r.emoji} />
      ))}
    </div>
  );
}

function FloatingEmoji({ identity, emoji }) {
  const [pos, setPos] = useState(null);
  
  useEffect(() => {
    // Try to find the participant tile in the DOM
    const updatePosition = () => {
      const tile = document.querySelector(`[data-lk-participant-identity="${identity}"]`);
      if (tile) {
        const rect = tile.getBoundingClientRect();
        // Position at the bottom center of the tile
        setPos({
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        });
      } else {
        // Fallback to center of screen if tile not found
        setPos({
          x: window.innerWidth / 2,
          y: window.innerHeight / 2
        });
      }
    };

    updatePosition();
    // In case of grid resize
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [identity]);

  if (!pos) return null;

  return (
    <div 
      className="floating-emoji-item"
      style={{ 
        left: `${pos.x}px`, 
        top: `${pos.y}px`
      }}
    >
      {emoji}
    </div>
  );
}


// Participants Panel Component
function ParticipantsPanel({ room, localParticipant, isHost, onClose, onToggleParticipantMute, onToggleParticipantCamera }) {
  const [participants, setParticipants] = useState([]);
  
  // DRAGGABLE PANEL STATE
  const [pos, setPos] = useState({ x: window.innerWidth - 340, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      let newX = e.clientX - dragOffset.current.x;
      let newY = e.clientY - dragOffset.current.y;
      
      // Bounds checks
      newX = Math.max(0, Math.min(newX, window.innerWidth - 320));
      newY = Math.max(0, Math.min(newY, window.innerHeight - 100));
      
      setPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = '';
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const onDragStart = (e) => {
    // Only if not clicking a button
    if (e.target.closest('.participants-close-btn') || e.target.closest('.participant-toggle-btn')) return;
    
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y
    };
  };

  useEffect(() => {
    const updateParticipants = () => {
      const allParticipants = [
        localParticipant,
        ...Array.from(room.remoteParticipants.values())
      ];
      setParticipants(allParticipants);
    };

    updateParticipants();
    
    room.on('participantConnected', updateParticipants);
    room.on('participantDisconnected', updateParticipants);
    room.on('trackMuted', updateParticipants);
    room.on('trackUnmuted', updateParticipants);

    return () => {
      room.off('participantConnected', updateParticipants);
      room.off('participantDisconnected', updateParticipants);
      room.off('trackMuted', updateParticipants);
      room.off('trackUnmuted', updateParticipants);
    };
  }, [room, localParticipant]);

  const getAudioStatus = (participant) => {
    const audioTrack = participant.getTrackPublication(Track.Source.Microphone);
    return audioTrack && !audioTrack.isMuted;
  };

  const getVideoStatus = (participant) => {
    const videoTrack = participant.getTrackPublication(Track.Source.Camera);
    return videoTrack && !videoTrack.isMuted;
  };

  return (
    <div 
      className="participants-panel"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        position: 'fixed'
      }}
    >
      <div className="participants-header" onMouseDown={onDragStart}>
        <h3>Participantes ({participants.length})</h3>
        <button className="participants-close-btn" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="participants-list">
        {participants.map((participant) => {
          const isAudioOn = getAudioStatus(participant);
          const isVideoOn = getVideoStatus(participant);
          const isLocal = participant.identity === localParticipant.identity;
          const participantName = participant.name || participant.identity;
          
          return (
            <div key={participant.identity} className="participant-item">
              <div className="participant-info">
                <div className="participant-avatar">
                  {participantName.charAt(0).toUpperCase()}
                </div>
                <div className="participant-details">
                  <span className="participant-name">
                    {participantName} {isLocal && '(Tú)'}
                  </span>
                  <span className="participant-status">
                    {isAudioOn ? <Mic size={14} /> : <MicOff size={14} />}
                    <span style={{ marginRight: '8px' }}>{isAudioOn ? 'Audio' : 'Silenciado'}</span>
                    {isVideoOn ? <Video size={14} /> : <VideoOff size={14} />}
                    <span>{isVideoOn ? 'Cámara' : 'Cámara off'}</span>
                  </span>
                </div>
              </div>
              <div className="participant-controls">
                {isHost && !isLocal && (
                  <>
                    <button
                      className={`participant-toggle-btn ${isAudioOn ? 'mute' : 'unmute'}`}
                      onClick={() => onToggleParticipantMute(participant.identity, isAudioOn)}
                      title={isAudioOn ? "Silenciar participante" : "Activar micrófono"}
                    >
                      {isAudioOn ? <MicOff size={18} /> : <Mic size={18} />}
                    </button>
                    <button
                      className={`participant-toggle-btn ${isVideoOn ? 'mute' : 'unmute'}`}
                      onClick={() => onToggleParticipantCamera(participant.identity, isVideoOn)}
                      title={isVideoOn ? "Desactivar cámara" : "Activar cámara"}
                    >
                      {isVideoOn ? <VideoOff size={18} /> : <Video size={18} />}
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CustomChat({ onClose, meetingId, visible, isMuted, onToggleMute, onSendReaction }) {
  const { chatMessages, send } = useChat();
  const [message, setMessage] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [currentColor, setCurrentColor] = useState('#efefef');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [currentFont, setCurrentFont] = useState('Inter');
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [currentSize, setCurrentSize] = useState('14px');
  const [showSizePicker, setShowSizePicker] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem('chat-theme') || 'dark');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false });
  const typingTimeoutRef = useRef(null);
  const [isLocalTyping, setIsLocalTyping] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [messageReactions, setMessageReactions] = useState({}); // { "id|timestamp": { "emoji": [identities] } }
  
  const inputRef = useRef(null);
  const savedRangeRef = useRef(null); // Store cursor position for emoji insertion
  
  // DRAGGABLE CHAT STATE
  const [chatPos, setChatPos] = useState({ x: window.innerWidth - 420, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  
  // SCROLL & NEW MESSAGE STATE
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const scrollRef = useRef(null);
  const lastMsgCount = useRef(0);


  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      let newX = e.clientX - dragOffset.current.x;
      let newY = e.clientY - dragOffset.current.y;
      
      // Dynamic threshold based on screen size
      const currentChatWidth = window.innerWidth <= 530 ? (window.innerWidth * 0.9) : chatSize.width;
      
      // Bounds checks
      newX = Math.max(0, Math.min(newX, window.innerWidth - currentChatWidth - 10));
      // Relaxed constraint: Allow dragging anywhere, just keep header somewhat visible
      newY = Math.max(0, Math.min(newY, window.innerHeight - 40));
      
      setChatPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.userSelect = ''; // Restore selection
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none'; // Prevent selection while dragging
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const onDragStart = (e) => {
    // Only if not clicking a button or resize handle
    if (e.target.closest('.chat-close-btn') || e.target.closest('.chat-resize-handle')) return;
    
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - chatPos.x,
      y: e.clientY - chatPos.y
    };
  };

  // RESIZING LOGIC
  const [chatSize, setChatSize] = useState({ width: 350, height: 500 });

  // Keep chat in bounds on resize
  useEffect(() => {
    const handleResize = () => {
      setChatPos(prev => {
        let newX = prev.x;
        let newY = prev.y;
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Dynamic threshold based on screen size
        const currentChatWidth = width <= 530 ? (width * 0.9) : chatSize.width;
        
        // If window shrinks or is small, push chat back into view
        if (newX + currentChatWidth > width - 10) {
          newX = Math.max(0, width - currentChatWidth - 20);
        }
        // Relaxed constraint: Allow resize near bottom
        if (newY + chatSize.height > height) {
          newY = Math.max(0, height - chatSize.height);
        }

        // Center if screen is very narrow
        if (width <= 530) {
           newX = (width - currentChatWidth) / 2;
        }
        
        return { x: newX, y: newY };
      });
    };

    window.addEventListener('resize', handleResize);
    // Trigger once on mount/initialization to ensure correct placement
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [chatSize.width, chatSize.height]);
  const [isResizing, setIsResizing] = useState(false);
  const resizeDir = useRef(''); // 'n', 's', 'e', 'w', etc.
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0, xPos: 0, yPos: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.current.x;
        const deltaY = e.clientY - resizeStart.current.y;
        const dir = resizeDir.current;
        
        let newWidth = resizeStart.current.w;
        let newHeight = resizeStart.current.h;
        let newX = resizeStart.current.xPos;
        let newY = resizeStart.current.yPos;

        // Horizontal resize
        if (dir.includes('e')) {
          newWidth = Math.max(300, resizeStart.current.w + deltaX);
        } else if (dir.includes('w')) {
          const potentialWidth = resizeStart.current.w - deltaX;
          if (potentialWidth >= 300) {
            newWidth = potentialWidth;
            newX = resizeStart.current.xPos + deltaX;
          }
        }

        // Vertical resize
        if (dir.includes('s')) {
          newHeight = Math.max(400, resizeStart.current.h + deltaY);
        } else if (dir.includes('n')) {
          const potentialHeight = resizeStart.current.h - deltaY;
          if (potentialHeight >= 400) {
            newHeight = potentialHeight;
            newY = resizeStart.current.yPos + deltaY;
          }
        }
        
        // Enforce bottom constraint during resize (relaxed)
        if (newY + newHeight > window.innerHeight) {
          newHeight = window.innerHeight - newY;
          if (newHeight < 350) { // Minimum height check
            newHeight = 350;
            newY = Math.max(0, window.innerHeight - 350);
          }
        }
        
        setChatSize({ width: newWidth, height: newHeight });
        setChatPos({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, chatPos]);

  const onResizeStart = (e, dir) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeDir.current = dir;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: chatSize.width,
      h: chatSize.height,
      xPos: chatPos.x,
      yPos: chatPos.y
    };
  };

  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const checkActiveFormats = () => {
    setActiveFormats({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline')
    });
    
    try {
      const color = document.queryCommandValue('foreColor');
      if (color && color !== 'inherit' && color !== 'initial') {
        const hex = color.startsWith('rgb') ? rgbToHex(color) : color;
        if (hex && hex !== 'windowtext') setCurrentColor(hex);
      }
    } catch (e) {}
  };

  const onEmojiClick = (emojiObject) => {
    if (inputRef.current) {
      inputRef.current.focus();
      const selection = window.getSelection();
      let inserted = false;
      
      // Try to restore saved range first
      if (savedRangeRef.current) {
        selection.removeAllRanges();
        selection.addRange(savedRangeRef.current);
      }
      
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        if (inputRef.current.contains(range.commonAncestorContainer)) {
          range.deleteContents();
          const textNode = document.createTextNode(emojiObject.emoji);
          range.insertNode(textNode);
          range.setStartAfter(textNode);
          range.setEndAfter(textNode);
          selection.removeAllRanges();
          selection.addRange(range);
          inserted = true;
        }
      }
      
      if (!inserted) {
        // Fallback: append at end
        inputRef.current.focus();
        document.execCommand('insertText', false, emojiObject.emoji);
      }
      
      setMessage(inputRef.current.innerText);
      handleTyping();
      savedRangeRef.current = null; // Clear saved range
    }
    setShowEmojiPicker(false);
  };

  const sendTypingStatus = (typing) => {
    if (!localParticipant || localParticipant.state === 'disconnected') return;
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify({ type: 'typing', isTyping: typing }));
      localParticipant.publishData(data, { reliable: true }).catch(err => {
        if (!err.message?.includes('Abort')) {
          console.warn("Non-abort publish error:", err);
        }
      });
    } catch (e) {}
  };

  const handleTyping = () => {
    if (!isLocalTyping) {
      setIsLocalTyping(true);
      sendTypingStatus(true);
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsLocalTyping(false);
      sendTypingStatus(false);
    }, 2000);
  };

  useEffect(() => {
    const handleData = (payload, participant) => {
      try {
        const decoder = new TextDecoder();
        const data = JSON.parse(decoder.decode(payload));
        if (data.type === 'typing') {
          setTypingUsers(prev => ({
            ...prev,
            [participant.identity]: data.isTyping ? (participant.metadata ? JSON.parse(participant.metadata).name : participant.name || participant.identity) : null
          }));
        } else if (data.type === 'reaction') {
          const { msgId, emoji } = data;
          const userIdent = participant.identity;
          
          setMessageReactions(prev => {
            const currentMsgReactions = prev[msgId] || {};
            const users = currentMsgReactions[emoji] || [];
            
            // Toggle reaction: if user already reacted with this emoji, remove it
            const newUsers = users.includes(userIdent) 
              ? users.filter(u => u !== userIdent)
              : [...users, userIdent];
              
            return {
              ...prev,
              [msgId]: {
                ...currentMsgReactions,
                [emoji]: newUsers
              }
            };
          });
        }
      } catch (e) {
        console.error("Error processing data channel message:", e);
      }
    };

    room.on('dataReceived', handleData);
    return () => room.off('dataReceived', handleData);
  }, [room, localParticipant.identity]);

  const playNotificationSound = () => {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      // Gentle "Pop" sound
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.15);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      // Ignore audio errors (e.g. strict autoplay policy)
    }
  };

  // SMART AUTOSCROLL & NEW MESSAGE INDICATOR
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    const hasNewMessages = chatMessages.length > lastMsgCount.current;
    const lastMsgWasLocal = chatMessages[chatMessages.length - 1]?.from?.isLocal;

    if (hasNewMessages) {
      if (isAtBottom || lastMsgWasLocal) {
        el.scrollTop = el.scrollHeight;
        setShowScrollBottom(false);
      } else {
        setShowScrollBottom(true);
      }
      
      // Play sound for incoming remote messages
      if (!lastMsgWasLocal) {
        playNotificationSound();
      }
    }
    lastMsgCount.current = chatMessages.length;
  }, [chatMessages]);

  const handleScroll = (e) => {
    const el = e.target;
    const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
    if (isAtBottom) setShowScrollBottom(false);
  };

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setShowScrollBottom(false);
    }
  };

  const rgbToHex = (rgb) => {
    if (!rgb) return "";
    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/i);
    if (!match) return rgb;
    const hex = (x) => ("0" + parseInt(x).toString(16)).slice(-2);
    return "#" + hex(match[1]) + hex(match[2]) + hex(match[3]);
  };

  const htmlToBBCode = (html) => {
    const temp = document.createElement('div');
    const sanitizer = DOMPurify.sanitize || (DOMPurify.default && DOMPurify.default.sanitize);
    temp.innerHTML = typeof sanitizer === 'function' ? sanitizer(html) : html; 
    
    const processNode = (node) => {
      let content = '';
      if (!node) return content;
      
      Array.from(node.childNodes).forEach(child => {
        if (child.nodeType === 3) { // TEXT_NODE
          content += child.textContent;
        } else if (child.nodeType === 1) { // ELEMENT_NODE
          let inner = processNode(child);
          const style = child.getAttribute('style') || '';
          const tag = child.tagName.toLowerCase();
          
          let formattedCode = inner;
          if (tag === 'b' || tag === 'strong' || style.includes('font-weight: bold') || style.includes('font-weight: 700')) {
            formattedCode = `[b]${formattedCode}[/b]`;
          }
          if (tag === 'i' || tag === 'em' || style.includes('font-style: italic')) {
            formattedCode = `[i]${formattedCode}[/i]`;
          }
          if (tag === 'u' || style.toLowerCase().includes('text-decoration: underline')) {
            formattedCode = `[u]${formattedCode}[/u]`;
          }
          
          let colorValue = '';
          const colorMatch = style.match(/color:\s*([^;]+)/i);
          if (colorMatch) {
            colorValue = colorMatch[1].trim();
          } else if (child.getAttribute('color')) {
            colorValue = child.getAttribute('color');
          }

          if (colorValue) {
            if (colorValue.toLowerCase().startsWith('rgb')) colorValue = rgbToHex(colorValue);
            formattedCode = `[color:${colorValue}]${formattedCode}[/color]`;
          }

          let fontValue = '';
          const fontMatch = style.match(/font-family:\s*([^;]+)/i);
          if (fontMatch) {
            fontValue = fontMatch[1].trim().replace(/['"]/g, '');
          }

          if (fontValue) {
            if (fontValue.includes(',')) fontValue = fontValue.split(',')[0].trim();
            formattedCode = `[font:${fontValue}]${formattedCode}[/font]`;
          }

          let sizeValue = '';
          const sizeMatch = style.match(/font-size:\s*([^;]+)/i);
          if (sizeMatch) {
            sizeValue = sizeMatch[1].trim();
            formattedCode = `[size:${sizeValue}]${formattedCode}[/size]`;
          }
          
          if (tag === 'div' || tag === 'p') {
            content += (content ? '\n' : '') + formattedCode;
          } else if (tag === 'br') {
            content += '\n';
          } else {
            content += formattedCode;
          }
        }
      });
      return content;
    };
    
    return processNode(temp);
  };

  const handleSend = (e) => {
    e?.preventDefault();
    const htmlContent = inputRef.current?.innerHTML || "";
    let bbMessage = htmlToBBCode(htmlContent).trim();
    
    if (bbMessage) {
      if (replyingTo) {
        const sender = replyingTo.from?.name || replyingTo.from?.identity || 'Usuario';
        const cleanText = replyingTo.message.replace(/\[REPLY:.*?\]/, '').substring(0, 60).replace(/[\[\]\|]/g, ' ');
        bbMessage = `[REPLY:${sender}|${cleanText}]${bbMessage}`;
      }

      send(bbMessage);
      setReplyingTo(null); // Clear reply after sending
      if (inputRef.current) {
        inputRef.current.innerHTML = "";
        // Reapply the color for the next message
        inputRef.current.focus();
        document.execCommand('styleWithCSS', false, true);
        if (currentColor && currentColor !== '#efefef') {
          document.execCommand('foreColor', false, currentColor);
        }
      }
      setMessage('');
      // Color is now preserved - no reset here
      setIsLocalTyping(false);
      sendTypingStatus(false);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    }
  };

  const sendReaction = (msg, emoji) => {
    const msgId = `${msg.from?.identity}|${msg.timestamp}`;
    const localIdentity = room.localParticipant.identity;

    // Local update first (Optimistic UI)
    setMessageReactions(prev => {
      const currentMsgReactions = prev[msgId] || {};
      const users = currentMsgReactions[emoji] || [];
      const newUsers = users.includes(localIdentity) 
        ? users.filter(u => u !== localIdentity)
        : [...users, localIdentity];
      return { ...prev, [msgId]: { ...currentMsgReactions, [emoji]: newUsers } };
    });

    // Broadcast to others ONLY if connected
    if (room.state === 'connected') {
      try {
        const payload = JSON.stringify({ type: 'reaction', msgId, emoji });
        const encoder = new TextEncoder();
        room.localParticipant.publishData(encoder.encode(payload), { reliable: true }).catch(err => {
          if (!err.message?.includes('Abort') && !err.message?.includes('closed')) {
            console.warn("Reaction publish error:", err);
          }
        });
      } catch (e) {
        console.error("Error broadcasting reaction:", e);
      }
    }

    // Trigger floating effect locally
    if (onSendReaction) onSendReaction(emoji);
  };

  const applyFormat = (type, value) => {
    inputRef.current?.focus();
    document.execCommand('styleWithCSS', false, true);
    if (type === 'bold' || type === 'italic' || type === 'underline') {
      document.execCommand(type, false, null);
    } else if (type === 'color') {
      document.execCommand('foreColor', false, value);
    } else if (type === 'font') {
      document.execCommand('fontName', false, value);
    } else if (type === 'fontSize') {
      // execCommand('fontSize') uses 1-7, but we want px.
      // So we span it manually
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const span = document.createElement('span');
        span.style.fontSize = value;
        const range = selection.getRangeAt(0);
        range.surroundContents(span);
      }
    }
    checkActiveFormats();
  };

  const uploadFile = async (file) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    if (meetingId) formData.append('meeting_id', meetingId);

    try {
      const response = await fetch(`${getApiUrl()}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      if (data.secure_url) {
        const fileMsg = `[FILE]${file.name}|${data.secure_url}`;
        send(fileMsg);
      } else {
        toast.error(`Error al subir: ${data.error || "Error desconocido"}`);
      }
    } catch (err) {
      toast.error(`Fallo de conexión: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const onFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error("El archivo es muy grande (máx 10MB)");
        return;
      }
      uploadFile(file);
    }
  };

  const handleDownload = async (url, filename) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Error al descargar archivo");
      const blob = await response.blob();

      if ('showSaveFilePicker' in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: 'Archivo',
              accept: { '*/*': ['.' + filename.split('.').pop()] }
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          toast.success("Archivo guardado correctamente");
          return;
        } catch (err) {
          if (err.name === 'AbortError') return;
        }
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      toast.error("Error al descargar el archivo");
      window.open(url, '_blank');
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getSenderColor = (identity) => {
    if (!identity) return '#33b5e5';
    const colors = [
      '#33b5e5', '#ff4444', '#ffbb33', '#00c851', '#aa66cc', '#ff8800', 
      '#009688', '#e91e63', '#673ab7', '#3f51b5', '#2196f3', '#03a9f4'
    ];
    let hash = 0;
    for (let i = 0; i < identity.length; i++) {
      hash = identity.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const renderMessageContent = (msgText) => {
    let replyContent = null;
    let actualMsg = msgText;

    // Detect and extract reply metadata: [REPLY:Sender|Text]
    const replyMatch = msgText.match(/^\[REPLY:(.*?)\|(.*?)\]/);
    if (replyMatch) {
      replyContent = {
        sender: replyMatch[1],
        text: replyMatch[2]
      };
      actualMsg = msgText.replace(replyMatch[0], '');
    }

    if (actualMsg.startsWith('[FILE]')) {
      const parts = actualMsg.replace('[FILE]', '').split('|');
      const fileName = parts[0];
      const fileUrl = parts[1];
      const urlParts = fileUrl.split('/');
      const internalFilename = urlParts[urlParts.length - 1];
      const downloadUrl = `${getApiUrl()}/download/${internalFilename}`;

      const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName);

      if (isImage) {
        return (
          <div className="image-message-container">
            <div className="image-thumbnail-wrapper" onClick={() => setLightboxImage(fileUrl)}>
              <img src={fileUrl} alt={fileName} className="chat-image-thumbnail" />
              <div className="image-overlay-info">
                <span>{fileName}</span>
              </div>
            </div>
            <button onClick={() => handleDownload(downloadUrl, fileName)} className="image-download-overlay-btn" title="Descargar original">
              <Download size={14} />
            </button>
          </div>
        );
      }

      return (
        <div className="file-message-card">
          <a 
            href={fileUrl} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="file-message-link"
            onClick={(e) => {
              e.preventDefault();
              window.open(fileUrl, '_blank', 'noopener,noreferrer');
            }}
          >
            <div className="file-icon-box"><FileText size={20} /></div>
            <div className="file-info">
              <span className="file-name">{fileName}</span>
              <span className="file-action">Clic para abrir <ExternalLink size={10} /></span>
            </div>
          </a>
          <button onClick={() => handleDownload(downloadUrl, fileName)} className="file-download-btn" title="Guardar como...">
            <Download size={16} />
          </button>
        </div>
      );
    }

    const autoLink = (text) => {
      if (typeof text !== 'string') return text;
      // Better regex to avoid trailing punctuation
      const urlRegex = /(https?:\/\/[^\s<]+[^.,;:\s<])/g;
      
      const highlightSearch = (str) => {
        if (!searchTerm || typeof str !== 'string') return str;
        const searchRegex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        const parts = str.split(searchRegex);
        return parts.map((part, i) => 
          part.toLowerCase() === searchTerm.toLowerCase() 
            ? <span key={i} className="search-highlight">{part}</span> 
            : part
        );
      };

      const parts = text.split(urlRegex);
      return parts.map((part, i) => {
        if (part.match(urlRegex)) {
          return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="chat-auto-link">{part}</a>;
        }
        return highlightSearch(part);
      });
    };

    const parseBBCode = (text) => {
      if (typeof text !== 'string') return text;
      
      const regex = /\[(b|i|u)\]([\s\S]*?)\[\/\1\]|\[color:(#[0-9a-fA-F]{3,6}|[a-zA-Z]+)\]([\s\S]*?)\[\/color\]|\[font:([^\]]+)\]([\s\S]*?)\[\/font\]|\[size:([^\]]+)\]([\s\S]*?)\[\/size\]/gi;
      let lastIndex = 0;
      let match;
      const content = [];

      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          content.push(autoLink(text.substring(lastIndex, match.index)));
        }

        if (match[1]) { // b, i, u
          const tag = match[1];
          const innerText = match[2];
          if (tag === 'b') content.push(<strong key={match.index}>{parseBBCode(innerText)}</strong>);
          else if (tag === 'i') content.push(<em key={match.index}>{parseBBCode(innerText)}</em>);
          else if (tag === 'u') content.push(<u key={match.index}>{parseBBCode(innerText)}</u>);
        } else if (match[3]) { // color
          const color = match[3];
          const innerText = match[4];
          content.push(<span key={match.index} style={{ color }}>{parseBBCode(innerText)}</span>);
        } else if (match[5]) { // font
          const font = match[5];
          const innerText = match[6];
          content.push(<span key={match.index} style={{ fontFamily: font }}>{parseBBCode(innerText)}</span>);
        } else if (match[7]) { // size
          const size = match[7];
          const innerText = match[8];
          content.push(<span key={match.index} style={{ fontSize: size }}>{parseBBCode(innerText)}</span>);
        }

        lastIndex = regex.lastIndex;
      }

      if (lastIndex < text.length) {
        content.push(autoLink(text.substring(lastIndex)));
      }

      return content.length > 0 ? content : autoLink(text);
    };

      const mainContent = parseBBCode(actualMsg);
      
      if (replyContent) {
        return (
          <>
            <div 
              className="msg-reply-quote" 
              style={{ borderLeftColor: getSenderColor(replyContent.sender) }}
            >
              <span className="quote-sender" style={{ color: getSenderColor(replyContent.sender) }}>
                {replyContent.sender}
              </span>
              <p className="quote-text">{replyContent.text}</p>
            </div>
            <div className="msg-actual-text">{mainContent}</div>
          </>
        );
      }
      
      return <div className="msg-actual-text">{mainContent}</div>;
    };

  return (
    <div 
      className={`custom-chat-container theme-${currentTheme} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
      style={{ 
        left: `${chatPos.x}px`, 
        top: `${chatPos.y}px`,
        width: `${chatSize.width}px`,
        height: `${chatSize.height}px`,
        display: visible ? 'flex' : 'none'
      }}
    >
      <div className="chat-header" onMouseDown={onDragStart}>
        <div className="chat-header-top">
          <div className="chat-header-title">
            <MessageSquare size={16} />
            <span>Chat</span>
          </div>
          <div className="chat-header-actions">
            <button 
              className={`chat-mute-btn ${isMuted ? 'muted' : ''}`} 
              onClick={onToggleMute}
              title={isMuted ? "Activar sonido" : "Silenciar chat"}
            >
              {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            <button 
              className={`chat-theme-btn ${showThemePicker ? 'active' : ''}`}
              onClick={() => setShowThemePicker(!showThemePicker)}
              title="Cambiar tema"
            >
              <Palette size={18} />
            </button>
            <button className="chat-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="chat-search-bar" onMouseDown={(e) => e.stopPropagation()}>
          <div className="search-input-wrapper">
            <label htmlFor="chat-search-input-room" className="sr-only">Buscar mensajes en el chat</label>
            <input 
              id="chat-search-input-room"
              name="chatSearch"
              type="text" 
              placeholder="Buscar mensajes..." 
              value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="search-clear-btn" onClick={() => setSearchTerm('')}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {showThemePicker && (
          <div className="chat-theme-picker-popover">
            {[
              { id: 'dark', color: '#111b21', label: 'Oscuro' },
              { id: 'light', color: '#f0f2f5', label: 'Claro' },
              { id: 'green', color: '#008069', label: 'Verde' },
              { id: 'blue', color: '#005a9e', label: 'Azul' },
              { id: 'rose', color: '#800040', label: 'Rosa' }
            ].map(t => (
              <button 
                key={t.id}
                className={`theme-option-btn ${t.id} ${currentTheme === t.id ? 'active' : ''}`}
                onClick={() => {
                  setCurrentTheme(t.id);
                  localStorage.setItem('chat-theme', t.id);
                  setShowThemePicker(false);
                }}
                title={t.label}
              >
                {currentTheme === t.id && <Check size={16} />}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="chat-messages-list" ref={scrollRef} onScroll={handleScroll}>
        {chatMessages
          .filter(msg => msg.message.toLowerCase().includes(searchTerm.toLowerCase()))
          .map((msg, i) => {
          const isLocal = msg.from?.isLocal;
          
          // MESSAGE GROUPING LOGIC
          const prevMsg = i > 0 ? chatMessages[i-1] : null;
          const isSameSender = prevMsg && prevMsg.from?.identity === msg.from?.identity;
          const timeDiff = prevMsg ? (msg.timestamp - prevMsg.timestamp) : 0;
          const isGrouped = isSameSender && timeDiff < 300000; // 5 minutes grouping

          return (
            <div key={i} className={`chat-entry ${isLocal ? 'local' : 'remote'} ${isGrouped ? 'grouped' : ''}`}>
              {!isGrouped && (
                <div className="msg-avatar-container">
                  {(() => {
                    try {
                      const meta = msg.from?.metadata ? JSON.parse(msg.from.metadata) : {};
                      if (meta.avatarUrl) return <img src={meta.avatarUrl} alt="" className="msg-avatar" />;
                      if (meta.avatarHash) return <img src={`https://www.gravatar.com/avatar/${meta.avatarHash}?d=mp&s=64`} alt="" className="msg-avatar" />;
                    } catch (e) {}
                    return <div className="msg-avatar-placeholder">{msg.from?.name?.charAt(0).toUpperCase() || 'P'}</div>;
                  })()}
                </div>
              )}
              {isGrouped && <div className="msg-avatar-spacer" />}
              
              <div className="msg-bubble">
                {!isLocal && !isGrouped && (
                  <span 
                    className="msg-sender" 
                    style={{ color: getSenderColor(msg.from?.identity) }}
                  >
                    {msg.from?.name || msg.from?.identity || 'Participante'}
                  </span>
                )}
                
                <div className="reaction-picker-container">
                  <div className="reaction-picker-menu">
                    {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                      <button 
                        key={emoji} 
                        className="reaction-menu-item"
                        onClick={() => sendReaction(msg, emoji)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="msg-content">{renderMessageContent(msg.message)}</div>
                
                {/* Reactions Display */}
                {(() => {
                  const msgId = `${msg.from?.identity}|${msg.timestamp}`;
                  const reactions = messageReactions[msgId];
                  if (!reactions) return null;
                  
                  return (
                    <div className="msg-reactions-pills">
                      {Object.entries(reactions).map(([emoji, users]) => {
                        if (users.length === 0) return null;
                        const hasReacted = users.includes(room.localParticipant.identity);
                        return (
                          <div 
                            key={emoji} 
                            className={`reaction-pill ${hasReacted ? 'active' : ''}`}
                            onClick={() => sendReaction(msg, emoji)}
                            title={users.length > 1 ? `${users.length} personas` : users[0]}
                          >
                            <span className="reaction-emoji">{emoji}</span>
                            {users.length > 1 && <span className="reaction-count">{users.length}</span>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                <div className="msg-footer">
                  <span className="msg-time">{formatTime(msg.timestamp)}</span>
                  {isLocal && (
                    <span className="msg-status-check" title="Enviado">
                      <CheckCheck size={12} strokeWidth={3} />
                    </span>
                  )}
                  <button 
                    className="chat-reply-btn" 
                    onClick={() => setReplyingTo(msg)}
                    title="Responder"
                  >
                    <CornerUpLeft size={14} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {isUploading && (
          <div className="chat-entry local uploading">
            <div className="msg-bubble">
              <span className="upload-loader">Subiendo archivo...</span>
            </div>
          </div>
        )}
        {Object.values(typingUsers).filter(val => val !== null).length > 0 && (
          <div className="typing-indicator-msg">
            {Object.values(typingUsers).filter(val => val !== null).join(', ')} está escribiendo...
          </div>
        )}

        {showScrollBottom && (
          <button className="chat-scroll-bottom-btn" onClick={scrollToBottom}>
            <ArrowDown size={14} />
            <span>Mensajes nuevos</span>
          </button>
        )}
      </div>

      <div className="chat-input-area-wrapper">
        {replyingTo && (
          <div className="chat-reply-preview-bar">
            <div className="reply-preview-accent" style={{ backgroundColor: getSenderColor(replyingTo.from?.identity) }} />
            <div className="reply-preview-info">
              <span className="reply-to-label">Respondiendo a {replyingTo.from?.name || replyingTo.from?.identity || 'Participante'}</span>
              <p className="reply-to-text">{replyingTo.message.replace(/\[REPLY:.*?\]/, '').substring(0, 80)}</p>
            </div>
            <button className="reply-cancel-btn" onClick={() => setReplyingTo(null)}>
              <X size={16} />
            </button>
          </div>
        )}
        
        <div className="chat-functions-toolbar">
          <div className="toolbar-group">
            <label className={`toolbar-btn ${isUploading ? 'disabled' : ''}`} title="Subir archivo" htmlFor="chat-file-input">
              <Paperclip size={18} />
              <input id="chat-file-input" name="fileUpload" type="file" style={{ display: 'none' }} onChange={onFileSelect} disabled={isUploading} />
            </label>

            <button 
              type="button" 
              className={`toolbar-btn ${isUploading ? 'disabled' : ''}`} 
              title="Emojis" 
              onMouseDown={(e) => {
                e.preventDefault();
                // Save cursor position before opening picker
                const selection = window.getSelection();
                if (selection.rangeCount > 0 && inputRef.current?.contains(selection.anchorNode)) {
                  savedRangeRef.current = selection.getRangeAt(0).cloneRange();
                }
                setShowEmojiPicker(prev => !prev);
                setShowColorPicker(false);
              }} 
              disabled={isUploading}
            >
              <Smile size={18} />
            </button>
          </div>

          <div className="toolbar-group">
            <button 
              type="button" 
              className={`toolbar-btn ${isUploading ? 'disabled' : ''} ${activeFormats.bold ? 'active' : ''}`} 
              title="Negrita" 
              onMouseDown={(e) => { e.preventDefault(); applyFormat('bold'); }} 
              disabled={isUploading}
            >
              <Bold size={17} />
            </button>
            <button 
              type="button" 
              className={`toolbar-btn ${isUploading ? 'disabled' : ''} ${activeFormats.italic ? 'active' : ''}`} 
              title="Cursiva" 
              onMouseDown={(e) => { e.preventDefault(); applyFormat('italic'); }} 
              disabled={isUploading}
            >
              <Italic size={17} />
            </button>
            <button 
              type="button" 
              className={`toolbar-btn ${isUploading ? 'disabled' : ''} ${activeFormats.underline ? 'active' : ''}`} 
              title="Subrayado" 
              onMouseDown={(e) => { e.preventDefault(); applyFormat('underline'); }} 
              disabled={isUploading}
            >
              <UnderlineIcon size={17} />
            </button>
            
            <div className="font-menu-wrapper">
              <button 
                type="button"
                className={`toolbar-btn ${isUploading ? 'disabled' : ''} ${showFontPicker ? 'active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault(); 
                  setShowFontPicker(!showFontPicker);
                  setShowColorPicker(false);
                  setShowEmojiPicker(false);
                }}
                title="Cambiar fuente"
                disabled={isUploading}
              >
                <Type size={18} />
              </button>
              {showFontPicker && (
                <div className="font-picker-dropdown">
                  {[
                    { name: 'Inter', family: 'Inter, sans-serif' },
                    { name: 'Roboto', family: 'Roboto, sans-serif' },
                    { name: 'Courier', family: '"Courier New", Courier, monospace' },
                    { name: 'Georgia', family: 'Georgia, serif' },
                    { name: 'Pacífico', family: '"Pacifico", cursive' },
                    { name: 'Lobster', family: '"Lobster", cursive' }
                  ].map(f => (
                    <button 
                      key={f.name}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setCurrentFont(f.family);
                        applyFormat('font', f.family);
                        setShowFontPicker(false);
                      }}
                      className={`font-option ${currentFont === f.family ? 'active' : ''}`}
                      style={{ fontFamily: f.family }}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="size-menu-wrapper">
              <button 
                type="button"
                className={`toolbar-btn ${isUploading ? 'disabled' : ''} ${showSizePicker ? 'active' : ''}`}
                onMouseDown={(e) => {
                  e.preventDefault(); 
                  setShowSizePicker(!showSizePicker);
                  setShowFontPicker(false);
                  setShowColorPicker(false);
                  setShowEmojiPicker(false);
                }}
                title="Tamaño de fuente"
                disabled={isUploading}
              >
                <div className="size-btn-label">{currentSize.replace('px', '')}</div>
              </button>
              {showSizePicker && (
                <div className="size-picker-dropdown">
                  {[10, 12, 14, 16, 18, 20, 24, 28, 32].map(s => (
                    <button 
                      key={s}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const pxSize = `${s}px`;
                        setCurrentSize(pxSize);
                        applyFormat('fontSize', pxSize);
                        setShowSizePicker(false);
                      }}
                      className={`size-option ${currentSize === `${s}px` ? 'active' : ''}`}
                    >
                      <span className="size-num">{s}</span>
                      <span className="px-label">pixels</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="color-picker-wrapper">
              <button 
                type="button" 
                className={`toolbar-btn ${isUploading ? 'disabled' : ''} ${showColorPicker ? 'active' : ''}`} 
                title="Color de texto" 
                onMouseDown={(e) => {
                  e.preventDefault();
                  setShowColorPicker(!showColorPicker);
                  setShowEmojiPicker(false);
                }} 
                disabled={isUploading}
              >
                <div className="color-btn-content">
                  <Palette size={17} />
                  <div className="color-indicator" style={{ backgroundColor: currentColor }}></div>
                </div>
              </button>
              {showColorPicker && (
                <div className="color-palette-popover">
                  {['#efefef', '#000000', '#25d366', '#34b7f1', '#ff4444', '#ffbb33', '#00c851', '#33b5e5', '#aa66cc', '#ff8800'].map(color => (
                    <div key={color} className="color-swatch" style={{ backgroundColor: color }} title={color} onMouseDown={(e) => {
                      e.preventDefault();
                      setCurrentColor(color);
                      applyFormat('color', color);
                      setShowColorPicker(false);
                    }} />
                  ))}
                  <div className="custom-color-input-container" title="Color personalizado">
                    <label htmlFor="custom-text-color" className="sr-only">Elegir color de texto personalizado</label>
                    <input 
                      id="custom-text-color"
                      name="textColor"
                      type="color" 
                      value={currentColor} 
                      onChange={(e) => {
                        setCurrentColor(e.target.value);
                        applyFormat('color', e.target.value);
                      }} 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {lightboxImage && (
            <div className="lightbox-overlay" onClick={() => setLightboxImage(null)}>
              <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
                <img src={lightboxImage} alt="Fullscreen preview" />
                <button className="lightbox-close" onClick={() => setLightboxImage(null)}>
                  <X size={24} />
                </button>
                <a href={lightboxImage} download className="lightbox-download" target="_blank" rel="noopener noreferrer">
                  <Download size={20} />
                </a>
              </div>
            </div>
          )}

          {showEmojiPicker && (
            <div className="emoji-picker-container">
              <EmojiPicker onEmojiClick={onEmojiClick} width={300} height={400} />
            </div>
          )}

        </div>

        <form className="chat-input-form" onSubmit={handleSend}>
          <div 
            id="chat-message-input"
            ref={inputRef}
            contentEditable={!isUploading}
            className="chat-input-editable"
            aria-label="Escribe tu mensaje"
            onInput={(e) => {
              setMessage(e.currentTarget.innerText);
              handleTyping();
            }}
            onMouseUp={checkActiveFormats}
            onKeyUp={(e) => {
              checkActiveFormats();
              handleTyping();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            data-placeholder="Escribe un mensaje..."
          />
          <button type="submit" className="chat-send-btn" disabled={!message.trim() || isUploading}>
            <Send size={18} />
          </button>
        </form>
      </div>
      
      {/* Resize handles */}
      <div className="chat-resizer resizer-n" onMouseDown={(e) => onResizeStart(e, 'n')}></div>
      <div className="chat-resizer resizer-s" onMouseDown={(e) => onResizeStart(e, 's')}></div>
      <div className="chat-resizer resizer-e" onMouseDown={(e) => onResizeStart(e, 'e')}></div>
      <div className="chat-resizer resizer-w" onMouseDown={(e) => onResizeStart(e, 'w')}></div>
      <div className="chat-resizer resizer-ne" onMouseDown={(e) => onResizeStart(e, 'ne')}></div>
      <div className="chat-resizer resizer-nw" onMouseDown={(e) => onResizeStart(e, 'nw')}></div>
      <div className="chat-resizer resizer-se" onMouseDown={(e) => onResizeStart(e, 'se')}></div>
      <div className="chat-resizer resizer-sw" onMouseDown={(e) => onResizeStart(e, 'sw')}></div>
    </div>
  );
}

export default MeetingRoom;

function MeetingEndedScreen({ summary, onGoHome, onRejoin }) {
  const formatDuration = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="meeting-ended-overlay">
      <div className="ended-card">
        <div className="ended-icon-wrapper">
          <PhoneOff size={48} className="ended-main-icon" />
        </div>
        
        <h1 className="ended-title">La reunión ha finalizado</h1>
        <p className="ended-subtitle">Gracias por usar ASICME Meet.</p>

        <div className="ended-stats">
          <div className="stat-item">
            <span className="stat-label">Duración</span>
            <span className="stat-value">{formatDuration(summary?.duration || 0)}</span>
          </div>
          <div className="stat-item separator"></div>
          <div className="stat-item">
            <span className="stat-label">Participantes</span>
            <span className="stat-value">{summary?.participantCount || 'Desconocido'}</span>
          </div>
        </div>

        <div className="ended-actions">
          <button className="ended-btn btn-rejoin" onClick={onRejoin}>
            Volver a entrar
          </button>
          <button className="ended-btn btn-home" onClick={onGoHome}>
            Ir al inicio
          </button>
        </div>

        <div className="ended-footer">
          ASICME Meet &copy; 2026 - Conexión Segura
        </div>
      </div>
    </div>
  );
}
