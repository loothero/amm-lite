import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { BrowseComponent } from './browse/browse.component';
import { ManageComponent } from './manage/manage.component';
import { KamiComponent } from './kami/kami.component';
import { PoolComponent } from './pool/pool.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'browse/:label/:address', component: BrowseComponent },
  { path: 'manage/:label/:address', component: ManageComponent },
  { path: 'pool/:label/:address', component: PoolComponent },
  { path: 'kami/:id', component: KamiComponent },
  { path: '**', redirectTo: '' }
];
