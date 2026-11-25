import { CONFIGURATION_SCHEMA_VERSION } from '@confmap/shared';
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  /** Liveness check. Also reports the configuration schema version this API speaks. */
  @Get()
  check() {
    return { status: 'ok', schemaVersion: CONFIGURATION_SCHEMA_VERSION };
  }
}
