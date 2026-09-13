import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OtAttendanceRepository } from '../repository/ot-attendance.repository';
import { CreateOtAttendanceDto } from '../dto/create-ot-attendance.dto';
import { BulkOtAttendanceDto } from '../dto/bulk-ot-attendance.dto';
import { UpdateOtAttendanceDto } from '../dto/update-ot-attendance.dto';
import { OtAttendanceQueryDto } from '../dto/ot-attendance-query.dto';

@Injectable()
export class OtAttendanceService {
  constructor(
    private readonly otAttendanceRepository: OtAttendanceRepository,
  ) {}

  private normalizeSalaryMonth(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private async validateSiteMonthUnlocked(
    attendanceDate: Date,
    siteId: number | null,
  ): Promise<void> {
    const salaryMonth = this.normalizeSalaryMonth(attendanceDate);

    const finalizedPayroll =
      await this.otAttendanceRepository.findFinalizedPayrollRunForSiteAndMonth(
        siteId,
        salaryMonth,
      );

    if (finalizedPayroll) {
      const lockScope =
        finalizedPayroll.siteId === null
          ? 'legacy company-wide payroll'
          : `Site ${finalizedPayroll.siteId}`;

      throw new ConflictException(
        `OT Attendance for ${salaryMonth.toISOString()} is locked because Payroll Run version ${finalizedPayroll.version} is finalized for ${lockScope}. Unlock payroll before modifying OT attendance.`,
      );
    }
  }

  private async resolveOtAttendanceSiteId(
    departmentId: number,
  ): Promise<number> {
    const department =
      await this.otAttendanceRepository.findDepartmentContext(
        departmentId,
      );

    if (!department) {
      throw new NotFoundException(
        `Department with ID ${departmentId} not found.`,
      );
    }

    return department.workType.siteId;
  }

  private async validateContext(
    employeeId: number,
    departmentId: number,
    designationId: number,
  ): Promise<void> {
    const [employee, department, designation] = await Promise.all([
      this.otAttendanceRepository.findEmployeeContext(employeeId),
      this.otAttendanceRepository.findDepartmentContext(departmentId),
      this.otAttendanceRepository.findDesignationContext(designationId),
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

    /*
     * Do NOT compare designationId with Employee.designationId.
     *
     * This designation represents the work performed for this
     * OT entry. Payroll Wage Master selection continues to use
     * Employee.designationId.
     */
  }

  private async validateBulkContext(
    employeeIds: number[],
    departmentId: number,
    designationId: number,
  ): Promise<void> {
    const [department, designation, employees] = await Promise.all([
      this.otAttendanceRepository.findDepartmentContext(departmentId),
      this.otAttendanceRepository.findDesignationContext(designationId),
      this.otAttendanceRepository.findEmployeesContext(employeeIds),
    ]);

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

  async create(dto: CreateOtAttendanceDto) {
    const attendanceDate = new Date(dto.attendanceDate);

    const siteId = await this.resolveOtAttendanceSiteId(
      dto.departmentId,
    );

    await this.validateSiteMonthUnlocked(
      attendanceDate,
      siteId,
    );

    await this.validateContext(
      dto.employeeId,
      dto.departmentId,
      dto.designationId,
    );

    const existing = await this.otAttendanceRepository.findExisting(
      attendanceDate,
      [dto.employeeId],
      dto.shift,
    );

    if (existing.length > 0) {
      throw new ConflictException(
        'OT Attendance already exists for the selected employee, date and shift.',
      );
    }

    const record = await this.otAttendanceRepository.create(dto);

    return {
      success: true,
      message: 'OT Attendance marked successfully.',
      data: record,
    };
  }

  async bulkCreate(dto: BulkOtAttendanceDto) {
    const attendanceDate = new Date(dto.attendanceDate);

    const siteId = await this.resolveOtAttendanceSiteId(
      dto.departmentId,
    );

    await this.validateSiteMonthUnlocked(
      attendanceDate,
      siteId,
    );

    const uniqueEmployeeIds = [...new Set(dto.employeeIds)];

    if (uniqueEmployeeIds.length !== dto.employeeIds.length) {
      throw new BadRequestException(
        'Duplicate Employee IDs are not allowed in the same OT Attendance request.',
      );
    }

    await this.validateBulkContext(
      uniqueEmployeeIds,
      dto.departmentId,
      dto.designationId,
    );

    const existing = await this.otAttendanceRepository.findExisting(
      attendanceDate,
      uniqueEmployeeIds,
      dto.shift,
    );

    if (existing.length > 0) {
      throw new ConflictException({
        message:
          'OT Attendance already exists for the selected employee(s) and shift.',

        duplicates: existing.map((record) => ({
          employeeId: record.employeeId,
          firstName: record.employee.firstName,
          lastName: record.employee.lastName,
          shift: record.shift,
        })),
      });
    }

    const records = await this.otAttendanceRepository.bulkCreate({
      ...dto,
      employeeIds: uniqueEmployeeIds,
    });

    return {
      success: true,
      message: 'OT Attendance marked successfully.',

      data: {
        processed: records.length,
      },
    };
  }

  async findAll(query: OtAttendanceQueryDto) {
    const result = await this.otAttendanceRepository.findAll(query);

    return {
      success: true,
      message: 'OT Attendance records fetched successfully.',
      data: result.records,

      pagination: {
        page: query.page,
        limit: query.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / query.limit),
      },
    };
  }

  async findById(id: number) {
    const record = await this.otAttendanceRepository.findById(id);

    if (!record) {
      throw new NotFoundException('OT Attendance record not found.');
    }

    return {
      success: true,
      message: 'OT Attendance record fetched successfully.',
      data: record,
    };
  }

  async update(id: number, dto: UpdateOtAttendanceDto) {
    const current = await this.otAttendanceRepository.findById(id);

    if (!current) {
      throw new NotFoundException('OT Attendance record not found.');
    }

    const originalSiteId =
      current.department?.workType.site.id ?? null;

    await this.validateSiteMonthUnlocked(
      current.attendanceDate,
      originalSiteId,
    );

    const targetDate = dto.attendanceDate
      ? new Date(dto.attendanceDate)
      : current.attendanceDate;


    const employeeId = dto.employeeId ?? current.employee.id;

    const departmentId = dto.departmentId ?? current.department?.id;

    const designationId = dto.designationId ?? current.designation.id;

    if (!departmentId) {
      throw new BadRequestException(
        'OT Attendance must have a Department before it can be updated.',
      );
    }

    const targetSiteId =
      await this.resolveOtAttendanceSiteId(departmentId);

    const originalMonth = this.normalizeSalaryMonth(
      current.attendanceDate,
    ).getTime();

    const targetMonth =
      this.normalizeSalaryMonth(targetDate).getTime();

    if (
      originalMonth !== targetMonth ||
      originalSiteId !== targetSiteId
    ) {
      await this.validateSiteMonthUnlocked(
        targetDate,
        targetSiteId,
      );
    }

    await this.validateContext(
      employeeId,
      departmentId,
      designationId,
    );

    const targetShift = dto.shift ?? current.shift;

    const identityChanged =
      employeeId !== current.employee.id ||
      targetDate.getTime() !== current.attendanceDate.getTime() ||
      targetShift !== current.shift;

    if (identityChanged) {
      const existing = await this.otAttendanceRepository.findExisting(
        targetDate,
        [employeeId],
        targetShift,
      );

      const conflictingRecord = existing.find(
        (record) => record.id !== current.id,
      );

      if (conflictingRecord) {
        throw new ConflictException(
          'OT Attendance already exists for the selected employee, date and shift.',
        );
      }
    }

    const updated = await this.otAttendanceRepository.update(id, dto);

    return {
      success: true,
      message: 'OT Attendance updated successfully.',
      data: updated,
    };
  }

  async delete(id: number) {
    const record = await this.otAttendanceRepository.findById(id);

    if (!record) {
      throw new NotFoundException('OT Attendance record not found.');
    }

    const siteId =
      record.department?.workType.site.id ?? null;

    await this.validateSiteMonthUnlocked(
      record.attendanceDate,
      siteId,
    );

    await this.otAttendanceRepository.delete(id);

    return {
      success: true,
      message: 'OT Attendance deleted successfully.',
    };
  }
}
