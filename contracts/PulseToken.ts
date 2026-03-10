import { OP20 } from '@btc-vision/btc-runtime/runtime';
import { u256 } from '@btc-vision/as-bignum/assembly';

@final
export class PulseToken extends OP20 {
    public onInstantiated(): void {
        if (!this.isInitialized) {
            const maxSupply: u256 = u256.fromU64(100000000);
            this._mint(this.deployer, maxSupply);
        }
    }
}
