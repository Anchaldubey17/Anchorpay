import { useState, useEffect } from 'react';
import { isConnected, requestAccess, signTransaction } from '@stellar/freighter-api';
import { Client, EscrowState, type EscrowStatus } from './contracts/anchorpay/src/index';
import { formatAmount, getEscrowStateLabel, truncateAddress } from './utils';

// Config
const CONTRACT_ID = 'CASEJNUHLUQYJZNBNQ3QO4JLFNOOEE3QYV34WNPLETOOSCOVERWYM43U';
const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
const RPC_URL = 'https://soroban-testnet.stellar.org';
const NATIVE_TOKEN_ID = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

// Initialize Client with Freighter signing capability
const contractClient = new Client({
  networkPassphrase: NETWORK_PASSPHRASE,
  contractId: CONTRACT_ID,
  rpcUrl: RPC_URL,
  signTransaction: async (xdr: string) => {
    const result = await signTransaction(xdr, {
      networkPassphrase: NETWORK_PASSPHRASE,
    });
    if (result.error) {
      throw new Error(result.error);
    }
    return {
      signedTxXdr: result.signedTxXdr
    };
  }
});

function CopyableAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  return (
    <div className="flex items-center justify-between gap-2 w-full bg-gray-950/40 border border-gray-850/60 px-3 py-2 rounded-xl">
      <span className="font-mono text-xs text-gray-300 break-all select-all flex-1">
        {truncateAddress(address, 8)}
      </span>
      <button
        onClick={handleCopy}
        type="button"
        title="Copy full address"
        className="p-1 px-2.5 rounded bg-violet-950/40 hover:bg-violet-900 border border-violet-900/30 text-violet-300 hover:text-white transition-all text-[10px] cursor-pointer"
      >
        {copied ? 'Copied! ✅' : '📋 Copy'}
      </button>
    </div>
  );
}

function App() {
  // Wallet state
  const [walletInstalled, setWalletInstalled] = useState<boolean | null>(null);
  const [walletConnected, setWalletConnected] = useState(false);
  const [userAddress, setUserAddress] = useState<string | null>(null);
  
  // App state
  const [contractStatus, setContractStatus] = useState<EscrowStatus | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  // Form states
  const [initRecipientsList, setInitRecipientsList] = useState<{ address: string; share: number }[]>([
    { address: '', share: 1 }
  ]);
  const [initArbiter, setInitArbiter] = useState('');
  const [initTimelock, setInitTimelock] = useState('');
  const [initToken, setInitToken] = useState(NATIVE_TOKEN_ID);
  
  const [depositAmount, setDepositAmount] = useState('');

  const handleAddRecipientRow = () => {
    setInitRecipientsList([...initRecipientsList, { address: '', share: 1 }]);
  };

  const handleRemoveRecipientRow = (index: number) => {
    if (initRecipientsList.length === 1) return;
    setInitRecipientsList(initRecipientsList.filter((_, i) => i !== index));
  };

  const handleUpdateRecipientRow = (index: number, field: 'address' | 'share', value: any) => {
    const updated = [...initRecipientsList];
    if (field === 'address') {
      updated[index].address = value;
    } else {
      updated[index].share = Math.max(1, parseInt(value, 10) || 1);
    }
    setInitRecipientsList(updated);
  };

  const getParticipantRole = () => {
    if (!walletConnected || !userAddress || !contractStatus?.config) return null;
    const addr = userAddress.trim();
    const depositor = contractStatus.config.depositor.trim();
    const arbiter = contractStatus.config.arbiter.trim();
    const recipients = contractStatus.config.recipients.map(r => r.trim());

    if (addr === depositor && addr === arbiter) return 'Depositor & Arbiter';
    if (addr === depositor) return 'Depositor';
    if (addr === arbiter) return 'Arbiter';
    if (recipients.includes(addr)) return 'Recipient';
    return 'Guest (Viewer)';
  };

  const userRole = getParticipantRole();

  const fetchContractStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await contractClient.get_status();
      if (response && response.result) {
        const unwrapped = response.result.unwrap();
        setContractStatus(unwrapped);
        setIsInitialized(true);
      }
    } catch (err: any) {
      console.warn("Failed to get contract status (likely uninitialized):", err);
      setIsInitialized(false);
      setContractStatus(null);
    } finally {
      setLoading(false);
    }
  };

  // Check wallet installation and fetch contract status on load
  useEffect(() => {
    async function init() {
      // Wallet check
      try {
        const result = await isConnected();
        setWalletInstalled(!!result.isConnected);
      } catch (err) {
        setWalletInstalled(false);
      }

      // Fetch status
      await fetchContractStatus();
    }
    init();
  }, []);

  const handleConnectWallet = async () => {
    setActionLoading(true);
    setError(null);
    try {
      const result = await isConnected();
      if (!result.isConnected) {
        throw new Error("Freighter wallet is not installed.");
      }
      
      const res = await requestAccess();
      if (res.error) {
        throw new Error(res.error);
      }
      if (res.address) {
        setUserAddress(res.address);
        setWalletConnected(true);
        // Query status immediately after connection
        await fetchContractStatus();
      } else {
        throw new Error("No address returned from Freighter wallet.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect wallet.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = () => {
    setUserAddress(null);
    setWalletConnected(false);
    setError(null);
    setTxHash(null);
  };

  // 1. Initialize escrow on-chain
  const handleInitializeEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletConnected || !userAddress) {
      setError("Please connect your wallet first.");
      return;
    }

    setActionLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Verify active account matches Freighter extension state
      const checkAddressRes = await requestAccess();
      if (checkAddressRes.address && checkAddressRes.address !== userAddress) {
        setUserAddress(checkAddressRes.address);
        throw new Error(`Active Freighter account changed to ${truncateAddress(checkAddressRes.address, 6)}. Connected account updated. Please review the form and submit again.`);
      }

      const recipientsArray = initRecipientsList.map(r => r.address.trim()).filter(Boolean);
      const sharesArray = initRecipientsList.map(r => r.share);
      const epochTimelock = Math.floor(new Date(initTimelock).getTime() / 1000);

      if (recipientsArray.length === 0) {
        throw new Error("Must provide at least one recipient address.");
      }
      if (recipientsArray.length !== initRecipientsList.length) {
        throw new Error("Please ensure all recipient addresses are filled out.");
      }
      if (isNaN(epochTimelock) || epochTimelock <= Math.floor(Date.now() / 1000)) {
        throw new Error("Timelock must be a valid date in the future.");
      }

      const tx = await contractClient.initialize({
        depositor: userAddress,
        recipients: recipientsArray,
        shares: sharesArray,
        arbiter: initArbiter.trim(),
        timelock: BigInt(epochTimelock),
        token: initToken.trim(),
      }, {
        publicKey: userAddress
      });

      const response = await tx.signAndSend();
      if (response.sendTransactionResponse && response.sendTransactionResponse.hash) {
        setTxHash(response.sendTransactionResponse.hash);
        await fetchContractStatus();
      } else {
        throw new Error("Transaction submission failed.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Initialization failed. Check logs.");
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Deposit funds
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletConnected || !userAddress) {
      setError("Please connect your wallet first.");
      return;
    }

    setActionLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Verify active account matches Freighter extension state
      const checkAddressRes = await requestAccess();
      if (checkAddressRes.address && checkAddressRes.address !== userAddress) {
        setUserAddress(checkAddressRes.address);
        throw new Error(`Active Freighter account changed. Connected account updated. Please try your deposit again.`);
      }

      const amountVal = parseFloat(depositAmount);
      if (isNaN(amountVal) || amountVal <= 0) {
        throw new Error("Please enter a valid deposit amount.");
      }

      // 7 decimals for native XLM / Soroban tokens
      const amountBigInt = BigInt(Math.round(amountVal * 10000000));

      const tx = await contractClient.deposit({ amount: amountBigInt }, {
        publicKey: userAddress
      });
      const response = await tx.signAndSend();

      if (response.sendTransactionResponse && response.sendTransactionResponse.hash) {
        setTxHash(response.sendTransactionResponse.hash);
        await fetchContractStatus();
        setDepositAmount('');
      } else {
        throw new Error("Transaction failed.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Deposit transaction failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Release funds (Arbiter only)
  const handleRelease = async () => {
    if (!walletConnected || !userAddress) return;
    setActionLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Verify active account matches Freighter extension state
      const checkAddressRes = await requestAccess();
      if (checkAddressRes.address && checkAddressRes.address !== userAddress) {
        setUserAddress(checkAddressRes.address);
        throw new Error(`Active Freighter account changed. Connected account updated. Please try again.`);
      }

      const tx = await contractClient.release({
        publicKey: userAddress
      });
      const response = await tx.signAndSend();

      if (response.sendTransactionResponse && response.sendTransactionResponse.hash) {
        setTxHash(response.sendTransactionResponse.hash);
        await fetchContractStatus();
      } else {
        throw new Error("Release transaction failed.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Release failed.");
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Refund funds (Depositor only, post-timelock)
  const handleRefund = async () => {
    if (!walletConnected || !userAddress) return;
    setActionLoading(true);
    setError(null);
    setTxHash(null);

    try {
      // Verify active account matches Freighter extension state
      const checkAddressRes = await requestAccess();
      if (checkAddressRes.address && checkAddressRes.address !== userAddress) {
        setUserAddress(checkAddressRes.address);
        throw new Error(`Active Freighter account changed. Connected account updated. Please try again.`);
      }

      const tx = await contractClient.refund({
        publicKey: userAddress
      });
      const response = await tx.signAndSend();

      if (response.sendTransactionResponse && response.sendTransactionResponse.hash) {
        setTxHash(response.sendTransactionResponse.hash);
        await fetchContractStatus();
      } else {
        throw new Error("Refund transaction failed.");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Refund failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const isTimelockExpired = () => {
    if (!contractStatus?.config?.timelock) return false;
    const timelockSec = Number(contractStatus.config.timelock);
    return Math.floor(Date.now() / 1000) >= timelockSec;
  };

  return (
    <div className="min-h-screen bg-[#07080a] text-gray-100 flex flex-col font-sans">
      {/* Header */}
      <header className="w-full glass-panel sticky top-0 z-50 px-4 md:px-6 py-4 flex flex-col md:flex-row items-center gap-4 justify-between">
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center font-bold text-xl shadow-lg shadow-violet-500/20">
            ⚓
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white m-0 leading-none">Anchorpay</h1>
            <p className="text-xs text-gray-400 mt-1">Stellar Escrow & Splits</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto justify-end">
          <button
            onClick={fetchContractStatus}
            disabled={loading}
            className="p-2.5 rounded-xl text-gray-300 hover:text-white bg-gray-900 border border-gray-800 text-xs transition-all disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : '🔄 Refresh State'}
          </button>
          
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-violet-950/40 border border-violet-800/30 text-xs font-semibold text-violet-300">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse"></span>
            Stellar Testnet
          </div>

          {walletConnected ? (
            <div className="flex items-center gap-2">
              {userRole && (
                <span className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-wider ${
                  userRole.includes('Depositor') ? 'bg-violet-950/60 text-violet-400 border border-violet-900/30' :
                  userRole.includes('Arbiter') ? 'bg-amber-950/60 text-amber-400 border border-amber-900/30' :
                  userRole.includes('Recipient') ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-900/30' :
                  'bg-gray-900 text-gray-400 border border-gray-800'
                }`}>
                  {userRole}
                </span>
              )}
              <span className="text-xs font-mono text-gray-300 bg-gray-950 px-3 py-2 rounded-xl border border-gray-850">
                {truncateAddress(userAddress || '', 6)}
              </span>
              <button
                onClick={handleDisconnect}
                className="px-3 py-2 rounded-xl text-xs font-medium bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-900/30 transition-all cursor-pointer"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectWallet}
              disabled={actionLoading || walletInstalled === false}
              className="px-4 py-2 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-lg shadow-violet-600/20 disabled:opacity-50 cursor-pointer"
            >
              {actionLoading ? 'Connecting...' : walletInstalled === false ? 'Freighter Not Found' : 'Connect Wallet'}
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left/Middle Column (Operations & Forms) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Notifications Panel */}
          {error && (
            <div className="p-4 rounded-xl bg-red-950/30 border border-red-950/50 text-sm text-red-300">
              ⚠️ <strong>Error:</strong> {error}
            </div>
          )}

          {txHash && (
            <div className="p-4 rounded-xl bg-violet-950/30 border border-violet-900/40 text-sm text-violet-300 flex flex-col gap-1.5">
              <span>🎉 <strong>Transaction Submitted!</strong></span>
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-violet-200 font-mono text-xs break-all"
              >
                Hash: {txHash} (view on Stellar Expert)
              </a>
            </div>
          )}

          {/* Wallet connection banner if not connected */}
          {!walletConnected && (
            <div className="p-6 rounded-2xl glass-panel text-center flex flex-col items-center gap-4 py-12">
              <div className="w-16 h-16 rounded-full bg-violet-950/40 border border-violet-850 flex items-center justify-center text-3xl">
                💳
              </div>
              <div>
                <h3 className="text-lg font-bold text-white mb-1">Freighter Wallet Connection Required</h3>
                <p className="text-sm text-gray-400 max-w-md">
                  To view and execute transactions on the split-payment escrow contract, you need to connect your Freighter wallet account.
                </p>
              </div>
              <button
                onClick={handleConnectWallet}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-violet-600 hover:bg-violet-500 text-white transition-all shadow-lg"
              >
                Connect Wallet Now
              </button>
            </div>
          )}

          {/* Form Actions (Only displayed when wallet is connected) */}
          {walletConnected && (
            <>
              {/* Scenario 1: Contract is Uninitialized */}
              {isInitialized === false && (
                <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
                  <div className="border-b border-gray-800 pb-3 mb-2">
                    <h2 className="text-lg font-bold text-white m-0">Initialize Escrow Configuration</h2>
                    <p className="text-xs text-gray-400 mt-1">Configure depositor, recipients, split weights, and release criteria.</p>
                  </div>

                  <form onSubmit={handleInitializeEscrow} className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-gray-400 font-medium">Depositor Address</label>
                        <input
                          type="text"
                          value={userAddress || ''}
                          disabled
                          className="px-3 py-2.5 rounded-xl bg-gray-900 border border-gray-850 text-sm font-mono text-gray-400"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-gray-400 font-medium">Arbiter Address (Approver)</label>
                        <input
                          type="text"
                          required
                          value={initArbiter}
                          onChange={(e) => setInitArbiter(e.target.value)}
                          placeholder="G..."
                          className="px-3 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-sm font-mono text-white focus:border-violet-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Dynamic Recipients Columns */}
                    <div className="flex flex-col gap-3">
                      <div className="flex justify-between items-center border-b border-gray-850 pb-1.5">
                        <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">Recipients & Split Weights</label>
                        <button
                          type="button"
                          onClick={handleAddRecipientRow}
                          className="px-3 py-1 rounded-lg text-xs font-semibold bg-violet-950/60 hover:bg-violet-900 border border-violet-900/30 text-violet-300 transition-all cursor-pointer"
                        >
                          ➕ Add Recipient
                        </button>
                      </div>

                      <div className="flex flex-col gap-2.5 max-h-[220px] overflow-y-auto pr-1">
                        {initRecipientsList.map((row, idx) => (
                          <div key={idx} className="flex gap-2 items-center">
                            <div className="flex-1">
                              <input
                                type="text"
                                required
                                value={row.address}
                                onChange={(e) => handleUpdateRecipientRow(idx, 'address', e.target.value)}
                                placeholder={`Recipient ${idx + 1} Address (G...)`}
                                className="w-full px-3 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-xs font-mono text-white focus:border-violet-500 focus:outline-none"
                              />
                            </div>
                            <div className="w-28 shrink-0">
                              <input
                                type="number"
                                required
                                min="1"
                                value={row.share}
                                onChange={(e) => handleUpdateRecipientRow(idx, 'share', e.target.value)}
                                placeholder="Weight"
                                className="w-full px-3 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-xs text-center text-white focus:border-violet-500 focus:outline-none"
                              />
                            </div>
                            {initRecipientsList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveRecipientRow(idx)}
                                title="Remove recipient"
                                className="p-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 border border-red-900/30 text-red-400 text-xs transition-all cursor-pointer shrink-0"
                              >
                                🗑️
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-gray-400 font-medium">Expiration Timelock (Calendar Picker)</label>
                        <input
                          type="datetime-local"
                           required
                           value={initTimelock}
                           onChange={(e) => setInitTimelock(e.target.value)}
                           className="px-3 py-2.5 rounded-xl bg-gray-950 border border-gray-800 text-sm text-white focus:border-violet-500 focus:outline-none [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs text-gray-400 font-medium">Stellar Asset Token ID (Native Default)</label>
                        <input
                          type="text"
                          required
                          value={initToken}
                          onChange={(e) => setInitToken(e.target.value)}
                          className="px-3 py-2.5 rounded-xl bg-gray-900 border border-gray-850 text-sm font-mono text-gray-500"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="mt-2 w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all disabled:opacity-50"
                    >
                      {actionLoading ? 'Initializing Escrow on Ledger...' : 'Initialize Escrow Contract'}
                    </button>
                  </form>
                </div>
              )}

              {/* Scenario 2: Initialized, Waiting for Deposit */}
              {isInitialized && contractStatus?.state === EscrowState.Init && (
                <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4">
                  <div className="border-b border-gray-800 pb-3 mb-2">
                    <h2 className="text-lg font-bold text-white m-0">Deposit Funds to Escrow</h2>
                    <p className="text-xs text-gray-400 mt-1">Transfer assets to lock them inside the smart contract.</p>
                  </div>

                  <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/30 text-sm text-blue-300">
                    ℹ️ Only the configured depositor (<strong>{truncateAddress(contractStatus.config.depositor, 8)}</strong>) can submit this deposit.
                  </div>

                  <form onSubmit={handleDeposit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs text-gray-400 font-medium">Amount to Lock (XLM)</label>
                      <input
                        type="number"
                        step="0.0000001"
                        required
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="e.g. 100"
                        className="px-3 py-2.5 rounded-xl bg-gray-955 border border-gray-800 text-sm font-mono text-white focus:border-violet-500 focus:outline-none"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={actionLoading || userAddress !== contractStatus.config.depositor}
                      className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-all disabled:opacity-50"
                    >
                      {userAddress !== contractStatus.config.depositor
                        ? 'Connected Account is Not The Depositor'
                        : actionLoading
                        ? 'Confirming Transaction in Wallet...'
                        : `Deposit & Lock ${depositAmount || '0'} XLM`}
                    </button>
                  </form>
                </div>
              )}

              {/* Scenario 3: Deposited, Active Escrow */}
              {isInitialized && contractStatus?.state === EscrowState.Deposited && (
                <div className="glass-panel p-6 rounded-2xl flex flex-col gap-6">
                  <div>
                    <h2 className="text-lg font-bold text-white m-0">Escrow Resolution Operations</h2>
                    <p className="text-xs text-gray-400 mt-1">Submit release approval or claim expired timelock refund.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Release Option */}
                    <div className="p-5 rounded-xl bg-gray-900/60 border border-gray-800 flex flex-col justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-white">1. Approve & Release Split</span>
                        <p className="text-xs text-gray-400">
                          Authorized Arbiter triggers the transaction to split and distribute the locked funds to recipients.
                        </p>
                      </div>

                      <button
                        onClick={handleRelease}
                        disabled={actionLoading || userAddress !== contractStatus.config.arbiter}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-50 disabled:bg-gray-800 disabled:text-gray-500 transition-all"
                      >
                        {userAddress !== contractStatus.config.arbiter ? 'Arbiter Only' : 'Release Split Payment'}
                      </button>
                    </div>

                    {/* Refund Option */}
                    <div className="p-5 rounded-xl bg-gray-900/60 border border-gray-800 flex flex-col justify-between gap-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-bold text-white">2. Claim Refund</span>
                        <p className="text-xs text-gray-400">
                          Depositor can reclaim all locked funds if the specified time lock has expired.
                        </p>
                      </div>

                      <button
                        onClick={handleRefund}
                        disabled={actionLoading || userAddress !== contractStatus.config.depositor || !isTimelockExpired()}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold bg-red-955/40 hover:bg-red-900/60 text-red-400 border border-red-900/30 disabled:opacity-50 disabled:bg-gray-800 disabled:text-gray-500 disabled:border-transparent transition-all"
                      >
                        {!isTimelockExpired()
                          ? 'Timelock Active'
                          : userAddress !== contractStatus.config.depositor
                          ? 'Depositor Only'
                          : 'Claim Timelock Refund'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Scenario 4: Finished (Released / Refunded) */}
              {isInitialized && (contractStatus?.state === EscrowState.Released || contractStatus?.state === EscrowState.Refunded) && (
                <div className="glass-panel p-6 rounded-2xl text-center py-12 flex flex-col items-center gap-4">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl ${contractStatus?.state === EscrowState.Released ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/30' : 'bg-red-950/40 text-red-400 border border-red-900/30'}`}>
                    {contractStatus?.state === EscrowState.Released ? '✅' : '↩️'}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">This Escrow Has Been Resolved</h3>
                    <p className="text-sm text-gray-450 max-w-md mx-auto mt-2">
                      {contractStatus?.state === EscrowState.Released
                        ? 'All locked funds have been successfully split and released to the recipients according to their weights.'
                        : 'The timelock expired, and the locked funds have been refunded back to the depositor account.'}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

        </div>

        {/* Right Column (Live Contract Status) */}
      <div className="flex flex-col gap-6">
        <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4 relative overflow-hidden">
          <h2 className="text-base font-bold text-white border-b border-gray-800 pb-3 mb-2 flex items-center gap-2">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${walletConnected && isInitialized ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            Live Contract Status
          </h2>

          {!walletConnected ? (
            <div className="py-8 px-4 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-violet-950/40 border border-violet-800/30 flex items-center justify-center text-2xl text-violet-400 animate-pulse-slow">
                🔒
              </div>
              <div>
                <h3 className="text-sm font-bold text-white mb-1">Contract Data Encrypted</h3>
                <p className="text-xs text-gray-400 max-w-[240px] mx-auto leading-relaxed">
                  Please connect your Freighter wallet to verify contract state, view recipient weights, and authorize split payments.
                </p>
              </div>
            </div>
          ) : loading ? (
            <div className="py-6 text-center text-sm text-gray-500">Querying ledger entries...</div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center text-sm py-2 border-b border-gray-900">
                <span className="text-gray-400 font-medium">Escrow State</span>
                {isInitialized ? (
                  <span className={`px-2.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${getEscrowStateLabel(contractStatus!.state).color}`}>
                    {getEscrowStateLabel(contractStatus!.state).text}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider bg-amber-950/40 text-amber-400 border-amber-900/30">
                    Uninitialized
                  </span>
                )}
              </div>
              
              <div className="flex justify-between items-center text-sm py-2 border-b border-gray-900">
                <span className="text-gray-400 font-medium">Amount Locked</span>
                <span className="font-mono text-white text-base font-bold">
                  {contractStatus ? formatAmount(contractStatus.amount_locked) : '0'} XLM
                </span>
              </div>

              <div className="flex flex-col gap-1.5 text-sm py-2 border-b border-gray-900">
                <span className="text-gray-400 font-medium">Contract ID</span>
                <CopyableAddress address={CONTRACT_ID} />
              </div>

              {contractStatus?.config && (
                <>
                  <div className="flex flex-col gap-1.5 text-sm py-2 border-b border-gray-900">
                    <span className="text-gray-400 font-medium">Depositor Address</span>
                    <CopyableAddress address={contractStatus.config.depositor} />
                  </div>

                  <div className="flex flex-col gap-1.5 text-sm py-2 border-b border-gray-900">
                    <span className="text-gray-400 font-medium">Arbiter Address</span>
                    <CopyableAddress address={contractStatus.config.arbiter} />
                  </div>

                  <div className="flex flex-col gap-1.5 text-sm py-2 border-b border-gray-900">
                    <span className="text-gray-400 font-medium">Recipients & Splits</span>
                    <div className="flex flex-col gap-2 mt-1 bg-gray-950/50 p-2.5 rounded-xl border border-gray-900">
                      {contractStatus.config.recipients.map((rec, i) => (
                        <div key={rec} className="flex flex-col gap-1.5 pb-2.5 border-b border-gray-900/60 last:border-0 last:pb-0 last:mb-0">
                          <CopyableAddress address={rec} />
                          <div className="flex justify-end">
                            <span className="font-mono font-bold text-violet-400 text-[10px] bg-violet-950/30 px-2 py-0.5 rounded border border-violet-900/20">
                              Weight: {contractStatus.config.shares[i]}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-sm py-2 border-b border-gray-900">
                    <span className="text-gray-400 font-medium">Timelock Expiry</span>
                    <span className={`text-xs font-semibold ${isTimelockExpired() ? 'text-red-400' : 'text-gray-300'}`}>
                      {new Date(Number(contractStatus.config.timelock) * 1000).toLocaleString()}
                      {isTimelockExpired() && ' (Expired)'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-1.5 text-sm py-2">
                    <span className="text-gray-400 font-medium">Token Address</span>
                    <CopyableAddress address={contractStatus.config.token} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      </main>
    </div>
  );
}

export default App;
