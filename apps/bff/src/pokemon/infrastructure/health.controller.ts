import { Controller, Get } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

/**
 * Liveness para Docker y orquestadores. No toca PokéAPI: el BFF sigue "vivo" aunque la fuente se caiga, y eso es justo lo que queremos.
 */
@ApiExcludeController()
@SkipThrottle()
@Controller('health')
export class HealthController {
  /** Responde `ok` mientras el proceso esté vivo; a propósito no consulta nada externo. */
  @Get()
  check() {
    return { status: 'ok' };
  }
}
