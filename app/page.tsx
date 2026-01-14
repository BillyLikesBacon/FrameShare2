'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { addPlayer, createGame } from '@/lib/bowling';
import { Plus, Play, Users, Hash, X, Copy, Check, ArrowRight, Info } from 'lucide-react';

function generate5DigitID() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default function Home() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>('create');

  // Create Game State
  const [newGameId, setNewGameId] = useState<string>('');
  const [createPlayers, setCreatePlayers] = useState<string[]>([]);
  const [createPlayerName, setCreatePlayerName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Join Game State
  const [joinGameId, setJoinGameId] = useState('');
  const [joinPlayers, setJoinPlayers] = useState<string[]>([]);
  const [joinPlayerName, setJoinPlayerName] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setNewGameId(generate5DigitID());
  }, []);

  const addCreatePlayer = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (createPlayerName.trim()) {
      setCreatePlayers([...createPlayers, createPlayerName.trim()]);
      setCreatePlayerName('');
    }
  };

  const removeCreatePlayer = (index: number) => {
    setCreatePlayers(createPlayers.filter((_, i) => i !== index));
  };

  const addJoinPlayer = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (joinPlayerName.trim()) {
      setJoinPlayers([...joinPlayers, joinPlayerName.trim()]);
      setJoinPlayerName('');
    }
  };

  const removeJoinPlayer = (index: number) => {
    setJoinPlayers(joinPlayers.filter((_, i) => i !== index));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(newGameId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateGame = async (e?: React.FormEvent) => {
    e?.preventDefault(); // Optional if called from button
    if (createPlayers.length === 0) return;

    setCreateLoading(true);
    try {
      await createGame(newGameId);
      // add all players
      await Promise.all(createPlayers.map(name => addPlayer(newGameId, name)));
      router.push(`/game/${newGameId}`);
    } catch (error: any) {
      console.error('Failed to create game:', error);
      if (error.message?.includes('uuid') || error.message?.includes('syntax')) {
        alert('Database requires UUID format (Migration needed). Switching to UUID fallback...');
        const uuid = generateUUID();
        setNewGameId(uuid);
        // We'll need user to click create again or auto-retry? 
        // Auto-retry might be complex due to async. I'll just clear loading.
        setCreateLoading(false);
        return;
      }
      alert('Failed to start game. ' + error.message);
      setCreateLoading(false);
    }
  };

  const handleJoinGame = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!joinGameId.trim() || joinPlayers.length === 0) return;

    setJoinLoading(true);
    try {
      await Promise.all(joinPlayers.map(name => addPlayer(joinGameId, name)));
      router.push(`/game/${joinGameId}`);
    } catch (error: any) {
      console.error('Failed to join game:', error);
      if (error.message?.includes('foreign key constraint')) {
        alert('Game ID not found. Please check the ID.');
      } else {
        alert('Failed to join game. ' + error.message);
      }
      setJoinLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Background */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-purple-500/20 blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[40%] rounded-full bg-cyan-500/20 blur-[100px]" />
      </div>

      <main className="w-full max-w-md flex flex-col gap-8 z-10">
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
            Strike Frame
          </h1>
          <p className="text-neutral-400">Multi-Alley Scorecard</p>
        </div>

        {/* INSTRUCTIONS BOX */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm text-blue-200">
          <div className="flex items-center gap-2 mb-2 font-semibold text-blue-100">
            <Info className="w-4 h-4" /> How It Works
          </div>
          <p className="mb-2">This game is designed for <strong>2 Bowling Alleys</strong> to play together.</p>
          <ul className="list-disc list-inside space-y-1 opacity-90">
            <li>Use <strong>one device per alley</strong>.</li>
            <li><strong>Alley 1</strong>: Create the game and add your players.</li>
            <li><strong>Alley 2</strong>: Join with the Game ID and add your players.</li>
          </ul>
        </div>

        <div className="bg-neutral-900/50 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6">

          {/* Tabs */}
          <div className="grid grid-cols-2 gap-2 bg-neutral-950/50 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('create')}
              className={`py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'create'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-300'
                }`}
            >
              Alley 1 (Create)
            </button>
            <button
              onClick={() => setActiveTab('join')}
              className={`py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'join'
                ? 'bg-neutral-800 text-white shadow-sm'
                : 'text-neutral-500 hover:text-neutral-300'
                }`}
            >
              Alley 2 (Join)
            </button>
          </div>

          <div className="h-px bg-white/10 w-full" />

          {activeTab === 'create' ? (
            /* CREATE GAME FORM */
            <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">

              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                  <Hash className="w-3 h-3" /> Game ID (Share this)
                </label>
                <div className="bg-white/5 border border-white/10 rounded-lg p-3 flex items-center gap-2">
                  <span className="flex-1 text-2xl font-mono text-cyan-400 tracking-widest text-center font-bold">
                    {newGameId}
                  </span>
                  <button
                    type="button"
                    onClick={() => setNewGameId(generate5DigitID())}
                    className="p-2 hover:bg-white/10 rounded-md transition-colors text-neutral-400 hover:text-white"
                    title="Generate New ID"
                  >
                    <div className="bg-neutral-800 rounded px-1.5 py-0.5 text-[10px]">Retry</div>
                  </button>
                </div>
              </div>

              {/* Players Input */}
              <div className="space-y-4">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                  <Users className="w-3 h-3" /> Alley 1 Players
                </label>

                <form onSubmit={addCreatePlayer} className="flex gap-2">
                  <input
                    type="text"
                    value={createPlayerName}
                    onChange={(e) => setCreatePlayerName(e.target.value)}
                    placeholder="Enter player name..."
                    className="flex-1 bg-neutral-950 border border-white/10 rounded-lg px-4 py-3 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-medium"
                  />
                  <button
                    type="submit"
                    disabled={!createPlayerName.trim()}
                    className="bg-neutral-800 hover:bg-neutral-700 text-white p-3 rounded-lg border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </form>

                <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-800 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-neutral-700">
                  {createPlayers.length === 0 ? (
                    <div className="text-center py-4 px-4 border border-dashed border-white/10 rounded-lg">
                      <p className="text-neutral-500 text-sm">No players added.</p>
                    </div>
                  ) : (
                    createPlayers.map((player, index) => (
                      <div
                        key={index}
                        className="group flex items-center justify-between bg-neutral-800/50 border border-white/5 rounded-lg px-4 py-3 transition-colors hover:bg-neutral-800"
                      >
                        <span className="font-medium text-neutral-200">{player}</span>
                        <button
                          onClick={() => removeCreatePlayer(index)}
                          className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateGame}
                disabled={createPlayers.length === 0 || createLoading}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-bold py-4 rounded-xl shadow-lg shadow-cyan-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createLoading ? (
                  <span className="animate-pulse">Creating Game...</span>
                ) : (
                  <>
                    Create & Enter <Play className="w-4 h-4 fill-current" />
                  </>
                )}
              </button>
            </div>
          ) : (
            /* JOIN GAME FORM */
            <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">

              <div className="space-y-2">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                  <Hash className="w-3 h-3" /> Game ID
                </label>
                <input
                  type="text"
                  value={joinGameId}
                  onChange={(e) => setJoinGameId(e.target.value)}
                  placeholder="Enter 5-digit Game ID..."
                  className="w-full bg-neutral-950 border border-white/10 rounded-lg px-4 py-3 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-medium font-mono tracking-widest text-center text-lg"
                />
              </div>

              {/* Players Input */}
              <div className="space-y-4">
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider flex items-center gap-1">
                  <Users className="w-3 h-3" /> Alley 2 Players
                </label>

                <form onSubmit={addJoinPlayer} className="flex gap-2">
                  <input
                    type="text"
                    value={joinPlayerName}
                    onChange={(e) => setJoinPlayerName(e.target.value)}
                    placeholder="Enter player name..."
                    className="flex-1 bg-neutral-950 border border-white/10 rounded-lg px-4 py-3 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all font-medium"
                  />
                  <button
                    type="submit"
                    disabled={!joinPlayerName.trim()}
                    className="bg-neutral-800 hover:bg-neutral-700 text-white p-3 rounded-lg border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </form>

                <div className="flex flex-col gap-2 max-h-[150px] overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-neutral-800 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-neutral-700">
                  {joinPlayers.length === 0 ? (
                    <div className="text-center py-4 px-4 border border-dashed border-white/10 rounded-lg">
                      <p className="text-neutral-500 text-sm">No players added.</p>
                    </div>
                  ) : (
                    joinPlayers.map((player, index) => (
                      <div
                        key={index}
                        className="group flex items-center justify-between bg-neutral-800/50 border border-white/5 rounded-lg px-4 py-3 transition-colors hover:bg-neutral-800"
                      >
                        <span className="font-medium text-neutral-200">{player}</span>
                        <button
                          onClick={() => removeJoinPlayer(index)}
                          className="text-neutral-500 hover:text-red-400 transition-colors p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={handleJoinGame}
                disabled={!joinGameId.trim() || joinPlayers.length === 0 || joinLoading}
                className="w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold py-4 rounded-xl border border-white/10 active:scale-[0.99] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {joinLoading ? (
                  <span className="animate-pulse">Joining...</span>
                ) : (
                  <>
                    Join Game <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

        </div>
      </main>

      <footer className="absolute bottom-4 text-neutral-600 text-xs">
        FrameShare • v0.1.0
      </footer>
    </div>
  );
}
