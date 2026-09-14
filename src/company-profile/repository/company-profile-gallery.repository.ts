import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';

export type CreateCompanyProfileImageData = {
  fileName: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  caption: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type UpdateCompanyProfileImageData = {
  caption?: string | null;
  isActive?: boolean;
};

@Injectable()
export class CompanyProfileGalleryRepository {
  private readonly companyProfileId = 1;

  constructor(private readonly prisma: PrismaService) {}

  async findCompanyProfile() {
    return this.prisma.companyProfile.findUnique({
      where: {
        id: this.companyProfileId,
      },
      select: {
        id: true,
      },
    });
  }

  async count() {
    return this.prisma.companyProfileImage.count({
      where: {
        companyProfileId: this.companyProfileId,
      },
    });
  }

  async findAll() {
    return this.prisma.companyProfileImage.findMany({
      where: {
        companyProfileId: this.companyProfileId,
      },
      orderBy: [
        {
          sortOrder: 'asc',
        },
        {
          id: 'asc',
        },
      ],
    });
  }

  async findById(id: number) {
    return this.prisma.companyProfileImage.findFirst({
      where: {
        id,
        companyProfileId: this.companyProfileId,
      },
    });
  }

  async getMaxSortOrder() {
    const result = await this.prisma.companyProfileImage.aggregate({
      where: {
        companyProfileId: this.companyProfileId,
      },
      _max: {
        sortOrder: true,
      },
    });

    return result._max.sortOrder ?? 0;
  }

  async create(data: CreateCompanyProfileImageData) {
    return this.prisma.companyProfileImage.create({
      data: {
        companyProfileId: this.companyProfileId,
        ...data,
      },
    });
  }

  async update(
    id: number,
    data: UpdateCompanyProfileImageData,
  ) {
    return this.prisma.companyProfileImage.update({
      where: {
        id,
      },
      data,
    });
  }

  async reorder(imageIds: number[]) {
    await this.prisma.$transaction(
      imageIds.map((id, index) =>
        this.prisma.companyProfileImage.update({
          where: {
            id,
          },
          data: {
            sortOrder: index + 1,
          },
        }),
      ),
    );

    return this.findAll();
  }

  async deleteAndReorder(
    id: number,
    remainingImageIds: number[],
  ) {
    await this.prisma.$transaction([
      this.prisma.companyProfileImage.delete({
        where: {
          id,
        },
      }),

      ...remainingImageIds.map((imageId, index) =>
        this.prisma.companyProfileImage.update({
          where: {
            id: imageId,
          },
          data: {
            sortOrder: index + 1,
          },
        }),
      ),
    ]);

    return this.findAll();
  }
}
