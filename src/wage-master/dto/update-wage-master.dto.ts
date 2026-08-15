import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreateWageMasterDto } from './create-wage-master.dto';

export class UpdateWageMasterDto extends PartialType(
  OmitType(CreateWageMasterDto, ['designationId', 'version'] as const),
) {}
