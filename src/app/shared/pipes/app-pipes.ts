import { Pipe, PipeTransform } from '@angular/core';
import { DateInput, formatCurrency, formatDate, formatNumber } from '../utils/format';

/** {{ value | appDate }} -> 05 Oct 2026 ; {{ value | appDate:'datetime' }} ; 'time' */
@Pipe({ name: 'appDate', standalone: true })
export class AppDatePipe implements PipeTransform {
  transform(value: DateInput, mode: 'date' | 'datetime' | 'time' = 'date'): string {
    return formatDate(value, mode);
  }
}

/** {{ value | appCurrency }} -> ₹1,23,456.00 ; {{ value | appCurrency:'INR':0 }} */
@Pipe({ name: 'appCurrency', standalone: true })
export class AppCurrencyPipe implements PipeTransform {
  transform(value: number | string | null | undefined, currency = 'INR', digits = 2): string {
    return formatCurrency(value, currency, digits);
  }
}

/** {{ value | appNumber }} -> 1,234.5 ; {{ value | appNumber:3 }} max 3 decimals ; {{ value | appNumber:2:2 }} fixed */
@Pipe({ name: 'appNumber', standalone: true })
export class AppNumberPipe implements PipeTransform {
  transform(value: number | string | null | undefined, maxDigits = 2, minDigits = 0): string {
    return formatNumber(value, maxDigits, minDigits);
  }
}
