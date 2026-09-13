import { Injectable } from '@nestjs/common';
import { PayrollRunStatus } from '@prisma/client';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class ComplianceReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findSiteById(siteId: number) {
    return this.prisma.site.findUnique({
      where: {
        id: siteId,
      },

      select: {
        id: true,
        siteName: true,
      },
    });
  }

  // =========================================================
  // CURRENT PAYROLL RUN FOR COMPLIANCE REPORTING
  //
  // Compliance Reports use persisted Payroll Employee
  // Snapshots and do not recalculate payroll.
  //
  // FINALIZED = normal finalized payroll.
  // UNLOCKED  = current payroll temporarily unlocked for
  //             corrections; its existing snapshot remains
  //             reportable until reprocessed.
  //
  // IMPORTANT:
  // The PF Annexure includes ALL employees present in the
  // current Payroll Run snapshot.
  //
  // Employee eligibility belongs to Payroll generation and
  // will be corrected there later. Compliance Reports must
  // not independently remove employees from the snapshot.
  // =========================================================

  async findCurrentPayrollRunWithSnapshots(
    siteId: number,
    salaryMonth: Date,
  ) {
    return this.prisma.payrollRun.findFirst({
      where: {
        siteId,
        salaryMonth,

        status: {
          in: [PayrollRunStatus.FINALIZED, PayrollRunStatus.UNLOCKED],
        },
      },

      orderBy: {
        version: 'desc',
      },

      include: {
        snapshots: {
          orderBy: {
            employeeId: 'asc',
          },
        },
      },
    });
  }
}
