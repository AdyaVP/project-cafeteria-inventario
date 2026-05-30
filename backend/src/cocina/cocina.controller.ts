import { Controller } from '@nestjs/common';
import { CocinaService } from './cocina.service';

@Controller('cocina')
export class CocinaController {
  constructor(private readonly cocinaService: CocinaService) {}
}
