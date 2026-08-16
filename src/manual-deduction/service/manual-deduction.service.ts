import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateManualDeductionDto } from '../dto/create-manual-deduction.dto';
import { ManualDeductionQueryDto } from '../dto/manual-deduction-query.dto';
import { UpdateManualDeductionDto } from '../dto/update-manual-deduction.dto';
import { ManualDeductionRepository } from '../repository/manual-deduction.repository';

@Injectable()
export class ManualDeductionService {
  constructor(
    private readonly manualDeductionRepository: ManualDeductionRepository,
  ) {}

  private normalizeSalaryMonth(salaryMonth: string): Date {
    const date = new Date(salaryMonth);

    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  async create(dto: CreateManualDeductionDto) {
    const employee = await this.manualDeductionRepository.findEmployeeById(
      dto.employeeId,
    );

    if (!employee) {
      throw new NotFoundException(
        `Employee with ID ${dto.employeeId} not found`,
      );
    }

    const salaryMonth = this.normalizeSalaryMonth(dto.salaryMonth);

    const existing =
      await this.manualDeductionRepository.findByEmployeeAndMonth(
        dto.employeeId,
        salaryMonth,
      );

    if (existing) {
      throw new ConflictException(
        `Manual Deduction already exists for employee ${dto.employeeId} for this salary month`,
      );
    }

    return this.manualDeductionRepository.create({
      employee: {
        connect: {
          id: dto.employeeId,
        },
      },
      salaryMonth,
      advanceRecovery: dto.advanceRecovery ?? 0,
      canteen: dto.canteen ?? 0,
      transport: dto.transport ?? 0,
      uniformRecovery: dto.uniformRecovery ?? 0,
      fine: dto.fine ?? 0,
      otherDeduction: dto.otherDeduction ?? 0,
    });
  }

  async findAll(query: ManualDeductionQueryDto) {
    const salaryMonth = query.salaryMonth
      ? this.normalizeSalaryMonth(query.salaryMonth)
      : undefined;

    return this.manualDeductionRepository.findAll(
      query.employeeId,
      salaryMonth,
    );
  }

  async findOne(id: number) {
    const manualDeduction = await this.manualDeductionRepository.findById(id);

    if (!manualDeduction) {
      throw new NotFoundException(`Manual Deduction with ID ${id} not found`);
    }

    return manualDeduction;
  }

  async update(id: number, dto: UpdateManualDeductionDto) {
    await this.findOne(id);

    return this.manualDeductionRepository.update(id, {
      ...(dto.advanceRecovery !== undefined && {
        advanceRecovery: dto.advanceRecovery,
      }),
      ...(dto.canteen !== undefined && {
        canteen: dto.canteen,
      }),
      ...(dto.transport !== undefined && {
        transport: dto.transport,
      }),
      ...(dto.uniformRecovery !== undefined && {
        uniformRecovery: dto.uniformRecovery,
      }),
      ...(dto.fine !== undefined && {
        fine: dto.fine,
      }),
      ...(dto.otherDeduction !== undefined && {
        otherDeduction: dto.otherDeduction,
      }),
    });
  }
}
