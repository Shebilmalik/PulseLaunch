import {
    OP20,
    OP20InitParameters,
    Address,
    Blockchain,
    SafeMath,
    StoredU256,
    StoredBoolean,
} from '@btc-vision/btc-runtime/runtime';
import { u256 } from 'as-bignum/assembly';

@final
export class LaunchPool extends OP20 {

    // Storage slots
    private readonly _hardCap: StoredU256 = new StoredU256(100, u256.Zero);
    private readonly _softCap: StoredU256 = new StoredU256(101, u256.Zero);
    private readonly _endBlock: StoredU256 = new StoredU256(102, u256.Zero);
    private readonly _totalRaised: StoredU256 = new StoredU256(103, u256.Zero);
    private readonly _finalized: StoredBoolean = new StoredBoolean(104, false);
    private readonly _success: StoredBoolean = new StoredBoolean(105, false);

    public override onInstantiated(): void {
        if (!this.isInitialized) {
            this.instantiate(new OP20InitParameters(
                u256.fromU64(1_000_000_000),
                18,
                'NovaBTC Launch Pool',
                'NBTC-LP'
            ));

            // Set pool parameters
            this._hardCap.value = u256.fromU64(100_000_000_000); // 1000 BTC in sats
            this._softCap.value = u256.fromU64(20_000_000_000);  // 200 BTC in sats
            this._endBlock.value = u256.fromU64(
                Blockchain.block.number + 10000
            );
        }
    }

    // Join the pool — send BTC to participate
    public participate(): void {
        const amount = Blockchain.tx.value;
        assert(!amount.isZero(), 'Amount must be > 0');

        const newTotal = SafeMath.add(
            this._totalRaised.value,
            amount
        );
        assert(
            !u256.gt(newTotal, this._hardCap.value),
            'Hard cap exceeded'
        );

        this._totalRaised.value = newTotal;
        this._mint(Blockchain.tx.origin, amount);
    }

    // Claim tokens after successful pool
    public claimTokens(): void {
        assert(this._finalized.value, 'Pool not finalized');
        assert(this._success.value, 'Pool failed — use refund');

        const bal = this.balanceOf(Blockchain.tx.origin);
        assert(!bal.isZero(), 'Nothing to claim');

        this._burn(Blockchain.tx.origin, bal);
    }

    // Refund if soft cap not reached
    public refund(): void {
        assert(this._finalized.value, 'Pool not finalized');
        assert(!this._success.value, 'Pool succeeded — use claimTokens');

        const bal = this.balanceOf(Blockchain.tx.origin);
        assert(!bal.isZero(), 'Nothing to refund');

        const refund = SafeMath.div(
            SafeMath.mul(bal, this._totalRaised.value),
            this.totalSupply()
        );

        this._burn(Blockchain.tx.origin, bal);
        Blockchain.tx.transfer(Blockchain.tx.origin, refund);
    }

    // Finalize pool after end block
    public finalize(): void {
        assert(!this._finalized.value, 'Already finalized');
        assert(
            u256.ge(
                u256.fromU64(Blockchain.block.number),
                this._endBlock.value
            ),
            'Pool still active'
        );

        this._finalized.value = true;
        this._success.value = u256.ge(
            this._totalRaised.value,
            this._softCap.value
        );
    }

    // Views
    public getHardCap(): u256 { return this._hardCap.value; }
    public getSoftCap(): u256 { return this._softCap.value; }
    public getTotalRaised(): u256 { return this._totalRaised.value; }
    public isFinalized(): bool { return this._finalized.value; }
    public isSuccess(): bool { return this._success.value; }
}
