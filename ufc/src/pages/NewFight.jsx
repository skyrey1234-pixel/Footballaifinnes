import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Upload, Youtube, Loader2, ArrowRight } from 'lucide-react';

const extractYoutubeId = (url) => {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/);
  return match ? match[1] : null;
};

const DIVISIONS = [
  'Flyweight', 'Bantamweight', 'Featherweight', 'Lightweight',
  'Welterweight', 'Middleweight', 'Light Heavyweight', 'Heavyweight',
  "Women's Strawweight", "Women's Flyweight", "Women's Bantamweight", "Women's Featherweight",
];

export default function NewFight() {
  const navigate = useNavigate();
  const [fighter, setFighter] = useState('');
  const [division, setDivision] = useState('');
  const [fightDate, setFightDate] = useState('');
  const [sourceType, setSourceType] = useState('youtube');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!fighter.trim()) return setError('Enter the fighter name.');

    const data = { fighter_name: fighter.trim(), division: division || undefined, fight_date: fightDate || undefined, source_type: sourceType, status: 'analyzing' };

    if (sourceType === 'youtube') {
      const videoId = extractYoutubeId(youtubeUrl);
      if (!videoId) return setError('Paste a valid YouTube link.');
      data.youtube_video_id = videoId;
    } else {
      if (!file) return setError('Choose a video file to upload.');
    }

    setSubmitting(true);
    if (sourceType === 'upload') {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      data.video_url = file_url;
    }
    const session = await base44.entities.FightSession.create(data);
    navigate(`/fight?id=${session.id}`);
  };

  const tabClass = (active) =>
    `flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-heading font-semibold transition-colors ${
      active ? 'bg-[#FF2D2D]/10 text-[#FF2D2D] border border-[#FF2D2D]/30' : 'bg-white/5 text-slate-400 border border-transparent hover:text-white'
    }`;

  return (
    <div className="max-w-xl mx-auto px-6 py-10 md:py-14">
      <h1 className="font-heading font-bold text-2xl md:text-3xl text-white tracking-tight">New Breakdown</h1>
      <p className="text-sm text-slate-500 mt-1.5 mb-8">Feed the AI fight footage — get a full fight report back.</p>

      <form onSubmit={submit} className="space-y-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Fighter</label>
          <input
            value={fighter}
            onChange={(e) => setFighter(e.target.value)}
            placeholder="e.g. Ilia Topuria"
            className="w-full bg-[#161B22] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#FF2D2D]/50"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Division</label>
          <select
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            className="w-full bg-[#161B22] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#FF2D2D]/50 [color-scheme:dark]"
          >
            <option value="">Select a division</option>
            {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Fight Date</label>
          <input
            type="date"
            value={fightDate}
            onChange={(e) => setFightDate(e.target.value)}
            className="w-full bg-[#161B22] border border-white/10 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-[#FF2D2D]/50 [color-scheme:dark]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Footage Source</label>
          <div className="flex gap-2 mb-4">
            <button type="button" onClick={() => setSourceType('youtube')} className={tabClass(sourceType === 'youtube')}>
              <Youtube className="w-4 h-4" /> YouTube Link
            </button>
            <button type="button" onClick={() => setSourceType('upload')} className={tabClass(sourceType === 'upload')}>
              <Upload className="w-4 h-4" /> Upload Video
            </button>
          </div>

          {sourceType === 'youtube' ? (
            <input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full bg-[#161B22] border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-[#FF2D2D]/50"
            />
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-white/15 rounded-xl py-10 cursor-pointer hover:border-[#FF2D2D]/40 transition-colors">
              <Upload className="w-6 h-6 text-slate-500" />
              <span className="text-sm text-slate-400">{file ? file.name : 'Click to choose a video file'}</span>
              <input type="file" accept="video/*" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
            </label>
          )}
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 bg-[#FF2D2D] text-white font-heading font-bold py-3.5 rounded-lg hover:bg-[#FF2D2D]/90 disabled:opacity-60 transition-colors"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> {sourceType === 'upload' ? 'Uploading footage...' : 'Starting analysis...'}</>
          ) : (
            <>Run AI Breakdown <ArrowRight className="w-4 h-4" /></>
          )}
        </button>
      </form>
    </div>
  );
}
