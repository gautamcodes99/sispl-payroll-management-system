import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class ComplianceCalculatorService {
  calculatePf(basic: number, da: number): number {
    const pfWages = basic + da;
    const pfAmount = pfWages * 0.12;

    return Math.min(pfAmount, 1800);
  }

  calculateEsic(
    gross: number,
    conveyance: number,
    specialAllowance: number,
  ): number {
    const esicWages = gross - conveyance - specialAllowance;

    return esicWages * 0.0075;
  }

  calculatePtax(gross: number, gender: string, salaryMonth: Date): number {
    const normalizedGender = gender.trim().toUpperCase();
    const isFebruary = salaryMonth.getUTCMonth() === 1;

    if (normalizedGender === 'FEMALE') {
      if (gross <= 25000) {
        return 0;
      }

      return isFebruary ? 300 : 200;
    }

    if (normalizedGender === 'MALE') {
      if (gross <= 7500) {
        return 0;
      }

      if (gross <= 10000) {
        return 175;
      }

      return isFebruary ? 300 : 200;
    }

    throw new BadRequestException(
      'Gender must be MALE or FEMALE for PTax calculation',
    );
  }

  calculateMlwf(salaryMonth: Date): number {
    const month = salaryMonth.getUTCMonth();

    const isJune = month === 5;
    const isDecember = month === 11;

    return isJune || isDecember ? 25 : 0;
  }
}
