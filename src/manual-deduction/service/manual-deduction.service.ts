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

  // =========================================================
  // PAYROLL LOCK
  //
  // FINALIZED = Manual Deduction locked
  // UNLOCKED  = corrections allowed
  // SUPERSEDED historical runs do not lock the month
  // =========================================================

  private async validateSalaryMonthUnlocked(salaryMonth: Date): Promise<void> {
    const finalizedPayroll =
      await this.manualDeductionRepository.findFinalizedPayrollRunForMonth(
        salaryMonth,
      );

    if (finalizedPayroll) {
      throw new ConflictException(
        `Manual Deduction for ${salaryMonth.toISOString()} is locked because Payroll Run version ${finalizedPayroll.version} is finalized. Unlock payroll before modifying deductions.`,
      );
    }
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

    await this.validateSalaryMonthUnlocked(salaryMonth);

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
    const manualDeduction = await this.findOne(id);

    await this.validateSalaryMonthUnlocked(manualDeduction.salaryMonth);

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

  async remove(id: number) {
    const manualDeduction = await this.findOne(id);

    await this.validateSalaryMonthUnlocked(manualDeduction.salaryMonth);

    return this.manualDeductionRepository.delete(id);
  }
}
