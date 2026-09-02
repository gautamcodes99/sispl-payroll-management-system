import {
  BadRequestException,
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

  private calculateAdvanceHistory(
    history: Array<{
      newAdvance: unknown;
      numberOfInstallments: number;
      advanceRecovery: unknown;
    }>,
  ) {
    let advanceBalance = 0;
    let remainingInstallments = 0;

    for (const row of history) {
      const newAdvance = Number(row.newAdvance);
      const advanceRecovery = Number(row.advanceRecovery);

      // A new advance starts/adds to the tracked advance ledger.
      if (newAdvance > 0) {
        advanceBalance += newAdvance;
        remainingInstallments += row.numberOfInstallments;
      }

      // Recovery can reduce only an advance balance that actually exists
      // in the revised advance ledger.
      //
      // This intentionally ignores historical legacy advanceRecovery rows
      // that existed before any tracked newAdvance was entered.
      if (advanceRecovery > 0 && advanceBalance > 0) {
        const actualRecovery = Math.min(advanceRecovery, advanceBalance);

        advanceBalance -= actualRecovery;

        if (remainingInstallments > 0) {
          remainingInstallments -= 1;
        }
      }

      // Once fully recovered, there can be no remaining installments.
      if (advanceBalance <= 0) {
        advanceBalance = 0;
        remainingInstallments = 0;
      }
    }

    return {
      oldAdvance: advanceBalance,
      remainingInstallments,
    };
  }

  private validateAdvanceEntry(
    oldAdvance: number,
    newAdvance: number,
    numberOfInstallments: number,
    advanceRecovery: number,
  ): void {
    if (newAdvance > 0 && numberOfInstallments < 1) {
      throw new BadRequestException(
        'Nos. of Installment must be at least 1 when New Advance is greater than 0.',
      );
    }

    if (newAdvance === 0 && numberOfInstallments > 0) {
      throw new BadRequestException(
        'Nos. of Installment can only be entered when New Advance is greater than 0.',
      );
    }

    const totalAdvance = oldAdvance + newAdvance;

    if (advanceRecovery > totalAdvance) {
      throw new BadRequestException(
        `Actual Advance Deduction cannot exceed Total Advance of ${totalAdvance.toFixed(
          2,
        )}.`,
      );
    }
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

  private async getAdvancePositionBeforeMonth(
    employeeId: number,
    salaryMonth: Date,
  ) {
    const history =
      await this.manualDeductionRepository.findAdvanceHistoryBeforeMonth(
        employeeId,
        salaryMonth,
      );

    return this.calculateAdvanceHistory(history);
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

    const { oldAdvance } = await this.getAdvancePositionBeforeMonth(
      dto.employeeId,
      salaryMonth,
    );

    const newAdvance = dto.newAdvance ?? 0;
    const numberOfInstallments = dto.numberOfInstallments ?? 0;
    const advanceRecovery = dto.advanceRecovery ?? 0;

    this.validateAdvanceEntry(
      oldAdvance,
      newAdvance,
      numberOfInstallments,
      advanceRecovery,
    );

    return this.manualDeductionRepository.create({
      employee: {
        connect: {
          id: dto.employeeId,
        },
      },
      salaryMonth,
      newAdvance,
      numberOfInstallments,
      advanceRecovery,
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

  async findMonthlySheet(salaryMonthInput: string) {
    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);

    const currentRows = await this.manualDeductionRepository.findAll(
      undefined,
      salaryMonth,
    );

    const historicalEmployeeIds =
      await this.manualDeductionRepository.findEmployeeIdsWithAdvanceHistoryBeforeMonth(
        salaryMonth,
      );

    const employeeIds = Array.from(
      new Set([
        ...currentRows.map((row) => row.employeeId),
        ...historicalEmployeeIds.map((row) => row.employeeId),
      ]),
    );

    if (employeeIds.length === 0) {
      return [];
    }

    const [employees, advanceHistory] = await Promise.all([
      this.manualDeductionRepository.findEmployeesByIds(employeeIds),
      this.manualDeductionRepository.findAdvanceHistoryForEmployeesBeforeMonth(
        employeeIds,
        salaryMonth,
      ),
    ]);

    const currentRowMap = new Map(
      currentRows.map((row) => [row.employeeId, row]),
    );

    const historyMap = new Map<
      number,
      Array<{
        newAdvance: unknown;
        numberOfInstallments: number;
        advanceRecovery: unknown;
      }>
    >();

    for (const row of advanceHistory) {
      const employeeHistory = historyMap.get(row.employeeId) ?? [];

      employeeHistory.push({
        newAdvance: row.newAdvance,
        numberOfInstallments: row.numberOfInstallments,
        advanceRecovery: row.advanceRecovery,
      });

      historyMap.set(row.employeeId, employeeHistory);
    }

    const rows = employees
      .map((employee) => {
        const currentRow = currentRowMap.get(employee.id);

        const history = historyMap.get(employee.id) ?? [];

        const { oldAdvance, remainingInstallments } =
          this.calculateAdvanceHistory(history);

        const newAdvance = currentRow ? Number(currentRow.newAdvance) : 0;

        const advanceRecovery = currentRow
          ? Number(currentRow.advanceRecovery)
          : 0;

        const currentNewAdvanceInstallments = currentRow
          ? currentRow.numberOfInstallments
          : 0;

        const totalAdvance = oldAdvance + newAdvance;

        const closingAdvance = Math.max(0, totalAdvance - advanceRecovery);

        const installmentsForMonth =
          remainingInstallments + currentNewAdvanceInstallments;

        return {
          id: currentRow?.id ?? null,
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
          designation: employee.designation?.designationName ?? null,

          salaryMonth,

          oldAdvance,
          newAdvance,
          totalAdvance,

          numberOfInstallments: currentNewAdvanceInstallments,
          remainingInstallments: installmentsForMonth,

          advanceRecovery,
          closingAdvance,

          canteen: currentRow ? Number(currentRow.canteen) : 0,
          transport: currentRow ? Number(currentRow.transport) : 0,
          uniformRecovery: currentRow ? Number(currentRow.uniformRecovery) : 0,
          fine: currentRow ? Number(currentRow.fine) : 0,
          otherDeduction: currentRow ? Number(currentRow.otherDeduction) : 0,

          status: currentRow ? 'ENTERED' : 'PENDING',
        };
      })
      .filter((row) => row.id !== null || row.oldAdvance > 0)
      .sort((a, b) => a.employeeId - b.employeeId);

    return rows;
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

    const { oldAdvance } = await this.getAdvancePositionBeforeMonth(
      manualDeduction.employeeId,
      manualDeduction.salaryMonth,
    );

    const existingNewAdvance = Number(manualDeduction.newAdvance);
    const existingAdvanceRecovery = Number(manualDeduction.advanceRecovery);

    const newAdvance =
      dto.newAdvance !== undefined ? dto.newAdvance : existingNewAdvance;

    const numberOfInstallments =
      dto.numberOfInstallments !== undefined
        ? dto.numberOfInstallments
        : manualDeduction.numberOfInstallments;

    const advanceRecovery =
      dto.advanceRecovery !== undefined
        ? dto.advanceRecovery
        : existingAdvanceRecovery;

    // =====================================================
    // LEGACY ADVANCE RECOVERY COMPATIBILITY
    //
    // Before the revised advance ledger was introduced,
    // ManualDeduction.advanceRecovery could contain an amount
    // without a corresponding tracked newAdvance.
    //
    // Those historical rows must remain editable for unrelated
    // monthly deductions such as Canteen, Transport, Uniform,
    // Fine and Other.
    //
    // Once the row participates in the revised advance ledger,
    // or the client explicitly changes an advance field, normal
    // advance validation applies.
    // =====================================================

    const isLegacyAdvanceRecoveryRow =
      oldAdvance === 0 &&
      existingNewAdvance === 0 &&
      existingAdvanceRecovery > 0;

    const isAdvanceFieldBeingChanged =
      dto.newAdvance !== undefined ||
      dto.numberOfInstallments !== undefined ||
      dto.advanceRecovery !== undefined;

    if (!isLegacyAdvanceRecoveryRow || isAdvanceFieldBeingChanged) {
      this.validateAdvanceEntry(
        oldAdvance,
        newAdvance,
        numberOfInstallments,
        advanceRecovery,
      );
    }

    return this.manualDeductionRepository.update(id, {
      ...(dto.newAdvance !== undefined && {
        newAdvance: dto.newAdvance,
      }),
      ...(dto.numberOfInstallments !== undefined && {
        numberOfInstallments: dto.numberOfInstallments,
      }),
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
