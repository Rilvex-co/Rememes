import { supabase } from './lib/supabase.ts';
import { getCurrentUser } from './lib/auth.ts';

const remoteVideo = document.getElementById('remote-video') as HTMLVideoElement;
const localVideo = document.getElementById('local-video') as HTMLVideoElement;
const hangupBtn = document.getElementById('hangup-btn') as HTMLButtonElement;
const muteBtn = document.getElementById('mute-btn') as HTMLButtonElement;
const cameraBtn = document.getElementById('camera-btn') as HTMLButtonElement;

const urlParams = new URLSearchParams(window.location.search);
const peerId = urlParams.get('peer');
const role = urlParams.get('role') || 'caller';

let localStream: MediaStream;
let pc: RTCPeerConnection;
let isMuted = false;
let isCameraOff = false;
const pendingCandidates: RTCIceCandidateInit[] = [];

const callChannel = supabase.channel(`call-signal-${peerId}`);

async function init() {
  const user = await getCurrentUser();
  if (!user || !peerId) return;

  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;

  pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

  pc.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
  };

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      callChannel.send({
        type: 'broadcast',
        event: 'ice',
        payload: { candidate: event.candidate.toJSON() },
      });
    }
  };

  callChannel
    .on('broadcast', { event: 'offer' }, async (payload) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.payload.sdp));
        flushCandidates();
        if (role === 'callee') {
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          callChannel.send({
            type: 'broadcast',
            event: 'answer',
            payload: { sdp: answer },
          });
        }
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    })
    .on('broadcast', { event: 'answer' }, async (payload) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.payload.sdp));
        flushCandidates();
      } catch (err) {
        console.error('Error handling answer:', err);
      }
    })
    .on('broadcast', { event: 'ice' }, async (payload) => {
      try {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(payload.payload.candidate));
        } else {
          pendingCandidates.push(payload.payload.candidate);
        }
      } catch (err) {
        console.error('Error adding ICE candidate:', err);
      }
    })
    .subscribe();

  if (role === 'caller') {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    callChannel.send({
      type: 'broadcast',
      event: 'offer',
      payload: { sdp: offer },
    });
  }
}

function flushCandidates() {
  while (pendingCandidates.length > 0 && pc.remoteDescription) {
    const candidate = pendingCandidates.shift();
    pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
  }
}

hangupBtn.addEventListener('click', () => {
  callChannel.send({ type: 'broadcast', event: 'hangup', payload: {} });
  window.location.href = 'index.html';
});

muteBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  localStream.getAudioTracks().forEach((track) => (track.enabled = !isMuted));
  muteBtn.textContent = isMuted ? '🔇' : '🎙️';
});

cameraBtn.addEventListener('click', () => {
  isCameraOff = !isCameraOff;
  localStream.getVideoTracks().forEach((track) => (track.enabled = !isCameraOff));
  cameraBtn.textContent = isCameraOff ? '🚫' : '📷';
});

init().catch((err) => {
  console.error(err);
  alert('Error starting call: ' + err.message);
  window.location.href = 'index.html';
});
