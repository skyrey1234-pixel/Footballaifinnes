import { useEffect, useRef } from 'react';

export default function VideoPlayer({ session, seek }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (seek && videoRef.current) {
      videoRef.current.currentTime = seek.seconds;
      videoRef.current.play();
    }
  }, [seek]);

  if (session.source_type === 'youtube') {
    const src = `https://www.youtube.com/embed/${session.youtube_video_id}?start=${Math.floor(seek?.seconds || 0)}${seek ? '&autoplay=1' : ''}`;
    return (
      <div className="aspect-video rounded-xl overflow-hidden bg-black border border-white/5">
        <iframe
          key={seek?.key || 'initial'}
          src={src}
          title="Game footage"
          className="w-full h-full"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <video
      ref={videoRef}
      src={session.video_url}
      controls
      className="w-full aspect-video rounded-xl bg-black border border-white/5"
    />
  );
}