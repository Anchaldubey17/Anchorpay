import { useState } from 'react';

function App() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Mock contract status
  const contractState = {
    state: 0, // Init
    amountLocked: '0',
    config: {
      depositor: 'GDFFBVQB5NQ3Y5M63BVYGP3HULQJ7TIL3NNGZG6LNXPXTCTPDOOIPOK7',
      recipients: ['GDFFBVQB5NQ3Y5M63BVYGP3HULQJ7TIL3NNGZG6LNXPXTCTPDOOIPOK7'],
      shares: [1],
      arbiter: 'GDFFBVQB5NQ3Y5M63BVYGP3HULQJ7TIL3NNGZG6LNXPXTCTPDOOIPOK7',
      timelock: 1800000000,
      token: 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
    }
  };

  const handleConnectWallet = () => {
    setLoading(true);
    setTimeout(() => {
      setWalletConnected(true);
      setUserAddress('GDFFBVQB5NQ3Y5M63BVYGP3HULQJ7TIL3NNGZG6LNXPXTCTPDOOIPOK7');
      setLoading(false);
    }, 1000);
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

          <button
            onClick={handleConnectWallet}
            disabled={loading}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-lg shadow-violet-600/20 disabled:opacity-50"
          >
            {loading ? 'Connecting...' : walletConnected ? `${userAddress?.slice(0, 6)}...${userAddress?.slice(-6)}` : 'Connect Wallet'}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Middle Column (Operations & Forms) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
            <h2 className="text-lg font-bold text-white mb-2">Escrow Management Dashboard</h2>
            <p className="text-sm text-gray-400">
              Welcome to the Anchorpay decentralized escrow system. Connect your Freighter wallet to interact with the locked contract.
            </p>
            <div className="mt-4 p-4 rounded-xl bg-violet-950/20 border border-violet-900/30 text-sm text-violet-200">
              Scaffolded Interface. Connect Freighter Wallet to execute deposits, releases, and refunds.
            </div>
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
                  {contractState.amountLocked} XLM
                </span>
              </div>
              <div className="flex flex-col gap-1 text-sm py-1 border-b border-gray-900">
                <span className="text-gray-400">Contract ID</span>
                <span className="font-mono text-xs text-violet-300 break-all select-all">
                  CA352LBL2RVTLZG2ZOAQERZBN2DINWUIPRDRBVHF2CUDBOH3HNUZTYDN
                </span>
              </div>
              <div className="flex flex-col gap-1 text-sm py-1">
                <span className="text-gray-400">Token Address</span>
                <span className="font-mono text-xs text-gray-400 break-all">
                  {contractState.config.token}
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
