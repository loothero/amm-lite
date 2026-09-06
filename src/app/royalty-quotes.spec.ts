import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CairoCustomEnum, Contract, RpcProvider } from 'starknet';
import { BrowseComponent } from './browse/browse.component';
import { ManageComponent } from './manage/manage.component';
import { PoolComponent } from './pool/pool.component';
import { WalletService } from './services/wallet.service';
import { NFTService, TransactionStatus } from './services/nft.service';
import { STARKNET_CHAIN_ID } from './services/address';

const PAIR = '0x123';
const WALLET = '0x456';

function quote(assetId: bigint, count: bigint) {
  return {
    error: new CairoCustomEnum({ OK: {} }),
    new_spot_price: 1000n,
    new_delta: 0n,
    // Model token-specific royalties so a quote for ID zero cannot pass.
    amount: 1000n + assetId * 10n + count,
    protocol_fee: 0n,
    royalty_amount: assetId * 10n,
  };
}

describe('ERC721 royalty quote selection', () => {
  let contractCall: jasmine.Spy;
  let inventory: bigint[];
  let inventoryResponse: () => any;
  let nftService: any;
  let wallet: any;
  let quoteResponse: (assetId: bigint, count: bigint) => any;

  beforeEach(async () => {
    inventory = [71n, 2n];
    inventoryResponse = () => inventory;
    quoteResponse = quote;
    wallet = {
      getProvider: () => new RpcProvider({ nodeUrl: 'http://localhost:5050' }),
      isConnected: signal(false),
      currentChainIdNum: signal(STARKNET_CHAIN_ID.SN_SEPOLIA),
      walletAddress: signal(WALLET),
      getCurrentChain: () => ({
        id: STARKNET_CHAIN_ID.SN_SEPOLIA,
        nativeCurrency: { symbol: 'ETH' },
      }),
      fetchBalance: () => Promise.resolve(),
    };
    nftService = {
      buyNFT: jasmine.createSpy('buyNFT').and.resolveTo({ status: TransactionStatus.IDLE }),
      sellNFTs: jasmine.createSpy('sellNFTs').and.resolveTo({ status: TransactionStatus.IDLE }),
      resetTransactionStatus: jasmine.createSpy('resetTransactionStatus'),
      transactionStatus$: of(TransactionStatus.IDLE),
      detectPairVersion: () => Promise.resolve('v2'),
    };
    await TestBed.configureTestingModule({
      imports: [PoolComponent, BrowseComponent, ManageComponent],
      providers: [
        provideRouter([]),
        { provide: WalletService, useValue: wallet },
        { provide: NFTService, useValue: nftService },
      ],
    }).compileComponents();
    contractCall = spyOn(Contract.prototype as any, 'call').and.callFake(
      async (method: string, args: bigint[]) => {
        if (method === 'get_all_ids') return inventoryResponse();
        if (method === 'nft') return 0x789n;
        if (method === 'owner') return BigInt(WALLET);
        if (method === 'token') return 0x777n;
        if (method === 'is_approved_for_all') return false;
        if (method === 'get_buy_nft_quote' || method === 'get_sell_nft_quote') {
          return quoteResponse(args[0], args[1]);
        }
        throw new Error(`Unexpected contract call: ${method}`);
      },
    );
  });

  function pool(): PoolComponent {
    const component = TestBed.createComponent(PoolComponent).componentInstance;
    component.pairAddress.set(PAIR);
    component.pairVersion.set('v2');
    component.nftContractAddress.set('0x789');
    return component;
  }

  function quotes(method: string): bigint[][] {
    return contractCall.calls.allArgs().filter(args => args[0] === method).map(args => args[1]);
  }

  it('quotes buys using the first submitted ID, preserving selected/custom dedupe order', async () => {
    const component = pool();
    component.selectedBuyIds.set([42n, 7n]);
    component.customBuyIds.set([7n, 99n]);
    await component.refreshBuyQuote();
    await component.buy();
    expect(quotes('get_buy_nft_quote')).toEqual([[42n, 3n]]);
    expect(nftService.buyNFT).toHaveBeenCalledWith(jasmine.objectContaining({
      nftIds: [42n, 7n, 99n], price: 1423n,
    }));
  });

  it('quotes sells using the first entered ID and submits the same order and bound', async () => {
    const component = pool();
    component.sellTokenIdsInput = '91, 3';
    await component.refreshSellQuote();
    await component.sell();
    expect(quotes('get_sell_nft_quote')).toEqual([[91n, 2n]]);
    expect(nftService.sellNFTs).toHaveBeenCalledWith(jasmine.objectContaining({
      nftIds: [91n, 3n], minOutput: 1912n,
    }));
  });

  it('previews the first inventory ID without changing the buy selection', async () => {
    const component = pool();
    component.inventoryIds.set([8n, 2n]);
    await component.refreshBuyQuote();
    expect(quotes('get_buy_nft_quote')).toEqual([[8n, 1n]]);
    expect(component.effectiveBuyIds()).toEqual([]);
    expect(component.buyPrice()).toBe(1081n);
  });

  it('quotes and buys the first listed NFT without sorting its inventory', async () => {
    const component = TestBed.createComponent(BrowseComponent).componentInstance;
    await component.fetchNFTIdsForPairs([PAIR]);
    await component.buyNFT(component.listingsData()[0]);
    expect(quotes('get_buy_nft_quote')).toEqual([[71n, 1n]]);
    expect(nftService.buyNFT).toHaveBeenCalledWith(jasmine.objectContaining({
      nftIds: [71n], price: 1711n,
    }));
  });

  it('quotes each manage card for its own token and uses that token-specific price', async () => {
    inventory = [9n, 2n];
    const component = TestBed.createComponent(ManageComponent).componentInstance;
    component.address = PAIR;
    spyOn(component, 'fetchNFTMetadata').and.resolveTo();
    await component.fetchNFTIds(PAIR);
    expect(quotes('get_buy_nft_quote')).toEqual([[9n, 1n], [2n, 1n]]);
    expect(component.nftDataList().map(nft => nft.price)).toEqual([1091n, 1021n]);
    await component.buyNFT(2n);
    expect(nftService.buyNFT).toHaveBeenCalledWith(jasmine.objectContaining({
      nftIds: [2n], price: 1021n,
    }));
  });

  it('keeps an explicit token ID zero instead of substituting the selected manage ID', async () => {
    inventory = [9n, 0n];
    const component = TestBed.createComponent(ManageComponent).componentInstance;
    component.address = PAIR;
    spyOn(component, 'fetchNFTMetadata').and.resolveTo();
    await component.fetchNFTIds(PAIR);
    await component.buyNFT(0n);
    expect(nftService.buyNFT).toHaveBeenCalledWith(jasmine.objectContaining({
      nftIds: [0n], price: 1001n,
    }));
  });

  it('preserves full-width token IDs and treats zero as an actual selected ID', async () => {
    const component = pool();
    const id = (1n << 160n) + 7n;
    component.selectedBuyIds.set([id, 0n]);
    await component.refreshBuyQuote();
    component.sellTokenIdsInput = `0, ${id}`;
    await component.refreshSellQuote();
    expect(quotes('get_buy_nft_quote')).toEqual([[id, 2n]]);
    expect(quotes('get_sell_nft_quote')).toEqual([[0n, 2n]]);
  });

  it('does not invent ID-zero quotes when inventory and selections are empty', async () => {
    const component = pool();
    await component.refreshBuyQuote();
    await component.refreshSellQuote();
    expect(quotes('get_buy_nft_quote')).toEqual([]);
    expect(quotes('get_sell_nft_quote')).toEqual([]);
    expect(component.buyPrice()).toBeNull();
    expect(component.sellPrice()).toBeNull();
    expect(component.sellQuoteError()).toContain('Enter NFT IDs');
  });

  it('keeps sell-ID entry visible before a quote exists', async () => {
    const fixture = TestBed.createComponent(PoolComponent);
    const component = fixture.componentInstance;
    spyOn(component, 'loadPool').and.resolveTo();
    component.pairAddress.set(PAIR);
    component.pairVersion.set('v2');
    wallet.isConnected.set(true);
    await component.refreshSellQuote();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('input[placeholder="e.g. 12, 47, 88"]')).not.toBeNull();
  });

  it('clears a previous buy bound while a new selection is being quoted', async () => {
    const component = pool();
    component.selectedBuyIds.set([5n]);
    await component.refreshBuyQuote();
    let resolve!: (value: any) => void;
    quoteResponse = () => new Promise(done => { resolve = done; });
    component.selectedBuyIds.set([6n]);
    const pending = component.refreshBuyQuote();
    expect(component.buyPrice()).toBeNull();
    await component.buy();
    expect(nftService.buyNFT).not.toHaveBeenCalled();
    resolve(quote(6n, 1n));
    await pending;
    expect(component.buyPrice()).toBe(1061n);
  });

  it('ignores a slow buy quote for an earlier selection', async () => {
    const component = pool();
    let resolve!: (value: any) => void;
    quoteResponse = (id, count) => id === 5n
      ? new Promise(done => { resolve = done; }) : quote(id, count);
    component.selectedBuyIds.set([5n]);
    const oldRequest = component.refreshBuyQuote();
    component.selectedBuyIds.set([6n]);
    await component.refreshBuyQuote();
    resolve(quote(5n, 1n));
    await oldRequest;
    expect(component.buyPrice()).toBe(1061n);
  });

  it('ignores a slow sell failure after a new selection succeeds', async () => {
    const component = pool();
    let reject!: (reason: Error) => void;
    quoteResponse = (id, count) => id === 5n
      ? new Promise((_, fail) => { reject = fail; }) : quote(id, count);
    component.sellTokenIdsInput = '5';
    const oldRequest = component.refreshSellQuote();
    component.sellTokenIdsInput = '6';
    await component.refreshSellQuote();
    reject(new Error('Old token royalty call failed'));
    await oldRequest;
    expect(component.sellPrice()).toBe(1061n);
    expect(component.sellQuoteError()).toBe('');
  });

  it('does not restore a cleared sell selection from an outstanding quote', async () => {
    const component = pool();
    let resolve!: (value: any) => void;
    quoteResponse = () => new Promise(done => { resolve = done; });
    component.sellTokenIdsInput = '5';
    const oldRequest = component.refreshSellQuote();
    component.sellTokenIdsInput = '';
    await component.refreshSellQuote();
    resolve(quote(5n, 1n));
    await oldRequest;
    expect(component.sellPrice()).toBeNull();
    await component.sell();
    expect(nftService.sellNFTs).not.toHaveBeenCalled();
  });

  it('discards a quote when the connected chain changes before it returns', async () => {
    const component = pool();
    let resolve!: (value: any) => void;
    quoteResponse = () => new Promise(done => { resolve = done; });
    component.selectedBuyIds.set([5n]);
    const request = component.refreshBuyQuote();
    wallet.currentChainIdNum.set(STARKNET_CHAIN_ID.SN_MAIN);
    resolve(quote(5n, 1n));
    await request;
    expect(component.buyPrice()).toBeNull();
  });

  it('leaves an empty browse listing unavailable without quoting ID zero', async () => {
    inventory = [];
    const component = TestBed.createComponent(BrowseComponent).componentInstance;
    await component.fetchNFTIdsForPairs([PAIR]);
    expect(quotes('get_buy_nft_quote')).toEqual([]);
    expect(component.listingsData()[0].price).toBeNull();
    await component.buyNFT(component.listingsData()[0]);
    expect(nftService.buyNFT).not.toHaveBeenCalled();
  });

  it('blocks a browse purchase after its quote returns a curve error', async () => {
    quoteResponse = (id, count) => ({
      ...quote(id, count), error: new CairoCustomEnum({ INVALID_NUMITEMS: {} }),
    });
    const component = TestBed.createComponent(BrowseComponent).componentInstance;
    await component.fetchNFTIdsForPairs([PAIR]);
    expect(component.listingsData()[0].price).toBeNull();
    await component.buyNFT(component.listingsData()[0]);
    expect(nftService.buyNFT).not.toHaveBeenCalled();
  });

  it('isolates failed manage royalties to that token and keeps valid quotes usable', async () => {
    inventory = [9n, 2n];
    quoteResponse = (id, count) => {
      if (id === 9n) throw new Error('Token royalty lookup failed');
      return quote(id, count);
    };
    const component = TestBed.createComponent(ManageComponent).componentInstance;
    component.address = PAIR;
    spyOn(component, 'fetchNFTMetadata').and.resolveTo();
    await component.fetchNFTIds(PAIR);
    expect(component.nftIds()).toEqual([9n, 2n]);
    expect(component.nftDataList().map(nft => nft.price)).toEqual([null, 1021n]);
    await component.buyNFT(9n);
    expect(nftService.buyNFT).not.toHaveBeenCalled();
    await component.buyNFT(2n);
    expect(nftService.buyNFT).toHaveBeenCalledWith(jasmine.objectContaining({
      nftIds: [2n], price: 1021n,
    }));
  });

  function useRealTransactionBuilder(component: PoolComponent): jasmine.Spy {
    const provider = wallet.getProvider();
    spyOn(provider, 'waitForTransaction').and.resolveTo({});
    wallet.getProvider = () => provider;
    const execute = jasmine.createSpy('execute').and.resolveTo({ transaction_hash: '0xabc' });
    wallet.getAccount = () => ({ execute });
    component.nftService = new NFTService(wallet);
    spyOn(component, 'loadPool').and.resolveTo();
    return execute;
  }

  it('serializes the quoted full-width first ID, original order and buy cap into the actual transaction builder', async () => {
    const component = pool();
    const execute = useRealTransactionBuilder(component);
    component.selectedBuyIds.set([(1n << 128n) + 5n, 7n]);
    await component.refreshBuyQuote();
    await component.buy();
    expect(execute).toHaveBeenCalledTimes(1);
    const calls = execute.calls.mostRecent().args[0];
    expect(calls[0].calldata.map((felt: string) => BigInt(felt))).toEqual([BigInt(PAIR), 1052n, 10n]);
    expect(calls[1].entrypoint).toBe('swap_token_for_specific_nfts');
    expect(calls[1].calldata.map((felt: string) => BigInt(felt))).toEqual([
      2n, 5n, 1n, 7n, 0n, 1052n, 10n, BigInt(WALLET), 0n, 0n,
    ]);
  });

  it('serializes ordered sell IDs and their quote bound with property-checker parameters', async () => {
    const component = pool();
    const execute = useRealTransactionBuilder(component);
    component.sellTokenIdsInput = '91, 3';
    component.propertyChecker.set('0xbeef');
    component.propertyParamsInput = '0x1, 0x2';
    await component.refreshSellQuote();
    await component.sell();
    expect(execute).toHaveBeenCalledTimes(1);
    const calls = execute.calls.mostRecent().args[0];
    expect(calls[0].entrypoint).toBe('set_approval_for_all');
    expect(calls[1].entrypoint).toBe('swap_nfts_for_token_with_property_check');
    expect(calls[1].calldata.map((felt: string) => BigInt(felt))).toEqual([
      2n, 91n, 0n, 3n, 0n, 1912n, 0n, BigInt(WALLET), 0n, 0n, 2n, 1n, 2n,
    ]);
  });

  for (const change of ['pair', 'chain', 'reload']) {
    it(`ignores an old inventory load after a ${change} change before quoting with its provider`, async () => {
      const component = pool();
      spyOn<any>(component, 'readPairView').and.resolveTo(undefined);
      const refresh = spyOn(component, 'refreshBuyQuote').and.callThrough();
      const oldProvider = wallet.getProvider();
      const newProvider = wallet.getProvider();
      wallet.getProvider = () => oldProvider;
      let requested!: () => void;
      const inventoryRequested = new Promise<void>(done => { requested = done; });
      let resolve!: (ids: bigint[]) => void;
      const oldInventory = new Promise<bigint[]>(done => { resolve = done; });
      let first = true;
      inventoryResponse = () => {
        if (!first) return [9n, 2n];
        first = false;
        requested();
        return oldInventory;
      };
      const oldLoad = component.loadPool();
      await inventoryRequested;
      if (change === 'pair') component.pairAddress.set('0xabc');
      if (change === 'chain') wallet.currentChainIdNum.set(STARKNET_CHAIN_ID.SN_MAIN);
      wallet.getProvider = () => newProvider;
      await component.loadPool();
      expect(component.inventoryIds()).toEqual([9n, 2n]);
      expect(component.buyPrice()).toBe(1091n);
      resolve([5n]);
      await oldLoad;
      expect(component.inventoryIds()).toEqual([9n, 2n]);
      expect(component.buyPrice()).toBe(1091n);
      expect(quotes('get_buy_nft_quote')).toEqual([[9n, 1n]]);
      expect(refresh.calls.allArgs()).toEqual([[newProvider]]);
    });
  }
});
