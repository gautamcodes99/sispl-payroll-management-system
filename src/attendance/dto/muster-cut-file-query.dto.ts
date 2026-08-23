import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class MusterCutFileQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  siteId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  workTypeId!: number;

  /*
   * Optional because the approved Cut File can contain
   * multiple Departments in the same report body.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  departmentId?: number;

  /*
   * Optional web/report filter.
   * Designation remains company-wide.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  designationId?: number;
}
