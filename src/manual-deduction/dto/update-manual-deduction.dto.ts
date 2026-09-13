import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateManualDeductionDto } from './create-manual-deduction.dto';

export class UpdateManualDeductionDto extends PartialType(
  OmitType(CreateManualDeductionDto, [
    'siteId',
    'employeeId',
    'salaryMonth',
  ] as const),
) {}