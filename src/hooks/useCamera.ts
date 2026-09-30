import { useCallback, useEffect, useRef, useState } from 'react';

function cameraError(error: unknown) {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera access was denied. Allow camera access in your browser’s site settings, then try again. You can also upload photos.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found. Connect a camera and try again, or upload your photos.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'Your camera is busy. Close other apps using it, then try again. You can also upload photos.';
  return 'We couldn’t start your camera. Check that it is connected, or upload photos instead.';
}

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestRef = useRef(0);
  const [status, setStatus] = useState<'off' | 'loading' | 'ready'>('off');
  const [error, setError] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');

  const close = useCallback(() => {
    requestRef.current++;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('off');
  }, []);

  const enable = useCallback(async (id?: string) => {
    close();
    const request = requestRef.current;
    setError(''); setStatus('loading');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access needs HTTPS or localhost and a supported browser. You can still upload photos.'); setStatus('off'); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { width: { ideal: 1920 }, height: { ideal: 1440 }, ...(id ? { deviceId: { exact: id } } : { facingMode: 'user' }) } });
      if (request !== requestRef.current || !videoRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();
      if (request !== requestRef.current) return;
      setDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId || '');
      setStatus('ready');
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (streamRef.current === stream) { close(); setError('Your camera disconnected. Reconnect it and enable the camera again, or upload photos.'); }
      });
      try {
        const list = await navigator.mediaDevices.enumerateDevices();
        if (request === requestRef.current) setDevices(list.filter(d => d.kind === 'videoinput'));
      } catch { /* The active stream still works if device enumeration is unavailable. */ }
    } catch (e) {
      if (request === requestRef.current) { close(); setError(cameraError(e)); }
    }
  }, [close]);

  const switchCamera = useCallback(() => {
    const next = devices[(devices.findIndex(d => d.deviceId === deviceId) + 1) % devices.length];
    if (next) void enable(next.deviceId);
  }, [devices, deviceId, enable]);

  useEffect(() => () => {
    requestRef.current++;
    streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);
  return { videoRef, status, error, enable, close, switchCamera, canSwitch: devices.length > 1 };
}
