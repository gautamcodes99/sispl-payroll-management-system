import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { WageMasterService } from '../service/wage-master.service';
import { CreateWageMasterDto } from '../dto/create-wage-master.dto';
import { UpdateWageMasterDto } from '../dto/update-wage-master.dto';

@Controller('wage-masters')
export class WageMasterController {
  constructor(private readonly wageMasterService: WageMasterService) {}

  @Post()
  async create(@Body() dto: CreateWageMasterDto) {
    return this.wageMasterService.create(dto);
  }
  @Get()
  async findAll() {
    return this.wageMasterService.findAll();
  }
  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.wageMasterService.findOne(id);
  }

  @Patch(':id/activate')
  async activate(@Param('id', ParseIntPipe) id: number) {
    return this.wageMasterService.activate(id);
  }
  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWageMasterDto,
  ) {
    return this.wageMasterService.update(id, dto);
  }
}
