import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttendanceRepository } from '../repository/attendance.repository';
import { CreateAttendanceDto } from '../dto/create-attendance.dto';
import { UpdateAttendanceDto } from '../dto/update-attendance.dto';
import { AttendanceQueryDto } from '../dto/attendance-query.dto';
import { PendingAttendanceQueryDto } from '../dto/pending-attendance-query.dto';
import { AttendanceDashboardQueryDto } from '../dto/attendance-dashboard-query.dto';
import { BulkAttendanceDto } from '../dto/bulk-attendance.dto';
import { MonthlyAttendanceQueryDto } from '../dto/monthly-attendance-query.dto';
import { AttendanceReportQueryDto } from '../dto/attendance-report-query.dto';
import { AttendanceStatus } from '@prisma/client';
import { FormXxiiiReportQueryDto } from '../dto/form-xxiii-report-query.dto';
import { MusterCutFileQueryDto } from '../dto/muster-cut-file-query.dto';
import { MultiShiftWarningQueryDto } from '../dto/multi-shift-warning-query.dto';
import { HolidayCalendarRepository } from '../../holiday-calendar/repository/holiday-calendar.repository';

@Injectable()
export class AttendanceService {
  constructor(
    private readonly attendanceRepository: AttendanceRepository,
    private readonly holidayCalendarRepository: HolidayCalendarRepository,
  ) {}

  // =========================================================
  // SALARY MONTH
  // =========================================================

  private normalizeSalaryMonth(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  // =========================================================
  // PAYROLL / ATTENDANCE LOCK
  //
  // Locked lifecycle:
  //
  // Payroll FINALIZED
  //   -> Attendance month is locked.
  //
  // Payroll UNLOCKED
  //   -> Attendance corrections are allowed.
  //
  // Payroll SUPERSEDED
  //   -> Historical only; does not lock the month.
  //
  // No lock flag is duplicated on Attendance rows.
  // =========================================================

  private async validateAttendanceSiteMonthUnlocked(
    attendanceDate: Date,
    siteId: number | null,
  ): Promise<void> {
    const salaryMonth = this.normalizeSalaryMonth(attendanceDate);

    const finalizedPayroll =
      await this.attendanceRepository.findFinalizedPayrollRunForSiteAndMonth(
        siteId,
        salaryMonth,
      );

    if (finalizedPayroll) {
      const lockScope =
        finalizedPayroll.siteId === null
          ? 'legacy company-wide payroll'
          : `Site ${finalizedPayroll.siteId}`;

      throw new ConflictException(
        `Attendance for ${salaryMonth.toISOString()} is locked because Payroll Run version ${finalizedPayroll.version} is finalized for ${lockScope}. Unlock payroll before modifying attendance.`,
      );
    }
  }

  private async resolveAttendanceSiteId(
    departmentId: number,
  ): Promise<number> {
    const department =
      await this.attendanceRepository.findDepartmentAttendanceContext(
        departmentId,
      );

    if (!department) {
      throw new NotFoundException(
        `Department with ID ${departmentId} not found.`,
      );
    }

    return department.workType.siteId;
  }

  // =========================================================
  // VALIDATE ATTENDANCE CONTEXT
  //
  // Attendance employee selection is universal.
  //
  // Any employee may be punched under the selected
  // operational attendance context:
  //
  // Department
  //   -> Work Type
  //      -> Site
  //
  // Therefore Employee Designation Site does NOT restrict
  // the Department selected during attendance punching.
  //
  // We only validate:
  // - Employee exists
  // - Department exists
  // =========================================================

  private async validateAttendanceContext(
    employeeId: number,
    departmentId: number,
    designationId: number,
  ) {
    const [employee, department, designation] = await Promise.all([
      this.attendanceRepository.findEmployeeAttendanceContext(employeeId),

      this.attendanceRepository.findDepartmentAttendanceContext(departmentId),

      this.attendanceRepository.findDesignationAttendanceContext(designationId),
    ]);

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found.`);
    }

    if (!department) {
      throw new NotFoundException(
        `Department with ID ${departmentId} not found.`,
      );
    }

    if (!designation) {
      throw new NotFoundException(
        `Designation with ID ${designationId} not found.`,
      );
    }

    if (designation.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Designation with ID ${designationId} is not active.`,
      );
    }
  }

  // =========================================================
  // VALIDATE BULK ATTENDANCE CONTEXT
  //
  // Employee picker remains universal across all Sites.
  //
  // We only validate:
  // - Department exists
  // - Every Employee exists
  // =========================================================

  private async validateBulkAttendanceContext(
    employeeIds: number[],
    departmentId: number,
    designationId: number,
  ) {
    const department =
      await this.attendanceRepository.findDepartmentAttendanceContext(
        departmentId,
      );

    if (!department) {
      throw new NotFoundException(
        `Department with ID ${departmentId} not found.`,
      );
    }
    const designation =
      await this.attendanceRepository.findDesignationAttendanceContext(
        designationId,
      );

    if (!designation) {
      throw new NotFoundException(
        `Designation with ID ${designationId} not found.`,
      );
    }

    if (designation.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Designation with ID ${designationId} is not active.`,
      );
    }

    const employees =
      await this.attendanceRepository.findEmployeesAttendanceContext(
        employeeIds,
      );

    const foundEmployeeIds = new Set(employees.map((employee) => employee.id));

    const missingEmployeeIds = employeeIds.filter(
      (employeeId) => !foundEmployeeIds.has(employeeId),
    );

    if (missingEmployeeIds.length > 0) {
      throw new NotFoundException(
        `Employee(s) with ID ${missingEmployeeIds.join(', ')} not found.`,
      );
    }
  }

  // =========================================================
  // MULTI-SHIFT WARNING CHECK
  //
  // Warning only:
  // - Applies when punching SECOND or THIRD shift.
  // - Warns only when FIRST shift was PRESENT or HALF_DAY.
  // - Does not block multi-shift attendance.
  // =========================================================

  async getMultiShiftWarning(query: MultiShiftWarningQueryDto) {
    if (query.shift === 'FIRST') {
      return {
        success: true,
        message: 'Multi-shift warning checked successfully.',
        data: {
          shouldWarn: false,
          firstShiftStatus: null,
        },
      };
    }

    const attendanceDate = new Date(query.attendanceDate);

    const firstShiftAttendance =
      await this.attendanceRepository.findFirstShiftAttendance(
        query.employeeId,
        attendanceDate,
      );

    const shouldWarn =
      firstShiftAttendance?.status === 'PRESENT' ||
      firstShiftAttendance?.status === 'HALF_DAY';

    return {
      success: true,
      message: 'Multi-shift warning checked successfully.',
      data: {
        shouldWarn,
        firstShiftStatus: firstShiftAttendance?.status ?? null,
      },
    };
  }
  // =========================================================
  // CREATE
  // =========================================================

  async create(createAttendanceDto: CreateAttendanceDto) {
    const attendanceDate = new Date(createAttendanceDto.attendanceDate);

    const siteId = await this.resolveAttendanceSiteId(
      createAttendanceDto.departmentId,
    );

    await this.validateAttendanceSiteMonthUnlocked(
      attendanceDate,
      siteId,
    );

    await this.validateAttendanceContext(
      createAttendanceDto.employeeId,
      createAttendanceDto.departmentId,
      createAttendanceDto.designationId,
    );

    const attendance =
      await this.attendanceRepository.create(createAttendanceDto);

    return {
      success: true,
      message: 'Attendance marked successfully.',
      data: attendance,
    };
  }

  // =========================================================
  // FIND ATTENDANCES
  // =========================================================

  async findAttendances(query: AttendanceQueryDto) {
    const result = await this.attendanceRepository.findAttendances(query);

    return {
      success: true,
      message: 'Attendance records fetched successfully.',
      data: result.attendances,

      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }

  // =========================================================
  // PENDING EMPLOYEES
  // =========================================================

  async findPendingEmployees(query: PendingAttendanceQueryDto) {
    const employees = await this.attendanceRepository.findPendingEmployees(
      new Date(query.attendanceDate),
    );

    return {
      success: true,
      message: 'Pending employees fetched successfully.',
      data: employees,
      total: employees.length,
    };
  }

  // =========================================================
  // DASHBOARD
  // =========================================================

  async getDashboardSummary(query: AttendanceDashboardQueryDto) {
    const summary = await this.attendanceRepository.getDashboardSummary(
      new Date(query.attendanceDate),
    );

    return {
      success: true,
      message: 'Attendance dashboard fetched successfully.',
      data: summary,
    };
  }

  // =========================================================
  // BULK CREATE ATTENDANCE
  // =========================================================

  async bulkCreateAttendance(bulkAttendanceDto: BulkAttendanceDto) {
    const attendanceDate = new Date(bulkAttendanceDto.attendanceDate);

    const siteId = await this.resolveAttendanceSiteId(
      bulkAttendanceDto.departmentId,
    );

    await this.validateAttendanceSiteMonthUnlocked(
      attendanceDate,
      siteId,
    );

    await this.validateBulkAttendanceContext(
      bulkAttendanceDto.employeeIds,
      bulkAttendanceDto.departmentId,
      bulkAttendanceDto.designationId,
    );

    const existingAttendances =
      await this.attendanceRepository.findExistingAttendance(
        attendanceDate,
        bulkAttendanceDto.employeeIds,
        bulkAttendanceDto.shift,
      );

    if (existingAttendances.length > 0) {
      return {
        success: false,

        message:
          'Attendance already exists for the selected employee(s) and shift.',

        data: {
          duplicates: existingAttendances.map((attendance) => ({
            employeeId: attendance.employeeId,
            firstName: attendance.employee.firstName,
            lastName: attendance.employee.lastName,
            shift: attendance.shift,
          })),
        },
      };
    }

    const attendances =
      await this.attendanceRepository.bulkCreateAttendance(bulkAttendanceDto);

    return {
      success: true,
      message: 'Attendance marked successfully.',

      data: {
        processed: attendances.length,
      },
    };
  }

  // =========================================================
  // MONTHLY ATTENDANCE SUMMARY
  // =========================================================

  async getMonthlyAttendanceSummary(query: MonthlyAttendanceQueryDto) {
    const summary =
      await this.attendanceRepository.getMonthlyAttendanceSummary(query);

    if (!summary) {
      return {
        success: false,
        message: 'No attendance records found.',
        data: null,
      };
    }

    return {
      success: true,

      message: 'Monthly attendance summary fetched successfully.',

      data: summary,
    };
  }
  // =========================================================
  // ATTENDANCE REPORT HELPERS
  // =========================================================

  private mapAttendanceStatusToReportCode(status: AttendanceStatus): string {
    switch (status) {
      case 'PRESENT':
        return 'P';

      case 'ABSENT':
        return 'A';

      case 'WEEKLY_OFF':
        return 'WO';

      case 'HALF_DAY':
        return 'HD';

      case 'PAID_HOLIDAY':
        return 'PH';

      // LEAVE and HOLIDAY are intentionally ignored
      // in the finalized Attendance Reports specification.
      case 'LEAVE':
      case 'HOLIDAY':
      default:
        return '';
    }
  }
  // =========================================================
  // ATTENDANCE REPORT HOLIDAY CALENDAR
  //
  // Organisation-wide Holiday Calendar used only by:
  //
  // - Muster
  // - OT Muster
  // - Muster With OT
  // - Muster Cut File
  // - OT Muster Cut File
  //
  // WEEK_OFF:
  // - Muster and Muster With OT may display WO only when
  //   there is no manually punched Attendance for that date.
  //
  // OT Muster / Muster Cut File / OT Muster Cut File:
  // - Calendar information is metadata for coloring only.
  //
  // HOLIDAY:
  // - Metadata/coloring only.
  // - Never automatically creates H or PH.
  //
  // No Attendance rows are created here.
  // No payroll calculation is performed here.
  // =========================================================

  private async getAttendanceReportCalendar(year: number, month: number) {
    const startDate = new Date(Date.UTC(year, month - 1, 1));

    const daysInMonth = new Date(
      Date.UTC(year, month, 0),
    ).getUTCDate();

    const endDate = new Date(
      Date.UTC(year, month - 1, daysInMonth),
    );

    const entries = await this.holidayCalendarRepository.findAll(
      startDate,
      endDate,
    );

    const calendarByDay = new Map<
      number,
      {
        type: 'WEEK_OFF' | 'HOLIDAY';
        name: string | null;
      }
    >();

    const calendarDays = entries.map((entry) => {
      const day = entry.date.getUTCDate();

      calendarByDay.set(day, {
        type: entry.type,
        name: entry.name,
      });

      return {
        day,
        date: entry.date,
        type: entry.type,
        name: entry.name,
      };
    });

    return {
      calendarByDay,
      calendarDays,
    };
  }
  private getAttendanceReportShiftOrder(shift: string): number {
    switch (shift) {
      case 'FIRST':
        return 1;
      case 'SECOND':
        return 2;
      case 'THIRD':
        return 3;
      default:
        return 999;
    }
  }

  private sortAttendanceReportCodes(
    entries: Array<{ shift: string; code: string }>,
  ): Array<{ shift: string; code: string }> {
    return entries.sort(
      (a, b) =>
        this.getAttendanceReportShiftOrder(a.shift) -
        this.getAttendanceReportShiftOrder(b.shift),
    );
  }

  private calculateAttendanceReportAge(
    dateOfBirth: Date | null,
    reportEndDate: Date,
  ): number | null {
    if (!dateOfBirth) {
      return null;
    }

    let age = reportEndDate.getUTCFullYear() - dateOfBirth.getUTCFullYear();

    const reportMonth = reportEndDate.getUTCMonth();
    const birthMonth = dateOfBirth.getUTCMonth();

    if (
      reportMonth < birthMonth ||
      (reportMonth === birthMonth &&
        reportEndDate.getUTCDate() < dateOfBirth.getUTCDate())
    ) {
      age -= 1;
    }

    return age;
  }

  // =========================================================
  // ATTENDANCE REPORT OPTIONAL ORGANISATION CONTEXT
  //
  // Site, Work Type and Department are independent optional
  // report filters.
  //
  // When multiple filters are supplied, their organisation
  // hierarchy must be consistent.
  //
  // This helper is used only by:
  // - Muster
  // - OT Muster
  // - Muster With OT
  // - Muster Cut File
  // - OT Muster Cut File
  //
  // Form XXIII keeps its existing rules.
  // =========================================================

  private async resolveAttendanceReportContext(query: {
    siteId?: number;
    workTypeId?: number;
    departmentId?: number;
  }) {
    const [site, workType, department] = await Promise.all([
      query.siteId
        ? this.attendanceRepository.findAttendanceReportSiteContext(
            query.siteId,
          )
        : Promise.resolve(null),

      query.workTypeId
        ? this.attendanceRepository.findMusterCutFileWorkTypeContext(
            query.workTypeId,
          )
        : Promise.resolve(null),

      query.departmentId
        ? this.attendanceRepository.findAttendanceReportDepartmentContext(
            query.departmentId,
          )
        : Promise.resolve(null),
    ]);

    if (query.siteId && !site) {
      throw new NotFoundException('Site not found.');
    }

    if (query.workTypeId && !workType) {
      throw new NotFoundException('Work Type not found.');
    }

    if (query.departmentId && !department) {
      throw new NotFoundException('Department not found.');
    }

    if (site && workType && workType.siteId !== site.id) {
      throw new BadRequestException(
        'Selected Work Type does not belong to the selected Site.',
      );
    }

    if (workType && department && department.workTypeId !== workType.id) {
      throw new BadRequestException(
        'Selected Department does not belong to the selected Work Type.',
      );
    }

    if (site && department && department.workType.siteId !== site.id) {
      throw new BadRequestException(
        'Selected Department does not belong to the selected Site.',
      );
    }

    return {
      site: site
        ? {
            id: site.id,
            siteName: site.siteName,
          }
        : null,

      workType: workType
        ? {
            id: workType.id,
            workTypeName: workType.workTypeName,
          }
        : null,

      department: department
        ? {
            id: department.id,
            departmentName: department.departmentName,
          }
        : null,
    };
  }

  // =========================================================
  // MUSTER REPORT
  //
  // Output:
  //
  // Sr No
  // Employee ID
  // Employee Name
  // Age
  // Sex
  // DOJ
  // Designation
  // Dynamic day columns
  // Days
  // PH
  //
  // Report attendance codes:
  //
  // PRESENT      -> P
  // ABSENT       -> A
  // WEEKLY_OFF   -> WO
  // HALF_DAY     -> HD
  // PAID_HOLIDAY -> PH
  //
  // LEAVE / HOLIDAY are ignored.
  //
  // Mandays:
  //
  // P  = 1
  // HD = 0.5
  // =========================================================

  async getMusterReport(query: AttendanceReportQueryDto) {
    // -------------------------------------------------------
    // ORGANISATION CONTEXT VALIDATION
    // -------------------------------------------------------

    const context = await this.resolveAttendanceReportContext(query);

    // -------------------------------------------------------
    // MONTH
    // -------------------------------------------------------

    const daysInMonth = new Date(
      Date.UTC(query.year, query.month, 0),
    ).getUTCDate();

    const reportEndDate = new Date(
      Date.UTC(query.year, query.month - 1, daysInMonth),
    );

    // -------------------------------------------------------
    // RAW ATTENDANCE
    // -------------------------------------------------------

    const [attendances, holidayCalendar] = await Promise.all([
      this.attendanceRepository.findMonthlyAttendanceReportData(query),
      this.getAttendanceReportCalendar(query.year, query.month),
    ]);

    // -------------------------------------------------------
    // EMPLOYEE GROUPING
    // -------------------------------------------------------

    type MusterEmployeeAccumulator = {
      employeeId: number;
      employeeName: string;
      dateOfBirth: Date | null;
      gender: string | null;
      joiningDate: Date;
      designationId: number;
      designationName: string;
      attendanceByDay: Map<number, Array<{ shift: string; code: string }>>;
      manualAttendanceDays: Set<number>;
    };

    const employeeMap = new Map<string, MusterEmployeeAccumulator>();

    for (const attendance of attendances) {
      const employee = attendance.employee;

      const employeeDesignationKey = `${employee.id}:${attendance.designation.id}`;

      let accumulator = employeeMap.get(employeeDesignationKey);

      if (!accumulator) {
        accumulator = {
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
          dateOfBirth: employee.dateOfBirth,
          gender: employee.gender,
          joiningDate: employee.joiningDate,
          designationId: attendance.designation.id,
          designationName: attendance.designation.designationName,
          attendanceByDay: new Map(),
          manualAttendanceDays: new Set<number>(),
        };

        employeeMap.set(employeeDesignationKey, accumulator);
      }

      const day = attendance.attendanceDate.getUTCDate();

      // Any manually punched Attendance row overrides the
      // organisation calendar WEEK_OFF for this employee/date.
      // This includes statuses intentionally hidden in reports.
      accumulator.manualAttendanceDays.add(day);

      const code = this.mapAttendanceStatusToReportCode(attendance.status);

      if (!code) {
        continue;
      }

      const dayEntries = accumulator.attendanceByDay.get(day) ?? [];

      dayEntries.push({
        shift: attendance.shift,
        code,
      });

      accumulator.attendanceByDay.set(day, dayEntries);
    }

    // -------------------------------------------------------
    // DAILY TOTALS
    // -------------------------------------------------------

    const dailyTotals = Array.from({ length: daysInMonth }, (_, index) => ({
      day: index + 1,
      mandays: 0,
    }));

    let totalDays = 0;
    let totalPaidHolidays = 0;

    // -------------------------------------------------------
    // FINAL EMPLOYEE ROWS
    // -------------------------------------------------------

    const employees = Array.from(employeeMap.values())
      .sort((a, b) => {
        const nameCompare = a.employeeName.localeCompare(b.employeeName);

        if (nameCompare !== 0) {
          return nameCompare;
        }

        return a.employeeId - b.employeeId;
      })
      .map((employee, index) => {
        let employeeDays = 0;
        let employeePaidHolidays = 0;

        const days = Array.from({ length: daysInMonth }, (_, dayIndex) => {
          const day = dayIndex + 1;

          const entries = this.sortAttendanceReportCodes(
            employee.attendanceByDay.get(day) ?? [],
          );

          const calendarEntry = holidayCalendar.calendarByDay.get(day);

          const code =
            entries.length > 0
              ? entries.map((entry) => entry.code).join('/')
              : !employee.manualAttendanceDays.has(day) &&
                  calendarEntry?.type === 'WEEK_OFF'
                ? 'WO'
                : '';

          let dayMandays = 0;

          for (const entry of entries) {
            if (entry.code === 'P') {
              dayMandays += 1;
            } else if (entry.code === 'HD') {
              dayMandays += 0.5;
            }

            if (entry.code === 'PH') {
              employeePaidHolidays += 1;
            }
          }

          employeeDays += dayMandays;
          dailyTotals[dayIndex].mandays += dayMandays;

          return {
            day,
            code,
          };
        });

        totalDays += employeeDays;
        totalPaidHolidays += employeePaidHolidays;

        return {
          serialNo: index + 1,

          employeeId: employee.employeeId,

          employeeName: employee.employeeName,

          age: this.calculateAttendanceReportAge(
            employee.dateOfBirth,
            reportEndDate,
          ),

          gender: employee.gender,

          joiningDate: employee.joiningDate,

          designation: {
            id: employee.designationId,
            designationName: employee.designationName,
          },

          days,

          totalDays: employeeDays,

          paidHolidays: employeePaidHolidays,
        };
      });

    // -------------------------------------------------------
    // RESPONSE
    // -------------------------------------------------------

    return {
      success: true,
      message: 'Muster report fetched successfully.',

      data: {
        report: {
          type: 'MUSTER',

          year: query.year,
          month: query.month,
          daysInMonth,

          site: context.site,

          workType: context.workType,

          department: context.department,

          shift: query.shift ?? null,

          calendarDays: holidayCalendar.calendarDays,
        },

        employees,

        totals: {
          daily: dailyTotals,
          days: totalDays,
          paidHolidays: totalPaidHolidays,
        },
      },
    };
  }
  // =========================================================
  // OT MUSTER REPORT
  //
  // Uses the same monthly Attendance dataset as Muster.
  //
  // OT is NEVER calculated from working hours.
  // It comes directly from manually entered Daily OT Attendance.
  //
  // Output:
  //
  // Sr No
  // Employee ID
  // Employee Name
  // Age
  // Sex
  // DOJ
  // Designation
  // Dynamic day columns containing OT hours
  // Total OT Hours
  // =========================================================

  async getOtMusterReport(query: AttendanceReportQueryDto) {
    // -------------------------------------------------------
    // ORGANISATION CONTEXT VALIDATION
    // -------------------------------------------------------

    const context = await this.resolveAttendanceReportContext(query);

    // -------------------------------------------------------
    // MONTH
    // -------------------------------------------------------

    const daysInMonth = new Date(
      Date.UTC(query.year, query.month, 0),
    ).getUTCDate();

    const reportEndDate = new Date(
      Date.UTC(query.year, query.month - 1, daysInMonth),
    );

    // -------------------------------------------------------
    // RAW OT ATTENDANCE
    // -------------------------------------------------------

    const [otAttendances, holidayCalendar] = await Promise.all([
      this.attendanceRepository.findMonthlyOtAttendanceReportData(query),
      this.getAttendanceReportCalendar(query.year, query.month),
    ]);

    // -------------------------------------------------------
    // EMPLOYEE GROUPING
    //
    // Multiple Attendance rows may exist for the same
    // employee/date when no Shift filter is supplied.
    //
    // OT is therefore SUMMED for the date.
    //
    // This is different from Muster, where only one attendance
    // status code is displayed for a date.
    // -------------------------------------------------------

    type OtMusterEmployeeAccumulator = {
      employeeId: number;
      employeeName: string;
      dateOfBirth: Date | null;
      gender: string | null;
      joiningDate: Date;
      designationId: number;
      designationName: string;
      otByDay: Map<number, number>;
    };

    const employeeMap = new Map<string, OtMusterEmployeeAccumulator>();

    for (const attendance of otAttendances) {
      const employee = attendance.employee;

      const employeeDesignationKey = `${employee.id}:${attendance.designation.id}`;

      let accumulator = employeeMap.get(employeeDesignationKey);

      if (!accumulator) {
        accumulator = {
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
          dateOfBirth: employee.dateOfBirth,
          gender: employee.gender,
          joiningDate: employee.joiningDate,
          designationId: attendance.designation.id,
          designationName: attendance.designation.designationName,
          otByDay: new Map<number, number>(),
        };

        employeeMap.set(employeeDesignationKey, accumulator);
      }

      const day = attendance.attendanceDate.getUTCDate();

      const otHours = Number(attendance.otHours);

      if (!Number.isFinite(otHours) || otHours <= 0) {
        continue;
      }

      const existingOtHours = accumulator.otByDay.get(day) ?? 0;

      accumulator.otByDay.set(day, existingOtHours + otHours);
    }

    // -------------------------------------------------------
    // DAILY TOTALS
    // -------------------------------------------------------

    const dailyTotals = Array.from({ length: daysInMonth }, (_, index) => ({
      day: index + 1,
      otHours: 0,
    }));

    let overallOtHours = 0;

    // -------------------------------------------------------
    // FINAL EMPLOYEE ROWS
    //
    // Keep only employees having OT in the selected period.
    // -------------------------------------------------------

    const employees = Array.from(employeeMap.values())
      .filter((employee) =>
        Array.from(employee.otByDay.values()).some((otHours) => otHours > 0),
      )
      .sort((a, b) => {
        const nameCompare = a.employeeName.localeCompare(b.employeeName);

        if (nameCompare !== 0) {
          return nameCompare;
        }

        return a.employeeId - b.employeeId;
      })
      .map((employee, index) => {
        let employeeTotalOtHours = 0;

        const days = Array.from({ length: daysInMonth }, (_, dayIndex) => {
          const day = dayIndex + 1;

          const otHours = employee.otByDay.get(day) ?? 0;

          employeeTotalOtHours += otHours;
          dailyTotals[dayIndex].otHours += otHours;

          return {
            day,
            otHours,
          };
        });

        overallOtHours += employeeTotalOtHours;

        return {
          serialNo: index + 1,

          employeeId: employee.employeeId,

          employeeName: employee.employeeName,

          age: this.calculateAttendanceReportAge(
            employee.dateOfBirth,
            reportEndDate,
          ),

          gender: employee.gender,

          joiningDate: employee.joiningDate,

          designation: {
            id: employee.designationId,
            designationName: employee.designationName,
          },

          days,

          totalOtHours: employeeTotalOtHours,
        };
      });

    // -------------------------------------------------------
    // RESPONSE
    // -------------------------------------------------------

    return {
      success: true,
      message: 'OT Muster report fetched successfully.',

      data: {
        report: {
          type: 'OT_MUSTER',

          year: query.year,
          month: query.month,
          daysInMonth,

          site: context.site,

          workType: context.workType,

          department: context.department,

          shift: query.shift ?? null,

          // Calendar metadata only. It must never generate
          // or change manually entered OT values.
          calendarDays: holidayCalendar.calendarDays,
        },

        employees,

        totals: {
          daily: dailyTotals,
          otHours: overallOtHours,
        },
      },
    };
  }
  // =========================================================
  // MUSTER WITH OT REPORT
  //
  // Combines:
  // - Attendance status code
  // - Manually entered OT hours
  //
  // Attendance codes:
  // PRESENT      -> P
  // ABSENT       -> A
  // WEEKLY_OFF   -> WO
  // HALF_DAY     -> HD
  // PAID_HOLIDAY -> PH
  //
  // LEAVE / HOLIDAY are ignored.
  //
  // Mandays:
  // P  = 1
  // HD = 0.5
  //
  // OT is taken directly from OtAttendance.otHours.
  // No automatic working-hour calculation.
  // =========================================================

  async getMusterWithOtReport(query: AttendanceReportQueryDto) {
    // -------------------------------------------------------
    // ORGANISATION CONTEXT VALIDATION
    // -------------------------------------------------------

    const context = await this.resolveAttendanceReportContext(query);

    // -------------------------------------------------------
    // MONTH
    // -------------------------------------------------------

    const daysInMonth = new Date(
      Date.UTC(query.year, query.month, 0),
    ).getUTCDate();

    const reportEndDate = new Date(
      Date.UTC(query.year, query.month - 1, daysInMonth),
    );

    // -------------------------------------------------------
    // RAW ATTENDANCE
    // -------------------------------------------------------

    const [attendances, otAttendances, holidayCalendar] = await Promise.all([
      this.attendanceRepository.findMonthlyAttendanceReportData(query),
      this.attendanceRepository.findMonthlyOtAttendanceReportData(query),
      this.getAttendanceReportCalendar(query.year, query.month),
    ]);

    // -------------------------------------------------------
    // EMPLOYEE GROUPING
    // -------------------------------------------------------

    type MusterWithOtEmployeeAccumulator = {
      employeeId: number;
      employeeName: string;
      dateOfBirth: Date | null;
      gender: string | null;
      joiningDate: Date;
      designationId: number;
      designationName: string;

      attendanceByDay: Map<number, Array<{ shift: string; code: string }>>;
      manualAttendanceDays: Set<number>;
      otByDay: Map<number, number>;
    };

    const employeeMap = new Map<string, MusterWithOtEmployeeAccumulator>();

    for (const attendance of attendances) {
      const employee = attendance.employee;

      const employeeDesignationKey = `${employee.id}:${attendance.designation.id}`;

      let accumulator = employeeMap.get(employeeDesignationKey);

      if (!accumulator) {
        accumulator = {
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
          dateOfBirth: employee.dateOfBirth,
          gender: employee.gender,
          joiningDate: employee.joiningDate,
          designationId: attendance.designation.id,
          designationName: attendance.designation.designationName,
          attendanceByDay: new Map(),
          manualAttendanceDays: new Set<number>(),
          otByDay: new Map<number, number>(),
        };

        employeeMap.set(employeeDesignationKey, accumulator);
      }

      const day = attendance.attendanceDate.getUTCDate();

      // Any manually punched Attendance row overrides the
      // organisation calendar WEEK_OFF for this employee/date.
      accumulator.manualAttendanceDays.add(day);

      // -----------------------------------------------------
      // ATTENDANCE CODE
      // -----------------------------------------------------

      const code = this.mapAttendanceStatusToReportCode(attendance.status);

      if (code) {
        const dayEntries = accumulator.attendanceByDay.get(day) ?? [];

        dayEntries.push({
          shift: attendance.shift,
          code,
        });

        accumulator.attendanceByDay.set(day, dayEntries);
      }
    }
    // -------------------------------------------------------
    // RAW DAILY OT ATTENDANCE
    //
    // OT is stored separately from Daily Attendance.
    // Multiple OT shifts for the same employee/date are summed.
    // -------------------------------------------------------

    for (const otAttendance of otAttendances) {
      const employee = otAttendance.employee;

      const employeeDesignationKey = `${employee.id}:${otAttendance.designation.id}`;

      let accumulator = employeeMap.get(employeeDesignationKey);

      if (!accumulator) {
        accumulator = {
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`.trim(),
          dateOfBirth: employee.dateOfBirth,
          gender: employee.gender,
          joiningDate: employee.joiningDate,

          designationId: otAttendance.designation.id,
          designationName: otAttendance.designation.designationName,

          attendanceByDay: new Map(),
          manualAttendanceDays: new Set<number>(),
          otByDay: new Map<number, number>(),
        };

        employeeMap.set(employeeDesignationKey, accumulator);
      }

      const day = otAttendance.attendanceDate.getUTCDate();

      const otHours = Number(otAttendance.otHours);

      if (!Number.isFinite(otHours) || otHours <= 0) {
        continue;
      }

      const existingOtHours = accumulator.otByDay.get(day) ?? 0;

      accumulator.otByDay.set(day, existingOtHours + otHours);
    }

    // -------------------------------------------------------
    // DAILY TOTALS
    // -------------------------------------------------------

    const dailyTotals = Array.from({ length: daysInMonth }, (_, index) => ({
      day: index + 1,
      mandays: 0,
      otHours: 0,
    }));

    let overallDays = 0;
    let overallPaidHolidays = 0;
    let overallOtHours = 0;

    // -------------------------------------------------------
    // FINAL EMPLOYEE ROWS
    // -------------------------------------------------------

    const employees = Array.from(employeeMap.values())
      .sort((a, b) => {
        const nameCompare = a.employeeName.localeCompare(b.employeeName);

        if (nameCompare !== 0) {
          return nameCompare;
        }

        return a.employeeId - b.employeeId;
      })
      .map((employee, index) => {
        let employeeDays = 0;
        let employeePaidHolidays = 0;
        let employeeOtHours = 0;

        const days = Array.from({ length: daysInMonth }, (_, dayIndex) => {
          const day = dayIndex + 1;

          const entries = this.sortAttendanceReportCodes(
            employee.attendanceByDay.get(day) ?? [],
          );

          const calendarEntry = holidayCalendar.calendarByDay.get(day);

          const code =
            entries.length > 0
              ? entries.map((entry) => entry.code).join('/')
              : !employee.manualAttendanceDays.has(day) &&
                  calendarEntry?.type === 'WEEK_OFF'
                ? 'WO'
                : '';

          const otHours = employee.otByDay.get(day) ?? 0;

          let dayMandays = 0;

          for (const entry of entries) {
            if (entry.code === 'P') {
              dayMandays += 1;
            } else if (entry.code === 'HD') {
              dayMandays += 0.5;
            }

            if (entry.code === 'PH') {
              employeePaidHolidays += 1;
            }
          }

          employeeDays += dayMandays;
          dailyTotals[dayIndex].mandays += dayMandays;

          // Manual OT
          employeeOtHours += otHours;
          dailyTotals[dayIndex].otHours += otHours;

          return {
            day,
            code,
            otHours,
          };
        });

        overallDays += employeeDays;
        overallPaidHolidays += employeePaidHolidays;
        overallOtHours += employeeOtHours;

        return {
          serialNo: index + 1,

          employeeId: employee.employeeId,

          employeeName: employee.employeeName,

          age: this.calculateAttendanceReportAge(
            employee.dateOfBirth,
            reportEndDate,
          ),

          gender: employee.gender,

          joiningDate: employee.joiningDate,

          designation: {
            id: employee.designationId,
            designationName: employee.designationName,
          },

          days,

          totalDays: employeeDays,

          paidHolidays: employeePaidHolidays,

          totalOtHours: employeeOtHours,
        };
      });

    // -------------------------------------------------------
    // RESPONSE
    // -------------------------------------------------------

    return {
      success: true,
      message: 'Muster with OT report fetched successfully.',

      data: {
        report: {
          type: 'MUSTER_WITH_OT',

          year: query.year,
          month: query.month,
          daysInMonth,

          site: context.site,

          workType: context.workType,

          department: context.department,

          shift: query.shift ?? null,

          calendarDays: holidayCalendar.calendarDays,
        },

        employees,

        totals: {
          daily: dailyTotals,
          days: overallDays,
          paidHolidays: overallPaidHolidays,
          otHours: overallOtHours,
        },
      },
    };
  }
  // =========================================================
  // FORM XXIII - REGISTER OF OVERTIME
  //
  // Locked report rules:
  //
  // - Site + Month report
  // - No Work Type
  // - No Department
  // - No Shift filter
  // - Requires FINALIZED payroll
  // - Site-specific OT hours come from Attendance
  // - Historical wage / OT rate comes from Payroll snapshot
  // - Payment date remains null until payment handling exists
  //
  // Excel printing later:
  // - A4
  // - Portrait
  // - Dynamic employee count / print area
  // =========================================================

  async getFormXxiiiReport(query: FormXxiiiReportQueryDto) {
    // -------------------------------------------------------
    // SITE
    // -------------------------------------------------------

    const site = await this.attendanceRepository.findFormXxiiiSite(
      query.siteId,
    );

    if (!site) {
      throw new NotFoundException('Site not found.');
    }

    // -------------------------------------------------------
    // SALARY MONTH
    // -------------------------------------------------------

    const salaryMonth = new Date(Date.UTC(query.year, query.month - 1, 1));

    // -------------------------------------------------------
    // SITE-SPECIFIC HISTORICAL OT
    // -------------------------------------------------------

    const attendanceRows =
      await this.attendanceRepository.findFormXxiiiSiteOtAttendance(query);

    const otHoursByEmployee = new Map<number, number>();

    for (const attendance of attendanceRows) {
      const otHours = Number(attendance.otHours);

      if (!Number.isFinite(otHours) || otHours <= 0) {
        continue;
      }

      const current = otHoursByEmployee.get(attendance.employeeId) ?? 0;

      otHoursByEmployee.set(attendance.employeeId, current + otHours);
    }

    const employeeIds = Array.from(otHoursByEmployee.keys());

    // -------------------------------------------------------
    // FINALIZED PAYROLL
    //
    // Even when no employee has OT at this Site, payroll must
    // still be finalized before Form XXIII is considered
    // available for the month.
    // -------------------------------------------------------

    const payrollRun =
      await this.attendanceRepository.findFormXxiiiFinalizedPayroll(
        salaryMonth,
        employeeIds,
      );

    if (!payrollRun) {
      throw new ConflictException(
        'Form XXIII cannot be generated because payroll for the selected month is not finalized.',
      );
    }

    // -------------------------------------------------------
    // EMPLOYEE ROWS
    // -------------------------------------------------------

    const employees = payrollRun.snapshots
      .map((snapshot) => {
        const otHours = otHoursByEmployee.get(snapshot.employeeId) ?? 0;

        if (otHours <= 0) {
          return null;
        }

        const monthlyBasic = Number(snapshot.monthlyBasic);
        const monthlyDa = Number(snapshot.monthlyDa);
        const otRate = Number(snapshot.otRate);

        const normalRatePerDay = (monthlyBasic + monthlyDa) / 26;

        const overtimeEarnings = otRate * otHours;

        return {
          employeeId: snapshot.employeeId,
          employeeName: snapshot.employeeName,

          gender: snapshot.gender,

          designation: {
            id: snapshot.designationId,
            designationName: snapshot.designationName,
          },

          overtimeWorkedDate: 'AS PER MUSTER ATTACHED',

          totalOtHours: otHours,

          normalRatePerDay,

          otRatePerHour: otRate,

          overtimeEarnings,

          // Payment handling has not yet been implemented.
          // Do not substitute Payroll finalizedAt.
          paymentDate: null,

          remarks: snapshot.bankName,
        };
      })
      .filter(
        (employee): employee is NonNullable<typeof employee> =>
          employee !== null,
      )
      .sort((a, b) => {
        const nameCompare = a.employeeName.localeCompare(b.employeeName);

        if (nameCompare !== 0) {
          return nameCompare;
        }

        return a.employeeId - b.employeeId;
      })
      .map((employee, index) => ({
        serialNo: index + 1,
        ...employee,
      }));

    // -------------------------------------------------------
    // TOTALS
    // -------------------------------------------------------

    const totalOtHours = employees.reduce(
      (total, employee) => total + employee.totalOtHours,
      0,
    );

    const totalOvertimeEarnings = employees.reduce(
      (total, employee) => total + employee.overtimeEarnings,
      0,
    );

    // -------------------------------------------------------
    // RESPONSE
    // -------------------------------------------------------

    return {
      success: true,

      message: 'Form XXIII Register of Overtime fetched successfully.',

      data: {
        report: {
          type: 'FORM_XXIII_OVERTIME_REGISTER',

          year: query.year,
          month: query.month,

          site: {
            id: site.id,
            siteName: site.siteName,
          },

          payrollRun: {
            id: payrollRun.id,
            version: payrollRun.version,
            salaryMonth: payrollRun.salaryMonth,
            finalizedAt: payrollRun.finalizedAt,
          },

          print: {
            paperSize: 'A4',
            orientation: 'PORTRAIT',
            dynamicPrintArea: true,
          },
        },

        employees,

        totals: {
          employeeCount: employees.length,
          otHours: totalOtHours,
          overtimeEarnings: totalOvertimeEarnings,
        },
      },
    };
  }
  // =========================================================
  // MUSTER CUT FILE
  //
  // Approved aggregation:
  //
  // Department
  //   -> Designation
  //      -> FIRST
  //      -> SECOND
  //      -> THIRD
  //      -> TOTAL
  //
  // Manday calculation:
  //
  // PRESENT  = 1.0
  // HALF_DAY = 0.5
  //
  // All other Attendance statuses contribute 0 mandays.
  //
  // Dynamic dates:
  // 28 / 29 / 30 / 31 according to selected month.
  // =========================================================

  async getMusterCutFileReport(query: MusterCutFileQueryDto) {
    // -------------------------------------------------------
    // OPTIONAL ORGANISATION CONTEXT
    // -------------------------------------------------------

    const context = await this.resolveAttendanceReportContext(query);

    // -------------------------------------------------------
    // MONTH
    // -------------------------------------------------------

    const daysInMonth = new Date(
      Date.UTC(query.year, query.month, 0),
    ).getUTCDate();

    // -------------------------------------------------------
    // RAW ATTENDANCE
    // -------------------------------------------------------

    const [attendances, holidayCalendar] = await Promise.all([
      this.attendanceRepository.findMusterCutFileData(query),
      this.getAttendanceReportCalendar(query.year, query.month),
    ]);

    // -------------------------------------------------------
    // INTERNAL TYPES
    // -------------------------------------------------------

    type ShiftKey = 'FIRST' | 'SECOND' | 'THIRD';

    type ShiftAccumulator = {
      daily: number[];
    };

    type GroupAccumulator = {
      departmentId: number;
      departmentName: string;

      designationId: number;
      designationName: string;

      shifts: Record<ShiftKey, ShiftAccumulator>;
    };

    const createShiftAccumulator = (): ShiftAccumulator => ({
      daily: Array.from({ length: daysInMonth }, () => 0),
    });

    const groupMap = new Map<string, GroupAccumulator>();

    // -------------------------------------------------------
    // AGGREGATION
    // -------------------------------------------------------

    for (const attendance of attendances) {
      /*
       * Historical Attendance rows without Department cannot
       * be placed into an operational Cut File.
       */
      if (!attendance.department) {
        continue;
      }

      let mandays = 0;

      if (attendance.status === 'PRESENT') {
        mandays = 1;
      } else if (attendance.status === 'HALF_DAY') {
        mandays = 0.5;
      } else {
        continue;
      }

      const designation = attendance.designation;

      const key = `${attendance.department.id}:${designation.id}`;

      let group = groupMap.get(key);

      if (!group) {
        group = {
          departmentId: attendance.department.id,
          departmentName: attendance.department.departmentName,

          designationId: designation.id,
          designationName: designation.designationName,

          shifts: {
            FIRST: createShiftAccumulator(),
            SECOND: createShiftAccumulator(),
            THIRD: createShiftAccumulator(),
          },
        };

        groupMap.set(key, group);
      }

      const dayIndex = attendance.attendanceDate.getUTCDate() - 1;

      group.shifts[attendance.shift].daily[dayIndex] += mandays;
    }

    // -------------------------------------------------------
    // GRAND DAILY TOTALS
    // -------------------------------------------------------

    const grandDailyTotals = Array.from(
      { length: daysInMonth },
      (_, index) => ({
        day: index + 1,
        mandays: 0,
      }),
    );

    let grandTotalMandays = 0;

    // -------------------------------------------------------
    // FINAL GROUPS
    // -------------------------------------------------------

    const groups = Array.from(groupMap.values())
      .sort((a, b) => {
        const departmentCompare = a.departmentName.localeCompare(
          b.departmentName,
        );

        if (departmentCompare !== 0) {
          return departmentCompare;
        }

        const designationCompare = a.designationName.localeCompare(
          b.designationName,
        );

        if (designationCompare !== 0) {
          return designationCompare;
        }

        return a.designationId - b.designationId;
      })
      .map((group) => {
        const shiftOrder: Array<{
          key: ShiftKey;
          label: string;
        }> = [
          {
            key: 'FIRST',
            label: '1st',
          },
          {
            key: 'SECOND',
            label: '2nd',
          },
          {
            key: 'THIRD',
            label: '3rd',
          },
        ];

        const shifts = shiftOrder.map(({ key, label }) => {
          const days = group.shifts[key].daily.map((mandays, index) => ({
            day: index + 1,
            mandays,
          }));

          const total = group.shifts[key].daily.reduce(
            (sum, mandays) => sum + mandays,
            0,
          );

          return {
            shift: key,
            shiftLabel: label,
            days,
            total,
          };
        });

        const totalDays = Array.from({ length: daysInMonth }, (_, dayIndex) => {
          const mandays =
            group.shifts.FIRST.daily[dayIndex] +
            group.shifts.SECOND.daily[dayIndex] +
            group.shifts.THIRD.daily[dayIndex];

          grandDailyTotals[dayIndex].mandays += mandays;

          return {
            day: dayIndex + 1,
            mandays,
          };
        });

        const total = totalDays.reduce((sum, day) => sum + day.mandays, 0);

        grandTotalMandays += total;

        return {
          department: {
            id: group.departmentId,
            departmentName: group.departmentName,
          },

          designation: {
            id: group.designationId,
            designationName: group.designationName,
          },

          shifts,

          totalRow: {
            label: 'TOTAL',
            days: totalDays,
            total,
          },
        };
      });

    // -------------------------------------------------------
    // RESPONSE
    // -------------------------------------------------------

    return {
      success: true,

      message: 'Muster Cut File report fetched successfully.',

      data: {
        report: {
          type: 'MUSTER_CUT_FILE',

          title: 'REGULAR MUSTER CUTFILE',

          year: query.year,
          month: query.month,
          daysInMonth,

          site: context.site,

          workType: context.workType,

          filters: {
            departmentId: query.departmentId ?? null,

            designationId: query.designationId ?? null,

            shift: query.shift ?? null,
          },

          // Metadata only for date-column coloring.
          // Calendar entries must not affect Cut File mandays.
          calendarDays: holidayCalendar.calendarDays,

          print: {
            paperSize: 'A4',
            orientation: 'LANDSCAPE',
            dynamicPrintArea: true,
          },
        },

        groups,

        totals: {
          daily: grandDailyTotals,
          mandays: grandTotalMandays,
        },
      },
    };
  }
  // =========================================================
  // OT MUSTER CUT FILE
  //
  // Approved Excel structure:
  //
  // Department
  //   -> Designation
  //      -> OT HOURS slab
  //
  // Daily cells contain EMPLOYEE COUNT for the exact
  // OT-hours slab.
  //
  // Example:
  //
  // HOURS = 2
  // Day 16 count = 3
  //
  // Means:
  // 3 employees worked exactly 2 OT hours on Day 16.
  //
  // Row OT total:
  //
  // Sum(employee counts across month) * HOURS
  //
  // OT is taken ONLY from manually entered OtAttendance.otHours.
  // =========================================================

  async getOtMusterCutFileReport(query: MusterCutFileQueryDto) {
    // -------------------------------------------------------
    // OPTIONAL ORGANISATION CONTEXT
    // -------------------------------------------------------

    const context = await this.resolveAttendanceReportContext(query);

    // -------------------------------------------------------
    // MONTH
    // -------------------------------------------------------

    const daysInMonth = new Date(
      Date.UTC(query.year, query.month, 0),
    ).getUTCDate();

    // -------------------------------------------------------
    // RAW DAILY OT ATTENDANCE
    // -------------------------------------------------------

    const [attendances, holidayCalendar] = await Promise.all([
      this.attendanceRepository.findOtMusterCutFileData(query),
      this.getAttendanceReportCalendar(query.year, query.month),
    ]);

    // -------------------------------------------------------
    // STEP 1
    //
    // SUM OT PER:
    //
    // Department + Designation + Employee + Date
    //
    // This prevents the same employee from being counted twice
    // merely because OT was entered under more than one Shift
    // on the same date.
    // -------------------------------------------------------

    type EmployeeDailyOtAccumulator = {
      departmentId: number;
      departmentName: string;

      designationId: number;
      designationName: string;

      employeeId: number;

      day: number;

      otHours: number;
    };

    const employeeDailyMap = new Map<string, EmployeeDailyOtAccumulator>();

    for (const attendance of attendances) {
      if (!attendance.department) {
        continue;
      }

      const otHours = Number(attendance.otHours);

      if (!Number.isFinite(otHours) || otHours <= 0) {
        continue;
      }

      const designation = attendance.designation;

      const day = attendance.attendanceDate.getUTCDate();

      const key = [
        attendance.department.id,
        designation.id,
        attendance.employeeId,
        day,
      ].join(':');

      const existing = employeeDailyMap.get(key);

      if (existing) {
        existing.otHours += otHours;
      } else {
        employeeDailyMap.set(key, {
          departmentId: attendance.department.id,
          departmentName: attendance.department.departmentName,

          designationId: designation.id,
          designationName: designation.designationName,

          employeeId: attendance.employeeId,

          day,

          otHours,
        });
      }
    }

    // -------------------------------------------------------
    // STEP 2
    //
    // GROUP EMPLOYEE/DAY VALUES INTO EXACT OT-HOUR SLABS
    // -------------------------------------------------------

    type OtSlabAccumulator = {
      hours: number;
      dailyEmployeeCounts: number[];
    };

    type OtCutFileGroupAccumulator = {
      departmentId: number;
      departmentName: string;

      designationId: number;
      designationName: string;

      slabs: Map<number, OtSlabAccumulator>;
    };

    const groupMap = new Map<string, OtCutFileGroupAccumulator>();

    const allHourSlabs = new Set<number>();

    for (const employeeDaily of employeeDailyMap.values()) {
      /*
       * Normalize Decimal -> number for stable grouping.
       *
       * Attendance currently accepts OT in 0.5-hour steps,
       * but we do not hard-code only those values here.
       */
      const hours = Number(employeeDaily.otHours.toFixed(2));

      if (hours <= 0) {
        continue;
      }

      allHourSlabs.add(hours);

      const groupKey = `${employeeDaily.departmentId}:${employeeDaily.designationId}`;

      let group = groupMap.get(groupKey);

      if (!group) {
        group = {
          departmentId: employeeDaily.departmentId,
          departmentName: employeeDaily.departmentName,

          designationId: employeeDaily.designationId,
          designationName: employeeDaily.designationName,

          slabs: new Map<number, OtSlabAccumulator>(),
        };

        groupMap.set(groupKey, group);
      }

      let slab = group.slabs.get(hours);

      if (!slab) {
        slab = {
          hours,
          dailyEmployeeCounts: Array.from({ length: daysInMonth }, () => 0),
        };

        group.slabs.set(hours, slab);
      }

      slab.dailyEmployeeCounts[employeeDaily.day - 1] += 1;
    }

    // -------------------------------------------------------
    // GRAND TOTALS
    //
    // employeeCount = employee/day occurrences
    // otHours       = actual total manual OT hours
    // -------------------------------------------------------

    const grandDailyTotals = Array.from(
      { length: daysInMonth },
      (_, index) => ({
        day: index + 1,
        employeeCount: 0,
        otHours: 0,
      }),
    );

    let grandEmployeeCount = 0;
    let grandOtHours = 0;

    // -------------------------------------------------------
    // FINAL GROUPS
    // -------------------------------------------------------

    const groups = Array.from(groupMap.values())
      .sort((a, b) => {
        const departmentCompare = a.departmentName.localeCompare(
          b.departmentName,
        );

        if (departmentCompare !== 0) {
          return departmentCompare;
        }

        const designationCompare = a.designationName.localeCompare(
          b.designationName,
        );

        if (designationCompare !== 0) {
          return designationCompare;
        }

        return a.designationId - b.designationId;
      })
      .map((group) => {
        const groupDailyTotals = Array.from(
          { length: daysInMonth },
          (_, index) => ({
            day: index + 1,
            employeeCount: 0,
            otHours: 0,
          }),
        );

        let groupEmployeeCount = 0;
        let groupOtHours = 0;

        const hourRows = Array.from(group.slabs.values())
          .sort((a, b) => a.hours - b.hours)
          .map((slab) => {
            let totalEmployeeCount = 0;

            const days = slab.dailyEmployeeCounts.map(
              (employeeCount, dayIndex) => {
                const otHours = employeeCount * slab.hours;

                totalEmployeeCount += employeeCount;

                groupDailyTotals[dayIndex].employeeCount += employeeCount;

                groupDailyTotals[dayIndex].otHours += otHours;

                return {
                  day: dayIndex + 1,
                  employeeCount,
                };
              },
            );

            const totalOtHours = totalEmployeeCount * slab.hours;

            groupEmployeeCount += totalEmployeeCount;
            groupOtHours += totalOtHours;

            return {
              hours: slab.hours,

              days,

              totalEmployeeCount,

              totalOtHours,
            };
          });

        for (let dayIndex = 0; dayIndex < daysInMonth; dayIndex += 1) {
          grandDailyTotals[dayIndex].employeeCount +=
            groupDailyTotals[dayIndex].employeeCount;

          grandDailyTotals[dayIndex].otHours +=
            groupDailyTotals[dayIndex].otHours;
        }

        grandEmployeeCount += groupEmployeeCount;
        grandOtHours += groupOtHours;

        return {
          department: {
            id: group.departmentId,
            departmentName: group.departmentName,
          },

          designation: {
            id: group.designationId,
            designationName: group.designationName,
          },

          hourRows,

          totalRow: {
            label: 'TOTAL',

            days: groupDailyTotals,

            employeeCount: groupEmployeeCount,

            otHours: groupOtHours,
          },
        };
      });

    // -------------------------------------------------------
    // RESPONSE
    // -------------------------------------------------------

    return {
      success: true,

      message: 'OT Muster Cut File report fetched successfully.',

      data: {
        report: {
          type: 'OT_MUSTER_CUT_FILE',

          title: 'OT MUSTER CUTFILE',

          year: query.year,
          month: query.month,
          daysInMonth,

          site: context.site,

          workType: context.workType,

          filters: {
            departmentId: query.departmentId ?? null,

            designationId: query.designationId ?? null,

            shift: query.shift ?? null,
          },

          hourSlabs: Array.from(allHourSlabs).sort((a, b) => a - b),

          // Metadata only for date-column coloring.
          // Calendar entries must not affect OT slabs,
          // employee counts or OT totals.
          calendarDays: holidayCalendar.calendarDays,

          print: {
            paperSize: 'A4',
            orientation: 'LANDSCAPE',
            dynamicPrintArea: true,
          },
        },

        groups,

        totals: {
          daily: grandDailyTotals,

          employeeCount: grandEmployeeCount,

          otHours: grandOtHours,
        },
      },
    };
  }

  // =========================================================
  // FIND BY ID
  // =========================================================

  async findAttendanceById(id: number) {
    const attendance = await this.attendanceRepository.findAttendanceById(id);

    if (!attendance) {
      throw new NotFoundException('Attendance record not found.');
    }

    return {
      success: true,

      message: 'Attendance record fetched successfully.',

      data: attendance,
    };
  }

  // =========================================================
  // UPDATE
  //
  // Important:
  //
  // If attendanceDate itself is being changed, BOTH:
  //
  // - original month
  // - target month
  //
  // must be unlocked.
  //
  // This prevents moving attendance out of or into a locked
  // payroll month.
  // =========================================================

  async updateAttendance(id: number, updateAttendanceDto: UpdateAttendanceDto) {
    const attendance = await this.attendanceRepository.findAttendanceById(id);

    if (!attendance) {
      throw new NotFoundException('Attendance record not found.');
    }

    // -------------------------------------------------------
    // ORIGINAL MONTH
    // -------------------------------------------------------

    const originalSiteId =
      attendance.department?.workType.site.id ?? null;

    await this.validateAttendanceSiteMonthUnlocked(
      attendance.attendanceDate,
      originalSiteId,
    );

    // -------------------------------------------------------
    // TARGET MONTH
    //
    // Required only if attendanceDate is being changed.
    // -------------------------------------------------------

    const targetAttendanceDate = updateAttendanceDto.attendanceDate
      ? new Date(updateAttendanceDto.attendanceDate)
      : attendance.attendanceDate;
    const targetEmployeeId =
      updateAttendanceDto.employeeId ?? attendance.employee.id;

    const targetDepartmentId =
      updateAttendanceDto.departmentId ?? attendance.department?.id;

    const targetDesignationId =
      updateAttendanceDto.designationId ?? attendance.designation.id;

    if (!targetDepartmentId) {
      throw new BadRequestException(
        'Attendance must have a Department before it can be updated.',
      );
    }

    const targetSiteId =
      await this.resolveAttendanceSiteId(targetDepartmentId);

    const originalMonth = this.normalizeSalaryMonth(
      attendance.attendanceDate,
    ).getTime();

    const targetMonth =
      this.normalizeSalaryMonth(targetAttendanceDate).getTime();

    if (
      originalMonth !== targetMonth ||
      originalSiteId !== targetSiteId
    ) {
      await this.validateAttendanceSiteMonthUnlocked(
        targetAttendanceDate,
        targetSiteId,
      );
    }

    await this.validateAttendanceContext(
      targetEmployeeId,
      targetDepartmentId,
      targetDesignationId,
    );

    const updatedAttendance = await this.attendanceRepository.updateAttendance(
      id,
      updateAttendanceDto,
    );

    return {
      success: true,
      message: 'Attendance updated successfully.',
      data: updatedAttendance,
    };
  }

  // =========================================================
  // DELETE
  // =========================================================

  async deleteAttendance(id: number) {
    const attendance = await this.attendanceRepository.findAttendanceById(id);

    if (!attendance) {
      throw new NotFoundException('Attendance record not found.');
    }

    const siteId =
      attendance.department?.workType.site.id ?? null;

    await this.validateAttendanceSiteMonthUnlocked(
      attendance.attendanceDate,
      siteId,
    );

    await this.attendanceRepository.deleteAttendance(id);

    return {
      success: true,
      message: 'Attendance deleted successfully.',
    };
  }
}
