#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env, Symbol};

#[contract]
pub struct AnchorpayContract;

#[contractimpl]
impl AnchorpayContract {
    /// Initializes the contract with an admin/depositor address.
    pub fn initialize(env: Env, depositor: Address) {
        if env.storage().instance().has(&Symbol::new(&env, "depositor")) {
            panic!("already initialized");
        }
        env.storage().instance().set(&Symbol::new(&env, "depositor"), &depositor);
    }

    /// Read function to get the depositor address.
    pub fn get_depositor(env: Env) -> Option<Address> {
        env.storage().instance().get(&Symbol::new(&env, "depositor"))
    }
}
