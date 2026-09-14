import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PayrollRunStatus } from '@prisma/client';

import { DashboardRepository } from './dashboard.repository';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

@Injectable()
export class DashboardService {
  constructor(
    private readonly dashboardRepository:
      DashboardRepository,
  ) {}

  // =========================================================
  // DATE NORMALIZATION
  // =========================================================

  private normalizeDate(date: Date) {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
      ),
    );
  }

  private normalizeSalaryMonth(date: Date) {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        1,
      ),
    );
  }

  private nextDate(date: Date) {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate() + 1,
      ),
    );
  }

  private nextSalaryMonth(
    salaryMonth: Date,
  ) {
    return new Date(
      Date.UTC(
        salaryMonth.getUTCFullYear(),
        salaryMonth.getUTCMonth() + 1,
        1,
      ),
    );
  }

  private paymentDueDate(
    salaryMonth: Date,
  ) {
    // Locked SISPL payroll rule:
    // Payment Due = 7th of the following month.
    return new Date(
      Date.UTC(
        salaryMonth.getUTCFullYear(),
        salaryMonth.getUTCMonth() + 1,
        7,
      ),
    );
  }

  private money(value: number) {
    return Number(value.toFixed(2));
  }

  // =========================================================
  // DASHBOARD
  // =========================================================

  async getDashboard(
    query: DashboardQueryDto,
  ) {
    const inputDate = new Date(query.date);

    if (Number.isNaN(inputDate.getTime())) {
      throw new BadRequestException(
        'Dashboard date is invalid.',
      );
    }

    const date =
      this.normalizeDate(inputDate);

    const nextDate =
      this.nextDate(date);

    let salaryMonth: Date;

    if (query.salaryMonth) {
      const inputSalaryMonth =
        new Date(query.salaryMonth);

      if (
        Number.isNaN(
          inputSalaryMonth.getTime(),
        )
      ) {
        throw new BadRequestException(
          'Salary month is invalid.',
        );
      }

      salaryMonth =
        this.normalizeSalaryMonth(
          inputSalaryMonth,
        );
    } else {
      // Backward compatibility:
      // old dashboard requests only send date.
      salaryMonth =
        this.normalizeSalaryMonth(date);
    }

    const nextSalaryMonth =
      this.nextSalaryMonth(salaryMonth);

    const [
      totalEmployees,
      activeEmployees,
      newJoiners,
      attendanceSummary,
      payrollRun,
      companyPayrollRuns,
      companyProfile,
    ] = await Promise.all([
      this.dashboardRepository.countEmployees(),

      this.dashboardRepository.countActiveEmployees(),

      this.dashboardRepository.countNewJoiners(
        salaryMonth,
        nextSalaryMonth,
      ),

      this.dashboardRepository.getAttendanceSummary(
        date,
        nextDate,
      ),

      this.dashboardRepository
        .findCurrentPayrollRunSummary(
          salaryMonth,
        ),

      this.dashboardRepository
        .findCompanyPayrollRunSummaries(
          salaryMonth,
        ),

      this.dashboardRepository
        .findCompanyDashboardDetails(),
    ]);

    const pending =
      await this.dashboardRepository
        .countPendingActiveEmployees(
          attendanceSummary.markedEmployeeIds,
        );

    // =======================================================
    // EXISTING PAYROLL RESPONSE
    //
    // Preserved for API backward compatibility.
    // =======================================================

    let payroll: {
      runId: number;
      salaryMonth: Date;
      version: number;
      status: PayrollRunStatus;
      employeeCount: number;
      finalizedAt: Date | null;
      unlockedAt: Date | null;
      gross: number | null;
      pf: number | null;
      esic: number | null;
      ptax: number | null;
      mlwf: number | null;
      totalDeductions: number | null;
      netSalary: number | null;
    } | null = null;

    if (payrollRun) {
      if (
        payrollRun.status ===
        PayrollRunStatus.FINALIZED
      ) {
        const totals =
          payrollRun.snapshots.reduce(
            (total, snapshot) => {
              total.gross +=
                Number(snapshot.gross);

              total.pf +=
                Number(snapshot.pf);

              total.esic +=
                Number(snapshot.esic);

              total.ptax +=
                Number(snapshot.ptax);

              total.mlwf +=
                Number(snapshot.mlwf);

              total.totalDeductions +=
                Number(
                  snapshot.totalDeductions,
                );

              total.netSalary +=
                Number(
                  snapshot.netSalary,
                );

              return total;
            },
            {
              gross: 0,
              pf: 0,
              esic: 0,
              ptax: 0,
              mlwf: 0,
              totalDeductions: 0,
              netSalary: 0,
            },
          );

        payroll = {
          runId: payrollRun.id,
          salaryMonth:
            payrollRun.salaryMonth,
          version: payrollRun.version,
          status: payrollRun.status,
          employeeCount:
            payrollRun._count.snapshots,
          finalizedAt:
            payrollRun.finalizedAt,
          unlockedAt:
            payrollRun.unlockedAt,

          gross:
            this.money(totals.gross),

          pf:
            this.money(totals.pf),

          esic:
            this.money(totals.esic),

          ptax:
            this.money(totals.ptax),

          mlwf:
            this.money(totals.mlwf),

          totalDeductions:
            this.money(
              totals.totalDeductions,
            ),

          netSalary:
            this.money(
              totals.netSalary,
            ),
        };
      } else {
        payroll = {
          runId: payrollRun.id,
          salaryMonth:
            payrollRun.salaryMonth,
          version: payrollRun.version,
          status: payrollRun.status,
          employeeCount:
            payrollRun._count.snapshots,
          finalizedAt:
            payrollRun.finalizedAt,
          unlockedAt:
            payrollRun.unlockedAt,

          // Unlocked payroll is under correction.
          // Do not expose historical snapshot totals.
          gross: null,
          pf: null,
          esic: null,
          ptax: null,
          mlwf: null,
          totalDeductions: null,
          netSalary: null,
        };
      }
    }

    // =======================================================
    // COMPANY-WIDE CURRENT PAYROLL
    //
    // Site-wise payroll runs are aggregated for the
    // Dashboard.
    //
    // If Site-wise runs exist for the salary month, legacy
    // siteId = null runs are intentionally ignored to prevent
    // double-counting old company-level historical runs.
    //
    // If no Site-wise runs exist, the latest legacy null-Site
    // run is used for backward compatibility.
    // =======================================================

    const hasSiteWiseRuns =
      companyPayrollRuns.some(
        (run) => run.siteId !== null,
      );

    const candidateRuns =
      hasSiteWiseRuns
        ? companyPayrollRuns.filter(
            (run) => run.siteId !== null,
          )
        : companyPayrollRuns.filter(
            (run) => run.siteId === null,
          );

    const latestRunBySite = new Map<
      number | 'LEGACY',
      (typeof companyPayrollRuns)[number]
    >();

    for (const run of candidateRuns) {
      const key =
        run.siteId ?? 'LEGACY';

      if (!latestRunBySite.has(key)) {
        latestRunBySite.set(
          key,
          run,
        );
      }
    }

    const selectedCompanyRuns =
      [...latestRunBySite.values()];

    let currentPayroll: {
      salaryMonth: Date;
      status: PayrollRunStatus;
      runCount: number;
      employeeCount: number;
      paymentDueDate: Date;
      gross: number | null;
      pf: number | null;
      esic: number | null;
      ptax: number | null;
      mlwf: number | null;
      totalDeductions: number | null;
      netSalary: number | null;
    } | null = null;

    if (selectedCompanyRuns.length > 0) {
      const hasUnlockedRun =
        selectedCompanyRuns.some(
          (run) =>
            run.status ===
            PayrollRunStatus.UNLOCKED,
        );

      const companyStatus =
        hasUnlockedRun
          ? PayrollRunStatus.UNLOCKED
          : PayrollRunStatus.FINALIZED;

      const employeeCount =
        selectedCompanyRuns.reduce(
          (total, run) =>
            total +
            run._count.snapshots,
          0,
        );

      if (hasUnlockedRun) {
        currentPayroll = {
          salaryMonth,
          status: companyStatus,
          runCount:
            selectedCompanyRuns.length,
          employeeCount,
          paymentDueDate:
            this.paymentDueDate(
              salaryMonth,
            ),

          // At least one Site payroll is under
          // correction, therefore company monetary
          // totals are intentionally hidden.
          gross: null,
          pf: null,
          esic: null,
          ptax: null,
          mlwf: null,
          totalDeductions: null,
          netSalary: null,
        };
      } else {
        const totals = {
          gross: 0,
          pf: 0,
          esic: 0,
          ptax: 0,
          mlwf: 0,
          totalDeductions: 0,
          netSalary: 0,
        };

        for (
          const run of selectedCompanyRuns
        ) {
          for (
            const snapshot of run.snapshots
          ) {
            totals.gross +=
              Number(snapshot.gross);

            totals.pf +=
              Number(snapshot.pf);

            totals.esic +=
              Number(snapshot.esic);

            totals.ptax +=
              Number(snapshot.ptax);

            totals.mlwf +=
              Number(snapshot.mlwf);

            totals.totalDeductions +=
              Number(
                snapshot.totalDeductions,
              );

            totals.netSalary +=
              Number(
                snapshot.netSalary,
              );
          }
        }

        currentPayroll = {
          salaryMonth,
          status: companyStatus,
          runCount:
            selectedCompanyRuns.length,
          employeeCount,
          paymentDueDate:
            this.paymentDueDate(
              salaryMonth,
            ),

          gross:
            this.money(totals.gross),

          pf:
            this.money(totals.pf),

          esic:
            this.money(totals.esic),

          ptax:
            this.money(totals.ptax),

          mlwf:
            this.money(totals.mlwf),

          totalDeductions:
            this.money(
              totals.totalDeductions,
            ),

          netSalary:
            this.money(
              totals.netSalary,
            ),
        };
      }
    }

    // =======================================================
    // COMPANY DETAILS + ACTIVE GALLERY
    // =======================================================

    const company =
      companyProfile
        ? {
            companyName:
              companyProfile.companyName,

            registeredAddress:
              companyProfile.registeredAddress,

            pan:
              companyProfile.pan,

            gstin:
              companyProfile.gstin,

            pfEstablishmentCode:
              companyProfile
                .pfEstablishmentCode,

            esicEmployerCode:
              companyProfile
                .esicEmployerCode,

            ptaxRegistrationNumber:
              companyProfile
                .ptaxRegistrationNumber,

            mlwfRegistrationNumber:
              companyProfile
                .mlwfRegistrationNumber,

            companyHistory:
              companyProfile.companyHistory,

            mission:
              companyProfile.mission,

            primaryGoals:
              companyProfile.primaryGoals,

            customers:
              companyProfile.customers,

            services:
              companyProfile.services,

            gallery:
              companyProfile.galleryImages.map(
                (image) => ({
                  id: image.id,

                  imageUrl:
                    `/uploads/company-gallery/${encodeURIComponent(
                      image.fileName,
                    )}`,

                  caption:
                    image.caption,

                  sortOrder:
                    image.sortOrder,
                }),
              ),
          }
        : null;

    return {
      success: true,
      message:
        'Dashboard fetched successfully.',

      data: {
        date,
        salaryMonth,

        company,

        employees: {
          total: totalEmployees,
          active: activeEmployees,
          inactive:
            totalEmployees -
            activeEmployees,
          newJoiners,
        },

        attendance: {
          present:
            attendanceSummary.present,

          absent:
            attendanceSummary.absent,

          leave:
            attendanceSummary.leave,

          holiday:
            attendanceSummary.holiday,

          weeklyOff:
            attendanceSummary.weeklyOff,

          halfDay:
            attendanceSummary.halfDay,

          paidHoliday:
            attendanceSummary.paidHoliday,

          pending,
        },

        // Existing block retained.
        payroll,

        // New company-wide Site-wise aggregate.
        currentPayroll,
      },
    };
  }
}
