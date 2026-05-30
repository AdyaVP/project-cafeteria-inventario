import { Controller } from '@nestjs/common';
import { CajaService } from './caja.service';

@Controller('caja')
export class CajaController {
  constructor(private readonly cajaService: CajaService) {}
}
