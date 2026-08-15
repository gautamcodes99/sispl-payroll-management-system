import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { WageMasterRepository } from '../repository/wage-master.repository';
import { CreateSpecialAllowanceSlabDto } from '../dto/create-special-allowance-slab.dto';
import { CreateWageMasterDto } from '../dto/create-wage-master.dto';
import { UpdateWageMasterDto } from '../dto/update-wage-master.dto';

@Injectable()
export class WageMasterService {
  constructor(private readonly wageMasterRepository: WageMasterRepository) {}

  async validateDesignation(designationId: number): Promise<void> {
    const designation =
      await this.wageMasterRepository.findDesignationById(designationId);

    if (!designation) {
      throw new NotFoundException(
        `Designation with ID ${designationId} not found`,
      );
    }
  }

  async validateVersion(designationId: number, version: number): Promise<void> {
    const existing =
      await this.wageMasterRepository.findByDesignationAndVersion(
        designationId,
        version,
      );

    if (existing) {
      throw new ConflictException(
        `Wage Master version ${version} already exists for designation ${designationId}`,
      );
    }
  }

  async validateEffectivePeriod(
    designationId: number,
    effectiveFrom: string,
    effectiveTo?: string,
    excludeWageMasterId?: number,
  ): Promise<void> {
    const fromDate = new Date(effectiveFrom);
    const toDate = effectiveTo ? new Date(effectiveTo) : undefined;

    if (Number.isNaN(fromDate.getTime())) {
      throw new BadRequestException('Effective From date is invalid');
    }

    if (toDate && Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Effective To date is invalid');
    }

    if (toDate && toDate < fromDate) {
      throw new BadRequestException(
        'Effective To date cannot be earlier than Effective From date',
      );
    }

    const active =
      await this.wageMasterRepository.findActiveByDesignationId(designationId);

    if (
      active &&
      active.id !== excludeWageMasterId &&
      fromDate <= active.effectiveFrom
    ) {
      throw new ConflictException(
        `Effective From date must be later than the current active Wage Master version ${active.version}`,
      );
    }

    const existingVersions =
      await this.wageMasterRepository.findByDesignationId(designationId);

    for (const existing of existingVersions) {
      // Ignore the Wage Master currently being updated.
      if (existing.id === excludeWageMasterId) {
        continue;
      }

      if (existing.status === 'SUPERSEDED') {
        continue;
      }

      if (existing.status === 'ACTIVE') {
        continue;
      }

      const existingEnd =
        existing.effectiveTo ?? new Date('9999-12-31T23:59:59.999Z');

      const newEnd = toDate ?? new Date('9999-12-31T23:59:59.999Z');

      if (fromDate <= existingEnd && existing.effectiveFrom <= newEnd) {
        throw new ConflictException(
          `Wage Master effective period overlaps with existing draft version ${existing.version}`,
        );
      }
    }
  }

  async validateSpecialAllowanceSlabs(
    slabs: CreateSpecialAllowanceSlabDto[],
  ): Promise<void> {
    if (!slabs || slabs.length === 0) {
      return;
    }

    for (const slab of slabs) {
      if (slab.minDays < 0) {
        throw new BadRequestException(
          'Special Allowance slab minimum days cannot be negative',
        );
      }

      if (slab.maxDays < slab.minDays) {
        throw new BadRequestException(
          'Special Allowance slab maximum days cannot be less than minimum days',
        );
      }

      if (slab.ratePerDay < 0) {
        throw new BadRequestException(
          'Special Allowance slab rate per day cannot be negative',
        );
      }
    }

    const sortedSlabs = [...slabs].sort((a, b) => a.minDays - b.minDays);

    for (let i = 1; i < sortedSlabs.length; i++) {
      const previous = sortedSlabs[i - 1];
      const current = sortedSlabs[i];

      if (current.minDays <= previous.maxDays) {
        throw new ConflictException(
          `Special Allowance slabs overlap: ${previous.minDays}-${previous.maxDays} and ${current.minDays}-${current.maxDays}`,
        );
      }
    }
  }

  async create(dto: CreateWageMasterDto) {
    await this.validateDesignation(dto.designationId);

    await this.validateVersion(dto.designationId, dto.version);

    await this.validateEffectivePeriod(
      dto.designationId,
      dto.effectiveFrom,
      dto.effectiveTo,
    );

    await this.validateSpecialAllowanceSlabs(dto.specialAllowanceSlabs);

    return this.wageMasterRepository.create({
      designation: {
        connect: {
          id: dto.designationId,
        },
      },

      version: dto.version,

      effectiveFrom: new Date(dto.effectiveFrom),

      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,

      basic: dto.basic,

      da: dto.da,

      hraPercentage: dto.hraPercentage ?? 5,

      otOption: dto.otOption,

      status: 'DRAFT',

      specialAllowances: {
        create: dto.specialAllowanceSlabs.map((slab) => ({
          minDays: slab.minDays,
          maxDays: slab.maxDays,
          ratePerDay: slab.ratePerDay,
        })),
      },
    });
  }

  async activate(id: number) {
    const wageMaster = await this.wageMasterRepository.findById(id);

    if (!wageMaster) {
      throw new NotFoundException(`Wage Master with ID ${id} not found`);
    }

    if (wageMaster.status === 'ACTIVE') {
      throw new ConflictException(
        `Wage Master with ID ${id} is already active`,
      );
    }

    if (wageMaster.status === 'SUPERSEDED') {
      throw new ConflictException(
        `Wage Master with ID ${id} has already been superseded`,
      );
    }

    return this.wageMasterRepository.activate(
      id,
      wageMaster.designationId,
      wageMaster.effectiveFrom,
    );
  }

  async findAll() {
    return this.wageMasterRepository.findAll();
  }

  async findOne(id: number) {
    const wageMaster = await this.wageMasterRepository.findOne(id);

    if (!wageMaster) {
      throw new NotFoundException(`Wage Master with ID ${id} not found`);
    }

    return wageMaster;
  }

  async update(id: number, dto: UpdateWageMasterDto) {
    const wageMaster = await this.wageMasterRepository.findOne(id);

    if (!wageMaster) {
      throw new NotFoundException(`Wage Master with ID ${id} not found`);
    }

    if (wageMaster.status !== 'DRAFT') {
      throw new ConflictException(
        `Wage Master version ${wageMaster.version} cannot be edited because it is ${wageMaster.status}`,
      );
    }

    if (dto.effectiveFrom !== undefined || dto.effectiveTo !== undefined) {
      await this.validateEffectivePeriod(
        wageMaster.designationId,
        dto.effectiveFrom ?? wageMaster.effectiveFrom.toISOString(),
        dto.effectiveTo ?? wageMaster.effectiveTo?.toISOString(),
        id,
      );
    }

    if (dto.specialAllowanceSlabs !== undefined) {
      await this.validateSpecialAllowanceSlabs(dto.specialAllowanceSlabs);
    }

    return this.wageMasterRepository.update(id, dto);
  }
}
