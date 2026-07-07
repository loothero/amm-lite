import { Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { WalletService } from './services/wallet.service';
import { shortAddress } from './services/format.util';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  walletService = inject(WalletService);

  shortAddress = shortAddress;

  shortBalance(): string {
    const b = parseFloat(this.walletService.balance() || '0');
    if (!isFinite(b)) return '0';
    if (b === 0) return '0';
    if (b < 0.0001) return b.toExponential(1);
    if (b < 1) return b.toFixed(4);
    return b.toFixed(3);
  }

  nativeSymbol(): string {
    return this.walletService.getCurrentChain()?.nativeCurrency.symbol ?? 'ETH';
  }

  async connect(): Promise<void> {
    await this.walletService.connectWallet();
  }

  async disconnect(): Promise<void> {
    await this.walletService.disconnectWallet();
  }

  // Chain ids are Starknet felt hex strings (not EVM numbers) since the
  // Starknet port.
  async switchChain(id: string): Promise<void> {
    await this.walletService.switchChain(id);
  }
}
