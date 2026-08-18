#![cfg(test)]
use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{self, StellarAssetClient},
    Address, Env, Vec,
};

#[test]
fn test_escrow_split_flow() {
    let env = Env::default();
    env.mock_all_auths();

    // 1. Generate test addresses
    let depositor = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);
    let token_issuer = Address::generate(&env);

    // 2. Register mock token contract (Stellar Asset Contract)
    let sac = env.register_stellar_asset_contract_v2(token_issuer.clone());
    let token_id = sac.address();
    let token_admin = StellarAssetClient::new(&env, &token_id);
    let token_client = token::Client::new(&env, &token_id);

    // 3. Mint tokens to the depositor
    token_admin.mint(&depositor, &1000i128);
    assert_eq!(token_client.balance(&depositor), 1000i128);

    // 4. Register our Escrow Contract
    let contract_id = env.register(AnchorpayContract, ());
    let client = AnchorpayContractClient::new(&env, &contract_id);

    // 5. Initialize contract
    let mut recipients = Vec::new(&env);
    recipients.push_back(recipient1.clone());
    recipients.push_back(recipient2.clone());

    let mut shares = Vec::new(&env);
    shares.push_back(1u32); // Recipient 1 gets 1 share (25%)
    shares.push_back(3u32); // Recipient 2 gets 3 shares (75%)

    let timelock = 1000u64;

    client.initialize(
        &depositor,
        &recipients,
        &shares,
        &arbiter,
        &timelock,
        &token_id,
    );

    // Verify initial status
    let status = client.get_status();
    assert_eq!(status.state, EscrowState::Init);
    assert_eq!(status.amount_locked, 0i128);

    // 6. Deposit funds
    client.deposit(&1000i128);

    // Verify balances after deposit
    assert_eq!(token_client.balance(&depositor), 0i128);
    assert_eq!(token_client.balance(&contract_id), 1000i128);

    let status = client.get_status();
    assert_eq!(status.state, EscrowState::Deposited);
    assert_eq!(status.amount_locked, 1000i128);

    // 7. Release funds
    client.release();

    // Verify splits are distributed correctly (1:3 split)
    // Recipient 1 receives 1000 * 1 / 4 = 250
    // Recipient 2 receives 1000 * 3 / 4 = 750
    assert_eq!(token_client.balance(&recipient1), 250i128);
    assert_eq!(token_client.balance(&recipient2), 750i128);
    assert_eq!(token_client.balance(&contract_id), 0i128);

    // Verify state after release
    let status = client.get_status();
    assert_eq!(status.state, EscrowState::Released);
    assert_eq!(status.amount_locked, 0i128);
}

#[test]
fn test_escrow_refund_flow() {
    let env = Env::default();
    env.mock_all_auths();

    // 1. Generate test addresses
    let depositor = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let token_issuer = Address::generate(&env);

    // 2. Register mock token
    let sac = env.register_stellar_asset_contract_v2(token_issuer.clone());
    let token_id = sac.address();
    let token_admin = StellarAssetClient::new(&env, &token_id);
    let token_client = token::Client::new(&env, &token_id);

    token_admin.mint(&depositor, &1000i128);

    // 3. Register our Escrow Contract
    let contract_id = env.register(AnchorpayContract, ());
    let client = AnchorpayContractClient::new(&env, &contract_id);

    // 4. Initialize and Deposit
    let mut recipients = Vec::new(&env);
    recipients.push_back(recipient1.clone());

    let mut shares = Vec::new(&env);
    shares.push_back(1u32);

    let timelock = 1000u64;

    client.initialize(
        &depositor,
        &recipients,
        &shares,
        &arbiter,
        &timelock,
        &token_id,
    );
    client.deposit(&1000i128);

    // Verify contract has the balance
    assert_eq!(token_client.balance(&contract_id), 1000i128);

    // Set ledger time past the timelock
    env.ledger().set_timestamp(timelock + 1);

    // 5. Refund
    client.refund();

    // Verify refund returns funds to depositor
    assert_eq!(token_client.balance(&depositor), 1000i128);
    assert_eq!(token_client.balance(&contract_id), 0i128);

    let status = client.get_status();
    assert_eq!(status.state, EscrowState::Refunded);
}

#[test]
fn test_errors() {
    let env = Env::default();
    env.mock_all_auths();

    // Generate addresses
    let depositor = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let token_issuer = Address::generate(&env);

    // Register mock token
    let sac = env.register_stellar_asset_contract_v2(token_issuer);
    let token_id = sac.address();

    // Register contract
    let contract_id = env.register(AnchorpayContract, ());
    let client = AnchorpayContractClient::new(&env, &contract_id);

    let mut recipients = Vec::new(&env);
    recipients.push_back(recipient1.clone());

    let mut shares = Vec::new(&env);
    shares.push_back(1u32);

    // 1. Initialize
    client.initialize(&depositor, &recipients, &shares, &arbiter, &1000u64, &token_id);

    // 2. Double initialization should fail
    let res = client.try_initialize(&depositor, &recipients, &shares, &arbiter, &1000u64, &token_id);
    assert!(res.is_err());

    // 3. Deposit invalid amount (0) should fail
    let res_dep = client.try_deposit(&0i128);
    assert!(res_dep.is_err());

    // 4. Release before deposit should fail
    let res_rel = client.try_release();
    assert!(res_rel.is_err());

    // 5. Refund before deposit should fail
    let res_ref = client.try_refund();
    assert!(res_ref.is_err());
}
