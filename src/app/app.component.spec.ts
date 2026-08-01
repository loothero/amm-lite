import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      // AppComponent renders a <router-outlet> and injects ActivatedRoute; the
      // scaffold spec never provided a router, so it threw NullInjectorError.
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  // The two `ng new` scaffold tests that used to live here asserted a `title`
  // property and a "Hello, amm-lite" <h1>. Neither has ever existed on this
  // AppComponent, so the spec did not type-check and `ng test` could not run at
  // all — which is why the suite had no other specs. Removed rather than
  // rewritten: there is no title to assert.
});
