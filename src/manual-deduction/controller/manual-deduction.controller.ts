import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateManualDeductionDto } from '../dto/create-manual-deduction.dto';
import { ManualDeductionQueryDto } from '../dto/manual-deduction-query.dto';
import { UpdateManualDeductionDto } from '../dto/update-manual-deduction.dto';
import { ManualDeductionService } from '../service/manual-deduction.service';

@Controller('manual-deductions')
export class ManualDeductionController {
  constructor(
    private readonly manualDeductionService: ManualDeductionService,
  ) {}

  @Post()
  async create(@Body() dto: CreateManualDeductionDto) {
    return this.manualDeductionService.create(dto);
  }

  @Get()
  async findAll(@Query() query: ManualDeductionQueryDto) {
    return this.manualDeductionService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.manualDeductionService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateManualDeductionDto,
  ) {
    return this.manualDeductionService.update(id, dto);
  }
}
