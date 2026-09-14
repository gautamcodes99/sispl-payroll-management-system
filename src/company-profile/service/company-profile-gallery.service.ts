import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  mkdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  basename,
  join,
} from 'node:path';

import { CreateCompanyProfileImageDto } from '../dto/create-company-profile-image.dto';
import { ReorderCompanyProfileImagesDto } from '../dto/reorder-company-profile-images.dto';
import { UpdateCompanyProfileImageDto } from '../dto/update-company-profile-image.dto';
import { CompanyProfileGalleryRepository } from '../repository/company-profile-gallery.repository';

export type CompanyGalleryUploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class CompanyProfileGalleryService {
  private readonly maximumImages = 10;
  private readonly maximumFileSize = 5 * 1024 * 1024;

  private readonly galleryDirectory = join(
    process.cwd(),
    'uploads',
    'company-gallery',
  );

  private readonly allowedImageTypes: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };

  constructor(
    private readonly companyProfileGalleryRepository:
      CompanyProfileGalleryRepository,
  ) {}

  private imageUrl(fileName: string) {
    return `/uploads/company-gallery/${encodeURIComponent(fileName)}`;
  }

  private caption(value: string | undefined) {
    if (value === undefined) {
      return undefined;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
  }

  private responseImage(image: {
    id: number;
    originalName: string;
    mimeType: string;
    fileSize: number;
    fileName: string;
    caption: string | null;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: image.id,
      originalName: image.originalName,
      mimeType: image.mimeType,
      fileSize: image.fileSize,
      imageUrl: this.imageUrl(image.fileName),
      caption: image.caption,
      sortOrder: image.sortOrder,
      isActive: image.isActive,
      createdAt: image.createdAt,
      updatedAt: image.updatedAt,
    };
  }

  private async ensureCompanyProfileExists() {
    const companyProfile =
      await this.companyProfileGalleryRepository.findCompanyProfile();

    if (!companyProfile) {
      throw new NotFoundException('Company profile not found.');
    }
  }

  private validateFile(file: CompanyGalleryUploadedFile | undefined) {
    if (!file?.buffer) {
      throw new BadRequestException('Company gallery image is required.');
    }

    if (file.size <= 0) {
      throw new BadRequestException('Company gallery image is empty.');
    }

    if (file.size > this.maximumFileSize) {
      throw new BadRequestException(
        'Company gallery image cannot exceed 5 MB.',
      );
    }

    const extension = this.allowedImageTypes[file.mimetype];

    if (!extension) {
      throw new BadRequestException(
        'Only JPG, JPEG, PNG and WEBP images are allowed.',
      );
    }

    return extension;
  }

  async findAll() {
    await this.ensureCompanyProfileExists();

    const images =
      await this.companyProfileGalleryRepository.findAll();

    return {
      success: true,
      message: 'Company gallery fetched successfully.',
      data: {
        maximumImages: this.maximumImages,
        imageCount: images.length,
        images: images.map((image) => this.responseImage(image)),
      },
    };
  }

  async create(
    file: CompanyGalleryUploadedFile | undefined,
    dto: CreateCompanyProfileImageDto,
  ) {
    await this.ensureCompanyProfileExists();

    const extension = this.validateFile(file);

    const imageCount =
      await this.companyProfileGalleryRepository.count();

    if (imageCount >= this.maximumImages) {
      throw new ConflictException(
        `Company gallery can contain a maximum of ${this.maximumImages} images.`,
      );
    }

    const maximumSortOrder =
      await this.companyProfileGalleryRepository.getMaxSortOrder();

    const fileName = `${randomUUID()}${extension}`;

    const originalName =
      basename(file!.originalname || 'company-image').slice(0, 255);

    const caption = this.caption(dto.caption) ?? null;

    await mkdir(this.galleryDirectory, {
      recursive: true,
    });

    const filePath = join(
      this.galleryDirectory,
      fileName,
    );

    await writeFile(
      filePath,
      file!.buffer,
    );

    try {
      const image =
        await this.companyProfileGalleryRepository.create({
          fileName,
          originalName,
          mimeType: file!.mimetype,
          fileSize: file!.size,
          caption,
          sortOrder: maximumSortOrder + 1,
          isActive: true,
        });

      return {
        success: true,
        message: 'Company gallery image uploaded successfully.',
        data: this.responseImage(image),
      };
    } catch (error) {
      await rm(filePath, {
        force: true,
      }).catch(() => undefined);

      throw error;
    }
  }

  async update(
    id: number,
    dto: UpdateCompanyProfileImageDto,
  ) {
    await this.ensureCompanyProfileExists();

    const existing =
      await this.companyProfileGalleryRepository.findById(id);

    if (!existing) {
      throw new NotFoundException(
        `Company gallery image ${id} not found.`,
      );
    }

    if (
      dto.caption === undefined &&
      dto.isActive === undefined
    ) {
      throw new BadRequestException(
        'At least one gallery image field must be provided.',
      );
    }

    const image =
      await this.companyProfileGalleryRepository.update(id, {
        ...(dto.caption !== undefined && {
          caption: this.caption(dto.caption),
        }),

        ...(dto.isActive !== undefined && {
          isActive: dto.isActive,
        }),
      });

    return {
      success: true,
      message: 'Company gallery image updated successfully.',
      data: this.responseImage(image),
    };
  }

  async reorder(dto: ReorderCompanyProfileImagesDto) {
    await this.ensureCompanyProfileExists();

    const existingImages =
      await this.companyProfileGalleryRepository.findAll();

    if (dto.imageIds.length !== existingImages.length) {
      throw new BadRequestException(
        'Image order must contain every company gallery image exactly once.',
      );
    }

    const existingIds = new Set(
      existingImages.map((image) => image.id),
    );

    const containsInvalidId = dto.imageIds.some(
      (id) => !existingIds.has(id),
    );

    if (containsInvalidId) {
      throw new BadRequestException(
        'Image order contains an invalid company gallery image.',
      );
    }

    const images =
      await this.companyProfileGalleryRepository.reorder(
        dto.imageIds,
      );

    return {
      success: true,
      message: 'Company gallery order updated successfully.',
      data: {
        images: images.map((image) => this.responseImage(image)),
      },
    };
  }

  async remove(id: number) {
    await this.ensureCompanyProfileExists();

    const existing =
      await this.companyProfileGalleryRepository.findById(id);

    if (!existing) {
      throw new NotFoundException(
        `Company gallery image ${id} not found.`,
      );
    }

    const currentImages =
      await this.companyProfileGalleryRepository.findAll();

    const remainingImageIds = currentImages
      .filter((image) => image.id !== id)
      .map((image) => image.id);

    const images =
      await this.companyProfileGalleryRepository.deleteAndReorder(
        id,
        remainingImageIds,
      );

    const filePath = join(
      this.galleryDirectory,
      existing.fileName,
    );

    try {
      await rm(filePath, {
        force: true,
      });
    } catch (error) {
      console.error(
        `Unable to remove company gallery file ${existing.fileName}:`,
        error,
      );
    }

    return {
      success: true,
      message: 'Company gallery image deleted successfully.',
      data: {
        imageCount: images.length,
        images: images.map((image) => this.responseImage(image)),
      },
    };
  }
}
