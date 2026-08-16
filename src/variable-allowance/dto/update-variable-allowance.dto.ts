import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateVariableAllowanceDto } from './create-variable-allowance.dto';

export class UpdateVariableAllowanceDto extends PartialType(
  OmitType(CreateVariableAllowanceDto, ['employeeId', 'salaryMonth'] as const),
) {}
