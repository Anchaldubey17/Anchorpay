#![no_std]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, token, Address, Env, Vec
};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InvalidState = 3,
    Unauthorized = 4,
    TimelockNotExpired = 5,
    InvalidShares = 6,
    EmptyRecipients = 7,
    InvalidAmount = 8,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EscrowState {
    Init = 0,
    Deposited = 1,
    Released = 2,
    Refunded = 3,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct EscrowConfig {
    pub depositor: Address,
    pub recipients: Vec<Address>,
    pub shares: Vec<u32>,
    pub arbiter: Address,
    pub timelock: u64,
    pub token: Address,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct EscrowStatus {
    pub state: EscrowState,
    pub config: EscrowConfig,
    pub amount_locked: i128,
}

#[contracttype]
pub enum DataKey {
    State,
    Config,
    AmountLocked,
}

#[contract]
pub struct AnchorpayContract;

#[contractimpl]
impl AnchorpayContract {
    /// Initializes the contract config.
    pub fn initialize(
        env: Env,
        depositor: Address,
        recipients: Vec<Address>,
        shares: Vec<u32>,
        arbiter: Address,
        timelock: u64,
        token: Address,
    ) -> Result<(), ContractError> {
        if env.storage().instance().has(&DataKey::State) {
            return Err(ContractError::AlreadyInitialized);
        }

        if recipients.is_empty() {
            return Err(ContractError::EmptyRecipients);
        }

        if recipients.len() != shares.len() {
            return Err(ContractError::InvalidShares);
        }

        let mut total_shares: u32 = 0;
        for share in shares.iter() {
            if share == 0 {
                return Err(ContractError::InvalidShares);
            }
            total_shares += share;
        }

        if total_shares == 0 {
            return Err(ContractError::InvalidShares);
        }

        let config = EscrowConfig {
            depositor,
            recipients,
            shares,
            arbiter,
            timelock,
            token,
        };
        env.storage().instance().set(&DataKey::Config, &config);
        env.storage().instance().set(&DataKey::State, &EscrowState::Init);
        env.storage().instance().set(&DataKey::AmountLocked, &0i128);

        Ok(())
    }

    /// Deposits funds into the contract. Requires authorization from the depositor.
    pub fn deposit(env: Env, amount: i128) -> Result<(), ContractError> {
        if !env.storage().instance().has(&DataKey::State) {
            return Err(ContractError::NotInitialized);
        }

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        if state != EscrowState::Init {
            return Err(ContractError::InvalidState);
        }

        if amount <= 0 {
            return Err(ContractError::InvalidAmount);
        }

        let config: EscrowConfig = env.storage().instance().get(&DataKey::Config).unwrap();
        
        // Enforce access control - require depositor signature
        config.depositor.require_auth();

        // Transfer token from depositor to the contract
        let token_client = token::Client::new(&env, &config.token);
        token_client.transfer(&config.depositor, &env.current_contract_address(), &amount);

        env.storage().instance().set(&DataKey::State, &EscrowState::Deposited);
        env.storage().instance().set(&DataKey::AmountLocked, &amount);

        Ok(())
    }

    /// Releases locked funds to the recipients. Requires authorization from the arbiter.
    pub fn release(env: Env) -> Result<(), ContractError> {
        if !env.storage().instance().has(&DataKey::State) {
            return Err(ContractError::NotInitialized);
        }

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        if state != EscrowState::Deposited {
            return Err(ContractError::InvalidState);
        }

        let config: EscrowConfig = env.storage().instance().get(&DataKey::Config).unwrap();
        let amount_locked: i128 = env.storage().instance().get(&DataKey::AmountLocked).unwrap();
        
        // Enforce access control - require arbiter signature
        config.arbiter.require_auth();

        let token_client = token::Client::new(&env, &config.token);
        
        let mut total_shares: u32 = 0;
        for share in config.shares.iter() {
            total_shares += share;
        }

        let mut total_sent: i128 = 0;
        let num_recipients = config.recipients.len();

        for i in 0..num_recipients {
            let recipient = config.recipients.get(i).unwrap();
            let share = config.shares.get(i).unwrap();
            
            let amount_to_send = if i == num_recipients - 1 {
                amount_locked - total_sent
            } else {
                (amount_locked * (share as i128)) / (total_shares as i128)
            };

            if amount_to_send > 0 {
                token_client.transfer(&env.current_contract_address(), &recipient, &amount_to_send);
                total_sent += amount_to_send;
            }
        }

        env.storage().instance().set(&DataKey::State, &EscrowState::Released);
        env.storage().instance().set(&DataKey::AmountLocked, &0i128);

        Ok(())
    }

    /// Refunds locked funds to the depositor if the timelock is expired. Requires authorization from the depositor.
    pub fn refund(env: Env) -> Result<(), ContractError> {
        if !env.storage().instance().has(&DataKey::State) {
            return Err(ContractError::NotInitialized);
        }

        let state: EscrowState = env.storage().instance().get(&DataKey::State).unwrap();
        if state != EscrowState::Deposited {
            return Err(ContractError::InvalidState);
        }

        let config: EscrowConfig = env.storage().instance().get(&DataKey::Config).unwrap();
        let amount_locked: i128 = env.storage().instance().get(&DataKey::AmountLocked).unwrap();

        // Enforce time lock
        if env.ledger().timestamp() < config.timelock {
            return Err(ContractError::TimelockNotExpired);
        }

        // Enforce access control - require depositor signature
        config.depositor.require_auth();

        let token_client = token::Client::new(&env, &config.token);
        token_client.transfer(&env.current_contract_address(), &config.depositor, &amount_locked);

        env.storage().instance().set(&DataKey::State, &EscrowState::Refunded);
        env.storage().instance().set(&DataKey::AmountLocked, &0i128);

        Ok(())
    }

    /// Queries the status of the escrow.
    pub fn get_status(env: Env) -> Result<EscrowStatus, ContractError> {
        if !env.storage().instance().has(&DataKey::State) {
            return Err(ContractError::NotInitialized);
        }

        let state = env.storage().instance().get(&DataKey::State).unwrap();
        let config = env.storage().instance().get(&DataKey::Config).unwrap();
        let amount_locked = env.storage().instance().get(&DataKey::AmountLocked).unwrap();

        Ok(EscrowStatus {
            state,
            config,
            amount_locked,
        })
    }
}

#[cfg(test)]
mod test;
