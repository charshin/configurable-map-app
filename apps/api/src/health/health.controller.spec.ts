import { CONFIGURATION_SCHEMA_VERSION } from '@confmap/shared';
import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  it('reports ok and the schema version', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    expect(moduleRef.get(HealthController).check()).toEqual({
      status: 'ok',
      schemaVersion: CONFIGURATION_SCHEMA_VERSION,
    });
  });
});
