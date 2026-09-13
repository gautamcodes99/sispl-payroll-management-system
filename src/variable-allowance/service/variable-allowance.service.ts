import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceStatus } from '@prisma/client';
import { CreateVariableAllowanceDto } from '../dto/create-variable-allowance.dto';
import { UpdateVariableAllowanceDto } from '../dto/update-variable-allowance.dto';
import { VariableAllowanceEligibleEmployeesQueryDto } from '../dto/variable-allowance-eligible-employees-query.dto';
import { VariableAllowanceQueryDto } from '../dto/variable-allowance-query.dto';
import { VariableAllowanceRepository } from '../repository/variable-allowance.repository';

@Injectable()
export class VariableAllowanceService {
  private readonly payrollAttendanceStatuses =
    new Set<AttendanceStatus>([
      AttendanceStatus.PRESENT,
      AttendanceStatus.HALF_DAY,
      AttendanceStatus.PAID_HOLIDAY,
    ]);

  constructor(
    private readonly variableAllowanceRepository: VariableAllowanceRepository,
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
  // SITE
  // =========================================================

  private async validateSiteExists(siteId: number) {
    const site = await this.variableAllowanceRepository.findSiteById(siteId);

    if (!site) {
      throw new NotFoundException(`Site with ID ${siteId} not found.`);
    }

    return site;
  }

  // =========================================================
  // EMPLOYEE MONTHLY PAYROLL SITE
  //
  // Locked rule:
  //
  // One employee may belong to only one payroll Site in one
  // salary month.
  //
  // Attendance and Daily OT Site context are both checked.
  //
  // This is validation/scope only. No payroll calculation
  // formula is changed here.
  // =========================================================

  private async resolveEmployeePayrollSite(
    employeeId: number,
    salaryMonth: Date,
  ) {
    const periodEndExclusive = this.getPeriodEndExclusive(salaryMonth);

    const [attendances, otAttendances] = await Promise.all([
      this.variableAllowanceRepository.findMonthlyAttendanceSiteRows(
        employeeId,
        salaryMonth,
        periodEndExclusive,
      ),

      this.variableAllowanceRepository.findMonthlyOtAttendanceSiteRows(
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
        `Employee ${employeeId} has payroll-relevant attendance without Site context for ${salaryMonth.toISOString()}. Correct attendance before maintaining Variable Allowance.`,
      );
    }

    if (hasOtWithoutSite) {
      throw new ConflictException(
        `Employee ${employeeId} has OT attendance without Site context for ${salaryMonth.toISOString()}. Correct Daily OT before maintaining Variable Allowance.`,
      );
    }

    if (sites.size > 1) {
      const siteList = Array.from(sites.values())
        .map((site) => `${site.id} - ${site.siteName}`)
        .join(', ');

      throw new ConflictException(
        `Employee ${employeeId} belongs to multiple payroll Sites for ${salaryMonth.toISOString()}: ${siteList}. Correct attendance Site before processing payroll or maintaining Variable Allowance.`,
      );
    }

    if (!hasPayrollRelevantAttendance) {
      throw new ConflictException(
        `Employee ${employeeId} has no payroll-relevant attendance for ${salaryMonth.toISOString()}. Variable Allowance cannot be maintained for this salary month.`,
      );
    }

    const site = Array.from(sites.values())[0];

    if (!site) {
      throw new ConflictException(
        `Employee ${employeeId} has no valid payroll Site for ${salaryMonth.toISOString()}. Correct attendance before maintaining Variable Allowance.`,
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
  //
  // FINALIZED = Variable Allowance locked for that Site/month
  // UNLOCKED  = corrections allowed
  //
  // A preserved legacy FINALIZED run with siteId NULL remains
  // a global month lock.
  // =========================================================

  private async validateSalaryMonthUnlocked(
    siteId: number,
    salaryMonth: Date,
  ): Promise<void> {
    const finalizedPayroll =
      await this.variableAllowanceRepository.findFinalizedPayrollRunForSiteAndMonth(
        siteId,
        salaryMonth,
      );

    if (finalizedPayroll) {
      const lockScope =
        finalizedPayroll.siteId === null
          ? 'legacy global payroll'
          : `Site ${siteId}`;

      throw new ConflictException(
        `Variable Allowance for ${salaryMonth.toISOString()} is locked by finalized Payroll Run version ${finalizedPayroll.version} for ${lockScope}. Unlock payroll before modifying allowances.`,
      );
    }
  }

  // =========================================================
  // CREATE
  // =========================================================

  async create(dto: CreateVariableAllowanceDto) {
    await this.validateSiteExists(dto.siteId);

    const employee = await this.variableAllowanceRepository.findEmployeeById(
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

      site: {
        connect: {
          id: dto.siteId,
        },
      },

      salaryMonth,
      conveyance: dto.conveyance ?? 0,
      arrears: dto.arrears ?? 0,
      rab: dto.rab ?? 0,
    });
  }

  // =========================================================
  // SITE-WISE LIST
  // =========================================================

  async findAll(query: VariableAllowanceQueryDto) {
    await this.validateSiteExists(query.siteId);

    const salaryMonth = query.salaryMonth
      ? this.normalizeSalaryMonth(query.salaryMonth)
      : undefined;

    return this.variableAllowanceRepository.findAll(
      query.siteId,
      query.employeeId,
      salaryMonth,
    );
  }

  // =========================================================
  // SITE-WISE ELIGIBLE EMPLOYEES
  // =========================================================

  async findEligibleEmployees(
    query: VariableAllowanceEligibleEmployeesQueryDto,
  ) {
    const selectedSite = await this.validateSiteExists(query.siteId);

    const salaryMonth = this.normalizeSalaryMonth(query.salaryMonth);
    const periodEndExclusive = this.getPeriodEndExclusive(salaryMonth);

    const candidates =
      await this.variableAllowanceRepository.findMonthlyPayrollCandidatesForSite(
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
  // FIND ONE
  // =========================================================

  async findOne(id: number) {
    const variableAllowance =
      await this.variableAllowanceRepository.findById(id);

    if (!variableAllowance) {
      throw new NotFoundException(`Variable Allowance with ID ${id} not found`);
    }

    return variableAllowance;
  }

  // =========================================================
  // UPDATE
  //
  // Site cannot be changed by the client.
  //
  // A legacy NULL-site record may be attached automatically
  // to the employee's now-unambiguous payroll Site when it is
  // legitimately updated.
  // =========================================================

  async update(id: number, dto: UpdateVariableAllowanceDto) {
    const variableAllowance = await this.findOne(id);

    const employeeSite = await this.resolveEmployeePayrollSite(
      variableAllowance.employeeId,
      variableAllowance.salaryMonth,
    );

    if (
      variableAllowance.siteId !== null &&
      variableAllowance.siteId !== employeeSite.id
    ) {
      throw new ConflictException(
        `Variable Allowance ${id} belongs to Site ${variableAllowance.siteId}, but employee ${variableAllowance.employeeId} currently belongs to Site ${employeeSite.id} - ${employeeSite.siteName} for this salary month. Correct attendance before modifying the allowance.`,
      );
    }

    const effectiveSiteId =
      variableAllowance.siteId ?? employeeSite.id;

    await this.validateSalaryMonthUnlocked(
      effectiveSiteId,
      variableAllowance.salaryMonth,
    );

    return this.variableAllowanceRepository.update(id, {
      ...(variableAllowance.siteId === null && {
        site: {
          connect: {
            id: effectiveSiteId,
          },
        },
      }),

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

  // =========================================================
  // DELETE
  // =========================================================

  async remove(id: number) {
    const variableAllowance = await this.findOne(id);

    const employeeSite = await this.resolveEmployeePayrollSite(
      variableAllowance.employeeId,
      variableAllowance.salaryMonth,
    );

    if (
      variableAllowance.siteId !== null &&
      variableAllowance.siteId !== employeeSite.id
    ) {
      throw new ConflictException(
        `Variable Allowance ${id} belongs to Site ${variableAllowance.siteId}, but employee ${variableAllowance.employeeId} currently belongs to Site ${employeeSite.id} - ${employeeSite.siteName} for this salary month. Correct attendance before deleting the allowance.`,
      );
    }

    const effectiveSiteId =
      variableAllowance.siteId ?? employeeSite.id;

    await this.validateSalaryMonthUnlocked(
      effectiveSiteId,
      variableAllowance.salaryMonth,
    );

    return this.variableAllowanceRepository.delete(id);
  }
}