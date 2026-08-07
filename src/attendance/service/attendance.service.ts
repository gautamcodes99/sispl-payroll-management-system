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

  async create(createAttendanceDto: CreateAttendanceDto) {
    const attendance =
      await this.attendanceRepository.create(createAttendanceDto);

    return {
      success: true,
      message: 'Attendance marked successfully.',
      data: attendance,
    };
  }

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
  async bulkCreateAttendance(bulkAttendanceDto: BulkAttendanceDto) {
    const existingAttendances =
      await this.attendanceRepository.findExistingAttendance(
        new Date(bulkAttendanceDto.attendanceDate),
        bulkAttendanceDto.employeeIds,
      );

    if (existingAttendances.length > 0) {
      return {
        success: false,
        message: 'Attendance already exists for the selected employee(s).',
        data: {
          duplicates: existingAttendances.map((attendance) => ({
            employeeId: attendance.employeeId,
            firstName: attendance.employee.firstName,
            lastName: attendance.employee.lastName,
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

  async updateAttendance(id: number, updateAttendanceDto: UpdateAttendanceDto) {
    // Check if attendance record exists
    const attendance = await this.attendanceRepository.findAttendanceById(id);

    if (!attendance) {
      throw new NotFoundException('Attendance record not found.');
    }

    // Update attendance
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

  async deleteAttendance(id: number) {
    // Check if attendance record exists
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
