import { Controller, Get, Query } from '@nestjs/common';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getDashboard(query);
  }
}
