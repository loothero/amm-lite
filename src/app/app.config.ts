import { ApplicationConfig, inject, provideAppInitializer, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';
import { loadDeployments } from './services/deployments';
import { WalletService } from './services/wallet.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withHashLocation()),
    // Load the lssvm2-starknet devnet deployments file (if present) before
    // the app renders, so contract addresses/chain config are in place.
    provideAppInitializer(() => loadDeployments(inject(WalletService))),
  ]
};
