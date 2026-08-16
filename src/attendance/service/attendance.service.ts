import { Injectable, NotFoundException } from '@nestjs/common';
import { AttendanceRepository } from '../repository/attendance.repository';
import { CreateAttendanceDto } from '../dto/create-attendance.dto';
import { UpdateAttendanceDto } from '../dto/update-attendance.dto';
import { AttendanceQueryDto } from '../dto/attendance-query.dto';
import { PendingAttendanceQueryDto } from '../dto/pending-attendance-query.dto';
import { AttendanceDashboardQueryDto } from '../dto/attendance-dashboard-query.dto';
import { BulkAttendanceDto } from '../dto/bulk-attendance.dto';
import { BulkOtUpdateDto } from '../dto/bulk-ot-update.dto';
import { MonthlyAttendanceQueryDto } from '../dto/monthly-attendance-query.dto';

@Injectable()
export class AttendanceService {
  constructor(private readonly attendanceRepository: AttendanceRepository) {}

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
  ) {
    const [employee, department] = await Promise.all([
      this.attendanceRepository.findEmployeeAttendanceContext(employeeId),
      this.attendanceRepository.findDepartmentAttendanceContext(departmentId),
    ]);

    if (!employee) {
      throw new NotFoundException(`Employee with ID ${employeeId} not found.`);
    }

    if (!department) {
      throw new NotFoundException(
        `Department with ID ${departmentId} not found.`,
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
  // CREATE
  // =========================================================

  async create(createAttendanceDto: CreateAttendanceDto) {
    await this.validateAttendanceContext(
      createAttendanceDto.employeeId,
      createAttendanceDto.departmentId,
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
    await this.validateBulkAttendanceContext(
      bulkAttendanceDto.employeeIds,
      bulkAttendanceDto.departmentId,
    );

    const existingAttendances =
      await this.attendanceRepository.findExistingAttendance(
        new Date(bulkAttendanceDto.attendanceDate),
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
  // BULK OT UPDATE
  // =========================================================

  async bulkUpdateOt(bulkOtUpdateDto: BulkOtUpdateDto) {
    const results =
      await this.attendanceRepository.bulkUpdateOt(bulkOtUpdateDto);

    const updated = results.reduce((total, result) => total + result.count, 0);

    return {
      success: true,
      message: 'OT hours updated successfully.',
      data: {
        processed: updated,
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
  // =========================================================

  async updateAttendance(id: number, updateAttendanceDto: UpdateAttendanceDto) {
    const attendance = await this.attendanceRepository.findAttendanceById(id);

    if (!attendance) {
      throw new NotFoundException('Attendance record not found.');
    }

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

    await this.attendanceRepository.deleteAttendance(id);

    return {
      success: true,
      message: 'Attendance deleted successfully.',
    };
  }
}
