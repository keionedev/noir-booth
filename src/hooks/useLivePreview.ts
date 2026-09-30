import { useEffect, useRef, useState, type RefObject } from 'react';
import { renderPhoto, type FilterId } from '../lib/photobooth';
import { type EffectSettings } from '../lib/effects';

export function useLivePreview(videoRef: RefObject<HTMLVideoElement | null>, ready: boolean, ratio: number, mirrored: boolean, filter: FilterId, effect: EffectSettings) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setError('');
    const video = videoRef.current, canvas = canvasRef.current;
    if (!ready || !video || !canvas) return;
    let callback = 0, last = -Infinity, visible = true, stopped = false, failed = false;
    let targetWidth = 640, quality = 1, cost = 0, samples = 0;
    const videoFrames = typeof video.requestVideoFrameCallback === 'function';
    const stage = canvas.parentElement!;
    const resize = () => {
      const box = stage.getBoundingClientRect();
      const displayWidth = Math.min(box.width, box.height * ratio);
      targetWidth = Math.max(320, Math.min(960, Math.round(displayWidth * Math.min(devicePixelRatio || 1, 1.5))));
    };
    const cancel = () => {
      if (callback) {
        if (videoFrames) video.cancelVideoFrameCallback(callback); else cancelAnimationFrame(callback);
        callback = 0;
      }
    };
    const schedule = () => {
      if (!callback && !stopped && !failed && visible && !document.hidden) {
        callback = videoFrames ? video.requestVideoFrameCallback(draw) : requestAnimationFrame(draw);
      }
    };
    const draw = (now: number) => {
      callback = 0;
      if (stopped || failed || !visible || document.hidden) return;
      if (video.videoWidth && video.readyState >= 2 && now - last >= 1000 / 30 - 2) {
        const start = performance.now();
        const width = Math.max(320, Math.round(targetWidth * quality));
        try {
          renderPhoto(canvas, video, video.videoWidth, video.videoHeight, width, Math.round(width / ratio), mirrored, filter, { id: effect.id, amount: effect.amount });
        } catch {
          failed = true; setError('The camera preview could not be drawn. Close and re-enable your camera.'); return;
        }
        cost += performance.now() - start;
        if (++samples === 30) {
          // Reduce processing resolution on slower devices; full-size exports are unaffected.
          if (cost / samples > 20) quality = Math.max(.6, quality - .15);
          else if (cost / samples < 8) quality = Math.min(1, quality + .05);
          cost = 0; samples = 0;
        }
        last = now;
      }
      schedule();
    };
    const visibility = () => { cancel(); if (!document.hidden) { last = -Infinity; schedule(); } };
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    const intersection = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      if (visible) { last = -Infinity; schedule(); } else cancel();
    }) : null;
    resize(); resizeObserver?.observe(stage); intersection?.observe(stage);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', visibility);
    draw(performance.now());
    return () => {
      stopped = true; cancel(); resizeObserver?.disconnect(); intersection?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [ready, ratio, mirrored, filter, effect.id, effect.amount, videoRef]);
  return { canvasRef, renderError: error };
}
