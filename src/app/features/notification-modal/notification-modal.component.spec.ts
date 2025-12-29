import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NotificationModalComponent } from './notification-modal.component';

describe('NotificationModalComponent', () => {
  let component: NotificationModalComponent;
  let fixture: ComponentFixture<NotificationModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationModalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NotificationModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display the provided email', () => {
    const testEmail = 'test@example.com';
    component.email = testEmail;
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.email-address')?.textContent).toContain(testEmail);
  });

  it('should emit true on send confirmation', () => {
    spyOn(component.confirm, 'emit');
    const sendButton = fixture.nativeElement.querySelector('.btn-send');
    sendButton.click();
    expect(component.confirm.emit).toHaveBeenCalledWith(true);
  });

  it('should emit false on cancel', () => {
    spyOn(component.confirm, 'emit');
    const cancelButton = fixture.nativeElement.querySelector('.btn-cancel');
    cancelButton.click();
    expect(component.confirm.emit).toHaveBeenCalledWith(false);
  });
});
