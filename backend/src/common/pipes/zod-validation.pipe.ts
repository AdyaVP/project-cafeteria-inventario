import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import * as z from 'zod';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: z.ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);

    if (!result.success) {
      throw new BadRequestException(result.error.flatten().fieldErrors);
    }

    return result.data;
  }
}
