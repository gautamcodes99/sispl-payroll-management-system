import {
  Body,
  Controller,
  Delete,
  FileTypeValidator,
  Get,
  HttpStatus,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';

import { Roles } from '../../auth/decorators/roles.decorator';
import { CreateCompanyProfileImageDto } from '../dto/create-company-profile-image.dto';
import { ReorderCompanyProfileImagesDto } from '../dto/reorder-company-profile-images.dto';
import { UpdateCompanyProfileImageDto } from '../dto/update-company-profile-image.dto';
import { CompanyProfileGalleryService } from '../service/company-profile-gallery.service';
import type { CompanyGalleryUploadedFile } from '../service/company-profile-gallery.service';

@Controller('company-profile/gallery')
@Roles(UserRole.SUPER_ADMIN)
export class CompanyProfileGalleryController {
  constructor(
    private readonly companyProfileGalleryService:
      CompanyProfileGalleryService,
  ) {}

  @Get()
  findAll() {
    return this.companyProfileGalleryService.findAll();
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  create(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 5 * 1024 * 1024,
          }),
          new FileTypeValidator({
            fileType: /^image\/(jpeg|png|webp)$/,
          }),
        ],
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        fileIsRequired: true,
      }),
    )
    file: CompanyGalleryUploadedFile,
    @Body() dto: CreateCompanyProfileImageDto,
  ) {
    return this.companyProfileGalleryService.create(
      file,
      dto,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyProfileImageDto,
  ) {
    return this.companyProfileGalleryService.update(
      id,
      dto,
    );
  }

  @Put('order')
  reorder(
    @Body() dto: ReorderCompanyProfileImagesDto,
  ) {
    return this.companyProfileGalleryService.reorder(dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.companyProfileGalleryService.remove(id);
  }
}
