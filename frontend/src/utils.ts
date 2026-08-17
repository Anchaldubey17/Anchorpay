import { EscrowState } from './contracts/anchorpay/src/index';

export const formatAmount = (bigIntValue: bigint | number | string) => {
  const val = typeof bigIntValue === 'string' ? parseFloat(bigIntValue) : Number(bigIntValue);
  return (val / 10000000).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 7 });
};

export const getEscrowStateLabel = (stateNum: EscrowState) => {
  switch (stateNum) {
    case EscrowState.Init: 
      return { text: 'Initialized / Waiting for Deposit', color: 'bg-blue-950 text-blue-400 border-blue-900/30' };
    case EscrowState.Deposited: 
      return { text: 'Deposited / Active Escrow', color: 'bg-amber-950 text-amber-400 border-amber-900/30' };
    case EscrowState.Released: 
      return { text: 'Released / Completed', color: 'bg-emerald-950 text-emerald-400 border-emerald-900/30' };
    case EscrowState.Refunded: 
      return { text: 'Refunded / Closed', color: 'bg-red-950 text-red-400 border-red-900/30' };
    default: 
      return { text: 'Unknown', color: 'bg-gray-800 text-gray-400 border-gray-700' };
  }
};
