import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { PoolComponent } from './pool.component';
import { WalletService } from '../services/wallet.service';
import { NFTService } from '../services/nft.service';
import { CHAIN_ID, CONTRACT_ADDRESSES } from '../services/address';

describe('Pool GDA risk banner', () => {
  let fixture: ComponentFixture<PoolComponent>;
  let component: PoolComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PoolComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ label: 'sepolia' })) } },
        { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } },
        { provide: WalletService, useValue: {
          isConnected: signal(true), currentChainIdNum: signal(null),
          walletAddress: signal(null), getCurrentChain: () => null,
        } },
        { provide: NFTService, useValue: {} },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PoolComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.pairAddress.set('0x123');
    component.isLoading.set(false);
    component.poolType.set(2);
  });

  function renderRisk(): string {
    // Reassess the loaded curve state just as loadPool does, then inspect the
    // actual template to catch stale fee recommendations or hidden warnings.
    (component as unknown as { assessGdaRisk(): void }).assessGdaRisk();
    fixture.detectChanges();
    return fixture.nativeElement.textContent;
  }

  it('warns on legacy GDA TRADE pools without requiring fee/delta reads', () => {
    component.bondingCurve.set(CONTRACT_ADDRESSES[CHAIN_ID.SEPOLIA].GDA_CURVE_V2!);
    const text = renderRisk();
    expect(text).toContain('GDA TRADE pool risk');
    expect(text).toContain('No trade fee is a universal protection');
    expect(text).toContain('Owners can withdraw their assets');
    expect(text).not.toContain('Raising the trade fee');
    expect(text).not.toContain('alpha of 3 or less');
  });

  it('shows unverified risk when deployment metadata is unavailable', () => {
    component.routeLabel = 'mainnet';
    component.bondingCurve.set('0x456');
    const text = renderRisk();
    expect(text).toContain('Pool curve risk is unverified');
    expect(text).toContain('has not been verified');
  });

  it('keeps one-sided GDA auctions free of the TRADE warning', () => {
    component.bondingCurve.set(CONTRACT_ADDRESSES[CHAIN_ID.SEPOLIA].GDA_CURVE_V2!);
    for (const poolType of [0, 1]) {
      component.poolType.set(poolType);
      expect(renderRisk()).not.toContain('GDA TRADE pool risk');
      expect(component.gdaWarning()).toBeNull();
    }
  });
});
