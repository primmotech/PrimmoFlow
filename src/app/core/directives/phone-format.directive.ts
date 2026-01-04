import { Directive, HostListener, ElementRef, Output, EventEmitter } from '@angular/core';
import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

@Directive({
  selector: '[appPhoneFormat]',
  standalone: true
})
export class PhoneFormatDirective {
  @Output() countryDetected = new EventEmitter<{name: string, code: string}>();
  @Output() isValid = new EventEmitter<boolean>();

  constructor(private el: ElementRef) {}

  @HostListener('input', ['$event'])
  onInput(event: any) {
    let value = this.el.nativeElement.value;

    // 1. Forcer le "+" au début
    if (!value.startsWith('+')) {
      value = '+' + value.replace(/\D/g, '');
    }

    // 2. Analyser le numéro
    const phoneNumber = parsePhoneNumberFromString(value);

    if (phoneNumber) {
      // Formater pendant la saisie (ex: +33 6 12...)
      this.el.nativeElement.value = phoneNumber.formatInternational();
      
      // 3. Détection du pays et notification
      if (phoneNumber.country) {
        this.countryDetected.emit({
          name: new Intl.DisplayNames(['fr'], {type: 'region'}).of(phoneNumber.country) || phoneNumber.country,
          code: phoneNumber.country
        });
      }

      // 4. Validation de la longueur automatique
      this.isValid.emit(phoneNumber.isValid());
    } else {
      this.el.nativeElement.value = value;
      this.isValid.emit(false);
    }
  }
}