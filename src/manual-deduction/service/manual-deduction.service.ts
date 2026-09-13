import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { CreateManualDeductionDto } from '../dto/create-manual-deduction.dto';
import { ManualDeductionEligibleEmployeesQueryDto } from '../dto/manual-deduction-eligible-employees-query.dto';
import { ManualDeductionQueryDto } from '../dto/manual-deduction-query.dto';
import { UpdateManualDeductionDto } from '../dto/update-manual-deduction.dto';
import { ManualDeductionRepository } from '../repository/manual-deduction.repository';

type ManualDeductionListRow = Awaited<
  ReturnType<ManualDeductionRepository['findAll']>
>[number];

@Injectable()
export class ManualDeductionService {
  private readonly payrollAttendanceStatuses =
    new Set<AttendanceStatus>([
      AttendanceStatus.PRESENT,
      AttendanceStatus.HALF_DAY,
      AttendanceStatus.PAID_HOLIDAY,
    ]);

  constructor(
    private readonly manualDeductionRepository: ManualDeductionRepository,
  ) {}

  // =========================================================
  // SALARY MONTH
  // =========================================================

  private normalizeSalaryMonth(salaryMonth: string): Date {
    const date = new Date(salaryMonth);

    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private getPeriodEndExclusive(salaryMonth: Date): Date {
    return new Date(
      Date.UTC(
        salaryMonth.getUTCFullYear(),
        salaryMonth.getUTCMonth() + 1,
        1,
      ),
    );
  }

  // =========================================================
  // ADVANCE LEDGER
  //
  // Existing calculation is preserved exactly.
  // =========================================================

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

      if (newAdvance > 0) {
        advanceBalance += newAdvance;
        remainingInstallments += row.numberOfInstallments;
      }

      if (advanceRecovery > 0 && advanceBalance > 0) {
        const actualRecovery = Math.min(advanceRecovery, advanceBalance);

        advanceBalance -= actualRecovery;

        if (remainingInstallments > 0) {
          remainingInstallments -= 1;
        }
      }

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
  // SITE
  // =========================================================

  private async validateSiteExists(siteId: number) {
    const site = await this.manualDeductionRepository.findSiteById(siteId);

    if (!site) {
      throw new NotFoundException(`Site with ID ${siteId} not found.`);
    }

    return site;
  }

  // =========================================================
  // EMPLOYEE MONTHLY PAYROLL SITE
  //
  // Locked rule:
  // one employee -> one payroll Site -> one salary month.
  //
  // Attendance and Daily OT Site context are both validated.
  // =========================================================

  private async resolveEmployeePayrollSite(
    employeeId: number,
    salaryMonth: Date,
  ) {
    const periodEndExclusive = this.getPeriodEndExclusive(salaryMonth);

    const [attendances, otAttendances] = await Promise.all([
      this.manualDeductionRepository.findMonthlyAttendanceSiteRows(
        employeeId,
        salaryMonth,
        periodEndExclusive,
      ),
      this.manualDeductionRepository.findMonthlyOtAttendanceSiteRows(
        employeeId,
        salaryMonth,
        periodEndExclusive,
      ),
    ]);

    const sites = new Map<
      number,
      {
        id: number;
        siteName: string;
      }
    >();

    let hasPayrollRelevantAttendance = false;
    let hasPayrollRelevantAttendanceWithoutSite = false;
    let hasOtWithoutSite = false;

    for (const attendance of attendances) {
      const site = attendance.department?.workType.site;

      if (site) {
        sites.set(site.id, site);
      }

      if (this.payrollAttendanceStatuses.has(attendance.status)) {
        hasPayrollRelevantAttendance = true;

        if (!site) {
          hasPayrollRelevantAttendanceWithoutSite = true;
        }
      }
    }

    for (const otAttendance of otAttendances) {
      const site = otAttendance.department?.workType.site;

      if (site) {
        sites.set(site.id, site);
      } else if (Number(otAttendance.otHours) > 0) {
        hasOtWithoutSite = true;
      }
    }

    if (hasPayrollRelevantAttendanceWithoutSite) {
      throw new ConflictException(
        `Employee ${employeeId} has payroll-relevant attendance without Site context for ${salaryMonth.toISOString()}. Correct attendance before maintaining Manual Deduction.`,
      );
    }

    if (hasOtWithoutSite) {
      throw new ConflictException(
        `Employee ${employeeId} has OT attendance without Site context for ${salaryMonth.toISOString()}. Correct Daily OT before maintaining Manual Deduction.`,
      );
    }

    if (sites.size > 1) {
      const siteList = Array.from(sites.values())
        .map((site) => `${site.id} - ${site.siteName}`)
        .join(', ');

      throw new ConflictException(
        `Employee ${employeeId} belongs to multiple payroll Sites for ${salaryMonth.toISOString()}: ${siteList}. Correct attendance Site before processing payroll or maintaining Manual Deduction.`,
      );
    }

    if (!hasPayrollRelevantAttendance) {
      throw new ConflictException(
        `Employee ${employeeId} has no payroll-relevant attendance for ${salaryMonth.toISOString()}. Manual Deduction cannot be maintained for this salary month.`,
      );
    }

    const site = Array.from(sites.values())[0];

    if (!site) {
      throw new ConflictException(
        `Employee ${employeeId} has no valid payroll Site for ${salaryMonth.toISOString()}. Correct attendance before maintaining Manual Deduction.`,
      );
    }

    return site;
  }

  private async validateEmployeeBelongsToSite(
    employeeId: number,
    siteId: number,
    salaryMonth: Date,
  ) {
    const employeeSite = await this.resolveEmployeePayrollSite(
      employeeId,
      salaryMonth,
    );

    if (employeeSite.id !== siteId) {
      throw new ConflictException(
        `Employee ${employeeId} belongs to Site ${employeeSite.id} - ${employeeSite.siteName} for ${salaryMonth.toISOString()}, not Site ${siteId}.`,
      );
    }

    return employeeSite;
  }

  // =========================================================
  // PAYROLL LOCK
  // =========================================================

  private async validateSalaryMonthUnlocked(
    siteId: number,
    salaryMonth: Date,
  ): Promise<void> {
    const finalizedPayroll =
      await this.manualDeductionRepository.findFinalizedPayrollRunForSiteAndMonth(
        siteId,
        salaryMonth,
      );

    if (finalizedPayroll) {
      const lockScope =
        finalizedPayroll.siteId === null
          ? 'legacy global payroll'
          : `Site ${siteId}`;

      throw new ConflictException(
        `Manual Deduction for ${salaryMonth.toISOString()} is locked by finalized Payroll Run version ${finalizedPayroll.version} for ${lockScope}. Unlock payroll before modifying deductions.`,
      );
    }
  }

  // =========================================================
  // ADVANCE POSITION
  //
  // Deliberately NOT Site-filtered.
  //
  // Outstanding employee advance must continue if the employee
  // later moves to another Site.
  // =========================================================

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

  // =========================================================
  // CREATE
  // =========================================================

  async create(dto: CreateManualDeductionDto) {
    await this.validateSiteExists(dto.siteId);

    const employee = await this.manualDeductionRepository.findEmployeeById(
      dto.employeeId,
    );

    if (!employee) {
      throw new NotFoundException(
        `Employee with ID ${dto.employeeId} not found`,
      );
    }

    const salaryMonth = this.normalizeSalaryMonth(dto.salaryMonth);

    await this.validateEmployeeBelongsToSite(
      dto.employeeId,
      dto.siteId,
      salaryMonth,
    );

    await this.validateSalaryMonthUnlocked(dto.siteId, salaryMonth);

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
      site: {
        connect: {
          id: dto.siteId,
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

  // =========================================================
  // SITE-WISE LIST
  // =========================================================

  async findAll(query: ManualDeductionQueryDto) {
    await this.validateSiteExists(query.siteId);

    const salaryMonth = query.salaryMonth
      ? this.normalizeSalaryMonth(query.salaryMonth)
      : undefined;

    return this.manualDeductionRepository.findAll(
      query.siteId,
      query.employeeId,
      salaryMonth,
    );
  }

  // =========================================================
  // ELIGIBLE EMPLOYEES
  // =========================================================

  async findEligibleEmployees(
    query: ManualDeductionEligibleEmployeesQueryDto,
  ) {
    const selectedSite = await this.validateSiteExists(query.siteId);

    const salaryMonth = this.normalizeSalaryMonth(query.salaryMonth);
    const periodEndExclusive = this.getPeriodEndExclusive(salaryMonth);

    const candidates =
      await this.manualDeductionRepository.findMonthlyPayrollCandidatesForSite(
        query.siteId,
        salaryMonth,
        periodEndExclusive,
      );

    const eligibleEmployees: Array<
      (typeof candidates)[number] & {
        site: {
          id: number;
          siteName: string;
        };
      }
    > = [];

    for (const employee of candidates) {
      try {
        const employeeSite = await this.resolveEmployeePayrollSite(
          employee.id,
          salaryMonth,
        );

        if (employeeSite.id === query.siteId) {
          eligibleEmployees.push({
            ...employee,
            site: {
              id: selectedSite.id,
              siteName: selectedSite.siteName,
            },
          });
        }
      } catch (error) {
        if (error instanceof ConflictException) {
          continue;
        }

        throw error;
      }
    }

    return eligibleEmployees;
  }

  // =========================================================
  // MONTHLY SHEET ROW BUILDER
  // =========================================================

  private async buildMonthlySheetRows(
    salaryMonth: Date,
    currentRows: ManualDeductionListRow[],
    employeeIds: number[],
    site?: {
      id: number;
      siteName: string;
    },
  ) {
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

    return employees
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

          ...(site && {
            siteId: site.id,
            siteName: site.siteName,
          }),

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
  }

  // =========================================================
  // MONTHLY SHEET
  //
  // HTTP route always supplies siteId.
  //
  // siteId omitted is supported temporarily only because the
  // existing Payroll Reports service directly calls
  // findMonthlySheet(salaryMonth).
  //
  // That compatibility branch will be removed when Payroll
  // Reports are converted to Site-wise.
  // =========================================================

  async findMonthlySheet(
    salaryMonthInput: string,
    siteId?: number,
  ) {
    const salaryMonth = this.normalizeSalaryMonth(salaryMonthInput);

    if (siteId === undefined) {
      const currentRows =
        await this.manualDeductionRepository.findAllLegacy(
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

      return this.buildMonthlySheetRows(
        salaryMonth,
        currentRows,
        employeeIds,
      );
    }

    const selectedSite = await this.validateSiteExists(siteId);

    const currentRows = await this.manualDeductionRepository.findAll(
      siteId,
      undefined,
      salaryMonth,
    );

    const eligibleEmployees = await this.findEligibleEmployees({
      siteId,
      salaryMonth: salaryMonthInput,
    });

    const employeeIds = Array.from(
      new Set([
        ...currentRows.map((row) => row.employeeId),
        ...eligibleEmployees.map((employee) => employee.id),
      ]),
    );

    return this.buildMonthlySheetRows(
      salaryMonth,
      currentRows,
      employeeIds,
      {
        id: selectedSite.id,
        siteName: selectedSite.siteName,
      },
    );
  }

  // =========================================================
  // FIND ONE
  // =========================================================

  async findOne(id: number) {
    const manualDeduction = await this.manualDeductionRepository.findById(id);

    if (!manualDeduction) {
      throw new NotFoundException(`Manual Deduction with ID ${id} not found`);
    }

    return manualDeduction;
  }

  // =========================================================
  // UPDATE
  // =========================================================

  async update(id: number, dto: UpdateManualDeductionDto) {
    const manualDeduction = await this.findOne(id);

    const employeeSite = await this.resolveEmployeePayrollSite(
      manualDeduction.employeeId,
      manualDeduction.salaryMonth,
    );

    if (
      manualDeduction.siteId !== null &&
      manualDeduction.siteId !== employeeSite.id
    ) {
      throw new ConflictException(
        `Manual Deduction ${id} belongs to Site ${manualDeduction.siteId}, but employee ${manualDeduction.employeeId} currently belongs to Site ${employeeSite.id} - ${employeeSite.siteName} for this salary month. Correct attendance before modifying the deduction.`,
      );
    }

    const effectiveSiteId =
      manualDeduction.siteId ?? employeeSite.id;

    await this.validateSalaryMonthUnlocked(
      effectiveSiteId,
      manualDeduction.salaryMonth,
    );

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
      ...(manualDeduction.siteId === null && {
        site: {
          connect: {
            id: effectiveSiteId,
          },
        },
      }),

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

  // =========================================================
  // DELETE
  // =========================================================

  async remove(id: number) {
    const manualDeduction = await this.findOne(id);

    const employeeSite = await this.resolveEmployeePayrollSite(
      manualDeduction.employeeId,
      manualDeduction.salaryMonth,
    );

    if (
      manualDeduction.siteId !== null &&
      manualDeduction.siteId !== employeeSite.id
    ) {
      throw new ConflictException(
        `Manual Deduction ${id} belongs to Site ${manualDeduction.siteId}, but employee ${manualDeduction.employeeId} currently belongs to Site ${employeeSite.id} - ${employeeSite.siteName} for this salary month. Correct attendance before deleting the deduction.`,
      );
    }

    const effectiveSiteId =
      manualDeduction.siteId ?? employeeSite.id;

    await this.validateSalaryMonthUnlocked(
      effectiveSiteId,
      manualDeduction.salaryMonth,
    );

    return this.manualDeductionRepository.delete(id);
  }
}