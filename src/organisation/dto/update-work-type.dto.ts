import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkTypeDto } from './create-work-type.dto';

export class UpdateWorkTypeDto extends PartialType(CreateWorkTypeDto) {}
