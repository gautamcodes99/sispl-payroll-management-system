import {
  ArrayMaxSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  Min,
} from 'class-validator';

export class ReorderCompanyProfileImagesDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  imageIds!: number[];
}
