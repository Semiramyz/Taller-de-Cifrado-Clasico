import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Cifrado } from './cifrado';

describe('Cifrado', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Cifrado],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
  });

  it('should create the page', () => {
    const fixture = TestBed.createComponent(Cifrado);
    const page = fixture.componentInstance;
    expect(page).toBeTruthy();
  });

  it('should render the crypto analysis title', async () => {
    const fixture = TestBed.createComponent(Cifrado);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Taller de cifrado clásico');
  });
});
