import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PromoAngular } from './promo-angular';

describe('PromoAngular', () => {
  let component: PromoAngular;
  let fixture: ComponentFixture<PromoAngular>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PromoAngular]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PromoAngular);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
