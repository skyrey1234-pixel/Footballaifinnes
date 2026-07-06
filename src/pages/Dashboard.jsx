import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import SessionCard from '@/components/sessions/SessionCard';
import { Plus, Crosshair } from 'lucide-react';

export default function Dashboard() {
  const [sessions, setSessions] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    base44.entities.GameSession.list('-created_date').then(setSessions);
    base44.auth.me().then((u) => setIsAdmin(u.role === 'admin'));
  }, []);

  const handleDelete = async (session) => {
    await base44.entities.GameSession.delete(session.id);
    await base44.entities.ScoutingReport.deleteMany({ session_id: session.id });
    setSessions((s) => s.filter((x) => x.id !== session.id));
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 md:py-14">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="font-heading font-bold text-2xl md:text-3xl text-white tracking-tight">Game Sessions</h1>
          <p className="text-sm text-slate-500 mt-1.5">Your opponent film breakdowns and scouting reports.</p>
        </div>
        {isAdmin && (
          <Link
            to="/new"
            className="inline-flex items-center gap-2 bg-[#00FF87] text-[#0D1117] font-heading font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-[#00FF87]/90 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Analysis
          </Link>
        )}
      </div>

      {sessions === null ? (
        <div className="flex justify-center py-20">
          <div className="w-7 h-7 border-2 border-white/10 border-t-[#00FF87] rounded-full animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-white/10 rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-[#00FF87]/10 flex items-center justify-center mx-auto mb-4">
            <Crosshair className="w-7 h-7 text-[#00FF87]" />
          </div>
          <h2 className="font-heading font-semibold text-white">No film broken down yet</h2>
          <p className="text-sm text-slate-500 mt-1.5 mb-6">Upload game footage and let the AI scout your opponent.</p>
          {isAdmin && (
            <Link to="/new" className="inline-flex items-center gap-2 bg-[#00FF87] text-[#0D1117] font-heading font-semibold text-sm px-5 py-2.5 rounded-lg hover:bg-[#00FF87]/90 transition-colors">
              <Plus className="w-4 h-4" />
              Analyze Your First Game
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} canDelete={isAdmin} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}