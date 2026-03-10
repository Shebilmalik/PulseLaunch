import {
    OP20,
    OP20InitParameters,
    Blockchain,
    SafeMath,
    StoredU256,
} from '@btc-vision/btc-runtime/runtime';
import { u256 } from 'as-bignum/assembly';

@final
export class PulseStaking extends OP20 {

    private readonly _totalStaked: StoredU256 = new StoredU256(200, u256.Zero);

    // Tier thresholds (PULSE tokens)
    static readonly BRONZE: u256 = u256.fromU64(100);
    static readonly SILVER: u256 = u256.fromU64(1_000);
    static readonly GOLD: u256 = u256.fromU64(10_000);

    public override onInstantiated(): void {
        if (!this.isInitialized) {
            this.instantiate(new OP20InitParameters(
                u256.fromU64(100_000_000),
                18,
                'Staked PULSE',
                'sPULSE'
            ));
        }
    }

    // Stake PULSE tokens
    public stake(amount: u256): void {
        assert(!amount.isZero(), 'Amount must be > 0');
        this._totalStaked.value = SafeMath.add(
            this._totalStaked.value,
            amount
        );
        this._mint(Blockchain.tx.origin, amount);
    }

    // Unstake PULSE tokens
    public unstake(amount: u256): void {
        const bal = this.balanceOf(Blockchain.tx.origin);
        assert(u256.ge(bal, amount), 'Insufficient staked balance');
        this._burn(Blockchain.tx.origin, amount);
        this._totalStaked.value = SafeMath.sub(
            this._totalStaked.value,
            amount
        );
    }

    // Get tier of address
    public getTier(addr: Address): string {
        const staked = this.balanceOf(addr);
        if (u256.ge(staked, PulseStaking.GOLD)) return 'GOLD';
        if (u256.ge(staked, PulseStaking.SILVER)) return 'SILVER';
        if (u256.ge(staked, PulseStaking.BRONZE)) return 'BRONZE';
        return 'NONE';
    }

    // Get multiplier (100 = 1x, 150 = 1.5x, 200 = 2x)
    public getMultiplier(addr: Address): u64 {
        const staked = this.balanceOf(addr);
        if (u256.ge(staked, PulseStaking.GOLD)) return 200;
        if (u256.ge(staked, PulseStaking.SILVER)) return 150;
        if (u256.ge(staked, PulseStaking.BRONZE)) return 100;
        return 100;
    }

    public getTotalStaked(): u256 {
        return this._totalStaked.value;
    }
}
