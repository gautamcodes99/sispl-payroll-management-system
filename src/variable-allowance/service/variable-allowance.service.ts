import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateVariableAllowanceDto } from '../dto/create-variable-allowance.dto';
import { UpdateVariableAllowanceDto } from '../dto/update-variable-allowance.dto';
import { VariableAllowanceQueryDto } from '../dto/variable-allowance-query.dto';
import { VariableAllowanceRepository } from '../repository/variable-allowance.repository';

@Injectable()
export class VariableAllowanceService {
  constructor(
    private readonly variableAllowanceRepository: VariableAllowanceRepository,
  ) {}

  private normalizeSalaryMonth(salaryMonth: string): Date {
    const date = new Date(salaryMonth);

    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  // =========================================================
  // PAYROLL LOCK
  //
  // FINALIZED = Variable Allowance locked
  // UNLOCKED  = corrections allowed
  // SUPERSEDED historical runs do not lock the month
  // =========================================================

  private async validateSalaryMonthUnlocked(salaryMonth: Date): Promise<void> {
    const finalizedPayroll =
      await this.variableAllowanceRepository.findFinalizedPayrollRunForMonth(
        salaryMonth,
      );

    if (finalizedPayroll) {
      throw new ConflictException(
        `Variable Allowance for ${salaryMonth.toISOString()} is locked because Payroll Run version ${finalizedPayroll.version} is finalized. Unlock payroll before modifying allowances.`,
      );
    }
  }

  async create(dto: CreateVariableAllowanceDto) {
    const employee = await this.variableAllowanceRepository.findEmployeeById(
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
      await this.variableAllowanceRepository.findByEmployeeAndMonth(
        dto.employeeId,
        salaryMonth,
      );

    if (existing) {
      throw new ConflictException(
        `Variable Allowance already exists for employee ${dto.employeeId} for this salary month`,
      );
    }

    return this.variableAllowanceRepository.create({
      employee: {
        connect: {
          id: dto.employeeId,
        },
      },
      salaryMonth,
      conveyance: dto.conveyance ?? 0,
      arrears: dto.arrears ?? 0,
      rab: dto.rab ?? 0,
    });
  }

  async findAll(query: VariableAllowanceQueryDto) {
    const salaryMonth = query.salaryMonth
      ? this.normalizeSalaryMonth(query.salaryMonth)
      : undefined;

    return this.variableAllowanceRepository.findAll(
      query.employeeId,
      salaryMonth,
    );
  }

  async findOne(id: number) {
    const variableAllowance =
      await this.variableAllowanceRepository.findById(id);

    if (!variableAllowance) {
      throw new NotFoundException(`Variable Allowance with ID ${id} not found`);
    }

    return variableAllowance;
  }

  async update(id: number, dto: UpdateVariableAllowanceDto) {
    const variableAllowance = await this.findOne(id);

    await this.validateSalaryMonthUnlocked(variableAllowance.salaryMonth);

    return this.variableAllowanceRepository.update(id, {
      ...(dto.conveyance !== undefined && {
        conveyance: dto.conveyance,
      }),
      ...(dto.arrears !== undefined && {
        arrears: dto.arrears,
      }),
      ...(dto.rab !== undefined && {
        rab: dto.rab,
      }),
    });
  }
}
