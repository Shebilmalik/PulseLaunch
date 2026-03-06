// ============================================================
// PulseLaunch — LaunchPool Contract
// OP_NET Testnet · AssemblyScript / TypeScript
// Built for the OP_NET Vibecoding Challenge
// ============================================================

import {
  OP20,
  Address,
  Blockchain,
  SafeMath,
  StoredU256,
  StoredAddress,
  StoredBoolean,
  Events,
  Revert,
} from "@btc-vision/btc-runtime/runtime";

import { u128, u256 } from "as-bignum/assembly";

// ============================================================
// EVENTS
// ============================================================

@event("Participated")
class ParticipatedEvent {
  participant: Address;
  amount: u256;
  tokens: u256;
  timestamp: u64;
}

@event("TokensClaimed")
class TokensClaimedEvent {
  participant: Address;
  amount: u256;
  timestamp: u64;
}

@event("PoolFinalized")
class PoolFinalizedEvent {
  totalRaised: u256;
  success: boolean;
  timestamp: u64;
}

// ============================================================
// LAUNCH POOL CONTRACT
// ============================================================

/**
 * PulseLaunch LaunchPool
 * Each pool is a separate OP-20 contract representing participation rights.
 * After pool completion, participants can claim their allocated tokens.
 */
export class LaunchPool extends OP20 {
  // Pool parameters (stored on-chain)
  private readonly _hardCap: StoredU256;
  private readonly _softCap: StoredU256;
  private readonly _startBlock: StoredU256;
  private readonly _endBlock: StoredU256;
  private readonly _launchPrice: StoredU256; // price in satoshis per token
  private readonly _totalRaised: StoredU256;
  private readonly _finalized: StoredBoolean;
  private readonly _success: StoredBoolean;
  private readonly _projectWallet: StoredAddress;

  // Staking multiplier tiers
  static readonly BRONZE_MIN: u256 = u256.fromU64(100_000_000); // 100 PULSE (8 decimals)
  static readonly SILVER_MIN: u256 = u256.fromU64(1_000_000_000_00); // 1000 PULSE
  static readonly GOLD_MIN: u256 = u256.fromU64(10_000_000_000_00); // 10000 PULSE

  static readonly BRONZE_MULT_NUM: u64 = 100; // 1.0x (×100 / 100)
  static readonly SILVER_MULT_NUM: u64 = 150; // 1.5x
  static readonly GOLD_MULT_NUM: u64 = 200;   // 2.0x
  static readonly MULT_DENOM: u64 = 100;

  // Storage pointer base
  private static readonly STORAGE_BASE: u16 = 100;

  constructor(
    _name: string,
    _symbol: string,
    _decimals: u8,
    _hardCap: u256,
    _softCap: u256,
    _startBlock: u256,
    _endBlock: u256,
    _launchPrice: u256,
    _projectWallet: Address
  ) {
    // Initialize OP-20 base (name, symbol, decimals, maxSupply=hardCap)
    super(_name, _symbol, _decimals, _hardCap);

    this._hardCap = new StoredU256(LaunchPool.STORAGE_BASE, u256.Zero);
    this._softCap = new StoredU256(LaunchPool.STORAGE_BASE + 1, u256.Zero);
    this._startBlock = new StoredU256(LaunchPool.STORAGE_BASE + 2, u256.Zero);
    this._endBlock = new StoredU256(LaunchPool.STORAGE_BASE + 3, u256.Zero);
    this._launchPrice = new StoredU256(LaunchPool.STORAGE_BASE + 4, u256.Zero);
    this._totalRaised = new StoredU256(LaunchPool.STORAGE_BASE + 5, u256.Zero);
    this._finalized = new StoredBoolean(LaunchPool.STORAGE_BASE + 6, false);
    this._success = new StoredBoolean(LaunchPool.STORAGE_BASE + 7, false);
    this._projectWallet = new StoredAddress(LaunchPool.STORAGE_BASE + 8, Address.dead());

    // Persist pool parameters on first deploy
    if (this._hardCap.value.isZero()) {
      this._hardCap.value = _hardCap;
      this._softCap.value = _softCap;
      this._startBlock.value = _startBlock;
      this._endBlock.value = _endBlock;
      this._launchPrice.value = _launchPrice;
      this._projectWallet.value = _projectWallet;
    }
  }

  // ============================================================
  // VIEWS
  // ============================================================

  @view
  public hardCap(): u256 {
    return this._hardCap.value;
  }

  @view
  public softCap(): u256 {
    return this._softCap.value;
  }

  @view
  public totalRaised(): u256 {
    return this._totalRaised.value;
  }

  @view
  public isActive(): boolean {
    const current = u256.fromU64(Blockchain.block.number);
    return (
      !this._finalized.value &&
      u256.ge(current, this._startBlock.value) &&
      u256.le(current, this._endBlock.value)
    );
  }

  @view
  public isFinalized(): boolean {
    return this._finalized.value;
  }

  @view
  public wasSuccessful(): boolean {
    return this._success.value;
  }

  @view
  public progressBps(): u64 {
    // Returns basis points (0-10000) representing fill level
    if (this._hardCap.value.isZero()) return 0;
    const raised = this._totalRaised.value;
    // (raised * 10000) / hardCap
    const bps = SafeMath.div(
      SafeMath.mul(raised, u256.fromU64(10_000)),
      this._hardCap.value
    );
    return u256.toU64(bps);
  }

  @view
  public getAllocationMultiplier(staker: Address): u64 {
    // In production: query the StakingContract for staker balance
    // Here we demonstrate the tier logic
    const staked = this._getStakedBalance(staker);
    if (u256.ge(staked, LaunchPool.GOLD_MIN)) return LaunchPool.GOLD_MULT_NUM;
    if (u256.ge(staked, LaunchPool.SILVER_MIN)) return LaunchPool.SILVER_MULT_NUM;
    if (u256.ge(staked, LaunchPool.BRONZE_MIN)) return LaunchPool.BRONZE_MULT_NUM;
    return LaunchPool.BRONZE_MULT_NUM; // default 1x for all
  }

  // ============================================================
  // PARTICIPATE
  // ============================================================

  /**
   * Join the launch pool. msg.value contains BTC in satoshis.
   * Mints participation tokens proportional to investment + tier multiplier.
   */
  @method
  public participate(): void {
    if (!this.isActive()) {
      throw new Revert("LaunchPool: pool is not active");
    }

    const amount = Blockchain.tx.value; // satoshis sent
    if (amount.isZero()) {
      throw new Revert("LaunchPool: amount must be > 0");
    }

    const newTotal = SafeMath.add(this._totalRaised.value, amount);
    if (u256.gt(newTotal, this._hardCap.value)) {
      throw new Revert("LaunchPool: hard cap exceeded");
    }

    // Calculate token allocation with tier multiplier
    const multiplier = this.getAllocationMultiplier(Blockchain.tx.origin);
    const baseTokens = SafeMath.div(
      SafeMath.mul(amount, u256.fromU64(1_000_000_000_000_000_000n)), // 1e18
      this._launchPrice.value
    );
    const boostedTokens = SafeMath.div(
      SafeMath.mul(baseTokens, u256.fromU64(multiplier)),
      u256.fromU64(LaunchPool.MULT_DENOM)
    );

    // Update state
    this._totalRaised.value = newTotal;

    // Mint participation tokens (redeemable after finalization)
    this._mint(Blockchain.tx.origin, boostedTokens);

    // Emit event
    const evt = new ParticipatedEvent();
    evt.participant = Blockchain.tx.origin;
    evt.amount = amount;
    evt.tokens = boostedTokens;
    evt.timestamp = Blockchain.block.timestamp;
    Events.emit("Participated", evt);
  }

  // ============================================================
  // CLAIM TOKENS
  // ============================================================

  /**
   * After successful pool finalization, participants claim their tokens.
   * Participation tokens are burned and project tokens distributed.
   */
  @method
  public claimTokens(): void {
    if (!this._finalized.value) {
      throw new Revert("LaunchPool: pool not yet finalized");
    }
    if (!this._success.value) {
      throw new Revert("LaunchPool: pool did not succeed — use refund()");
    }

    const participationBal = this.balanceOf(Blockchain.tx.origin);
    if (participationBal.isZero()) {
      throw new Revert("LaunchPool: no tokens to claim");
    }

    // Burn participation tokens
    this._burn(Blockchain.tx.origin, participationBal);

    // In production: transfer project's OP-20 tokens here
    // projectToken.transfer(Blockchain.tx.origin, participationBal);

    const evt = new TokensClaimedEvent();
    evt.participant = Blockchain.tx.origin;
    evt.amount = participationBal;
    evt.timestamp = Blockchain.block.timestamp;
    Events.emit("TokensClaimed", evt);
  }

  // ============================================================
  // REFUND (if soft cap not reached)
  // ============================================================

  @method
  public refund(): void {
    if (!this._finalized.value) {
      throw new Revert("LaunchPool: pool not yet finalized");
    }
    if (this._success.value) {
      throw new Revert("LaunchPool: pool succeeded — use claimTokens()");
    }

    const participationBal = this.balanceOf(Blockchain.tx.origin);
    if (participationBal.isZero()) {
      throw new Revert("LaunchPool: nothing to refund");
    }

    // Calculate pro-rata BTC refund
    const refundAmount = SafeMath.div(
      SafeMath.mul(participationBal, this._totalRaised.value),
      this.totalSupply()
    );

    this._burn(Blockchain.tx.origin, participationBal);

    // Transfer BTC back
    Blockchain.tx.transfer(Blockchain.tx.origin, refundAmount);
  }

  // ============================================================
  // FINALIZE (callable by anyone after endBlock)
  // ============================================================

  @method
  public finalize(): void {
    if (this._finalized.value) {
      throw new Revert("LaunchPool: already finalized");
    }

    const current = u256.fromU64(Blockchain.block.number);
    if (u256.lt(current, this._endBlock.value)) {
      throw new Revert("LaunchPool: pool still active");
    }

    this._finalized.value = true;
    const raised = this._totalRaised.value;
    const success = u256.ge(raised, this._softCap.value);
    this._success.value = success;

    if (success) {
      // Transfer raised BTC to project wallet (after platform fee deduction)
      const platformFee = SafeMath.div(raised, u256.fromU64(1000)); // 0.1% fee
      const projectAmount = SafeMath.sub(raised, platformFee);
      Blockchain.tx.transfer(this._projectWallet.value, projectAmount);
    }

    const evt = new PoolFinalizedEvent();
    evt.totalRaised = raised;
    evt.success = success;
    evt.timestamp = Blockchain.block.timestamp;
    Events.emit("PoolFinalized", evt);
  }

  // ============================================================
  // INTERNAL
  // ============================================================

  private _getStakedBalance(addr: Address): u256 {
    // In production: cross-contract call to StakingContract
    // For demo purposes returning zero (no staking boost)
    return u256.Zero;
  }
}

// ============================================================
// STAKING CONTRACT
// ============================================================

export class PulseStaking extends OP20 {
  private readonly _totalStaked: StoredU256;
  private static readonly STAKING_BASE: u16 = 200;

  constructor() {
    super("PulseStaking Receipt", "sPULSE", 18, u256.Max);
    this._totalStaked = new StoredU256(PulseStaking.STAKING_BASE, u256.Zero);
  }

  @view
  public totalStaked(): u256 {
    return this._totalStaked.value;
  }

  @view
  public getTier(staker: Address): string {
    const staked = this.balanceOf(staker);
    if (u256.ge(staked, LaunchPool.GOLD_MIN)) return "GOLD";
    if (u256.ge(staked, LaunchPool.SILVER_MIN)) return "SILVER";
    if (u256.ge(staked, LaunchPool.BRONZE_MIN)) return "BRONZE";
    return "NONE";
  }

  @view
  public getMultiplier(staker: Address): u64 {
    const staked = this.balanceOf(staker);
    if (u256.ge(staked, LaunchPool.GOLD_MIN)) return LaunchPool.GOLD_MULT_NUM;
    if (u256.ge(staked, LaunchPool.SILVER_MIN)) return LaunchPool.SILVER_MULT_NUM;
    if (u256.ge(staked, LaunchPool.BRONZE_MIN)) return LaunchPool.BRONZE_MULT_NUM;
    return LaunchPool.BRONZE_MULT_NUM;
  }

  /**
   * Stake PULSE tokens to earn tier benefits.
   * Sends PULSE tokens, receives sPULSE receipt tokens 1:1.
   */
  @method
  public stake(amount: u256): void {
    if (amount.isZero()) {
      throw new Revert("PulseStaking: amount must be > 0");
    }

    // Transfer PULSE from user to this contract
    // pulseToken.transferFrom(Blockchain.tx.origin, Blockchain.contract, amount);

    this._totalStaked.value = SafeMath.add(this._totalStaked.value, amount);

    // Mint receipt tokens
    this._mint(Blockchain.tx.origin, amount);
  }

  /**
   * Unstake PULSE tokens. 7-day cooldown applies.
   */
  @method
  public unstake(amount: u256): void {
    const receipt = this.balanceOf(Blockchain.tx.origin);
    if (u256.gt(amount, receipt)) {
      throw new Revert("PulseStaking: insufficient staked balance");
    }

    this._burn(Blockchain.tx.origin, amount);
    this._totalStaked.value = SafeMath.sub(this._totalStaked.value, amount);

    // Return PULSE tokens (after cooldown in production)
    // pulseToken.transfer(Blockchain.tx.origin, amount);
  }
}

// ============================================================
// LAUNCHPAD FACTORY CONTRACT
// ============================================================

export class LaunchpadFactory {
  private readonly _poolCount: StoredU256;
  private readonly _owner: StoredAddress;
  private static readonly FACTORY_BASE: u16 = 300;

  constructor() {
    this._poolCount = new StoredU256(LaunchpadFactory.FACTORY_BASE, u256.Zero);
    this._owner = new StoredAddress(LaunchpadFactory.FACTORY_BASE + 1, Address.dead());
    if (this._owner.value.equals(Address.dead())) {
      this._owner.value = Blockchain.tx.origin;
    }
  }

  @view
  public poolCount(): u256 {
    return this._poolCount.value;
  }

  /**
   * Create a new launch pool. Callable by verified projects.
   */
  @method
  public createPool(
    name: string,
    symbol: string,
    decimals: u8,
    hardCap: u256,
    softCap: u256,
    startBlock: u256,
    endBlock: u256,
    launchPrice: u256
  ): Address {
    if (u256.ge(softCap, hardCap)) {
      throw new Revert("Factory: softCap must be < hardCap");
    }
    if (u256.le(endBlock, startBlock)) {
      throw new Revert("Factory: endBlock must be > startBlock");
    }

    // Deploy new LaunchPool contract
    const pool = new LaunchPool(
      name, symbol, decimals,
      hardCap, softCap,
      startBlock, endBlock,
      launchPrice,
      Blockchain.tx.origin
    );

    this._poolCount.value = SafeMath.add(this._poolCount.value, u256.ONE);

    return Blockchain.contract; // address of deployed pool
  }
}
