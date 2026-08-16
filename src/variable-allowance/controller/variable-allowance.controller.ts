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
import { CreateVariableAllowanceDto } from '../dto/create-variable-allowance.dto';
import { UpdateVariableAllowanceDto } from '../dto/update-variable-allowance.dto';
import { VariableAllowanceQueryDto } from '../dto/variable-allowance-query.dto';
import { VariableAllowanceService } from '../service/variable-allowance.service';

@Controller('variable-allowances')
export class VariableAllowanceController {
  constructor(
    private readonly variableAllowanceService: VariableAllowanceService,
  ) {}

  @Post()
  async create(@Body() dto: CreateVariableAllowanceDto) {
    return this.variableAllowanceService.create(dto);
  }

  @Get()
  async findAll(@Query() query: VariableAllowanceQueryDto) {
    return this.variableAllowanceService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.variableAllowanceService.findOne(id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVariableAllowanceDto,
  ) {
    return this.variableAllowanceService.update(id, dto);
  }
}
