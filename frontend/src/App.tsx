import { useState, useEffect } from 'react';
import { isConnected, getPublicKey } from '@stellar/freighter-api';

function App() {
  const [walletInstalled, setWalletInstalled] = useState<boolean | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if Freighter is installed on load
  useEffect(() => {
    async function checkWallet() {
      try {
        const installed = await isConnected();
        setWalletInstalled(!!installed);
      } catch (err) {
        console.error("Error checking Freighter installation:", err);
        setWalletInstalled(false);
      }
    }
    checkWallet();
  }, []);

  const handleConnectWallet = async () => {
    setLoading(true);
    setError(null);
    try {
      const installed = await isConnected();
      if (!installed) {
        throw new Error("Freighter wallet extension is not installed.");
      }

      const publicKey = await getPublicKey();
      if (!publicKey) {
        throw new Error("No accounts found. Please unlock your Freighter wallet.");
      }

      setUserAddress(publicKey);
      setWalletConnected(true);
    } catch (err: any) {
      console.error("Failed to connect Freighter:", err);
      setError(err.message || "Failed to connect wallet.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setUserAddress(null);
    setWalletConnected(false);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#07080a] text-gray-100 flex flex-col font-sans">
      {/* Header */}
      <header className="w-full glass-panel sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center font-bold text-xl shadow-lg shadow-violet-500/20">
            ⚓
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white m-0 leading-none">Anchorpay</h1>
            <p className="text-xs text-gray-400 mt-1">Stellar Escrow & Splits</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-950/40 border border-violet-800/30 text-xs font-semibold text-violet-300">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"></span>
            Stellar Testnet
          </div>

          {walletConnected ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-400 bg-gray-900/60 px-3 py-2 rounded-xl border border-gray-800">
                {userAddress?.slice(0, 6)}...{userAddress?.slice(-6)}
              </span>
              <button
                onClick={handleDisconnect}
                className="px-3 py-2 rounded-xl text-xs font-medium bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/30 transition-all"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectWallet}
              disabled={loading || walletInstalled === false}
              className="px-5 py-2 rounded-xl text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-lg shadow-violet-600/20 disabled:opacity-50"
            >
              {loading ? 'Connecting...' : walletInstalled === false ? 'Freighter Not Found' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Middle Column (Operations & Forms) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
            <h2 className="text-lg font-bold text-white mb-2">Freighter Wallet Integration</h2>
            
            {error && (
              <div className="p-4 rounded-xl bg-red-950/30 border border-red-900/40 text-sm text-red-300">
                Error: {error}
              </div>
            )}

            {walletInstalled === false ? (
              <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/30 text-sm text-amber-300">
                ⚠️ Freighter wallet extension is not detected in your browser. Please install the <a href="https://www.freighter.app/" target="_blank" rel="noopener noreferrer" className="underline font-semibold hover:text-amber-200">Freighter Wallet Extension</a> and refresh the page.
              </div>
            ) : walletConnected ? (
              <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-sm text-emerald-300">
                ✅ Connected with account: <span className="font-mono font-bold select-all">{userAddress}</span>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-900/30 text-sm text-violet-200">
                Freighter wallet detected. Click "Connect Wallet" to fetch your account address and view contract operations.
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Live Contract Status) */}
        <div className="flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
            <h2 className="text-base font-bold text-white border-b border-gray-800 pb-3 mb-2 flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              Live Contract Status
            </h2>

            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center text-sm py-1 border-b border-gray-900">
                <span className="text-gray-400">Escrow State</span>
                <span className="px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 text-xs font-semibold uppercase">
                  Initialized
                </span>
              </div>
              <div className="flex justify-between items-center text-sm py-1 border-b border-gray-900">
                <span className="text-gray-400">Amount Locked</span>
                <span className="font-mono text-white text-base font-bold">
                  0 XLM
                </span>
              </div>
              <div className="flex flex-col gap-1 text-sm py-1 border-b border-gray-900">
                <span className="text-gray-400">Contract ID</span>
                <span className="font-mono text-xs text-violet-300 break-all select-all">
                  CA352LBL2RVTLZG2ZOAQERZBN2DINWUIPRDRBVHF2CUDBOH3HNUZTYDN
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
