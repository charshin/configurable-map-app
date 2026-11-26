import type { DatasetFieldDto } from '@confmap/shared';
import { ApiException } from '../common/api.exception.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ArcgisLayerClient } from './arcgis-layer.client.js';
import { DatasetsService } from './datasets.service.js';

const FIELDS: DatasetFieldDto[] = [{ name: 'Height', alias: 'Height', type: 'Integer', numeric: true }];

function setup() {
  const prisma = {
    dataset: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'trees'
          ? { id: 'trees', name: 'Trees', layerUrl: 'https://example.com/0', popupTemplate: { title: 'T', fieldInfos: [] } }
          : null,
      ),
    },
  };
  const arcgis = { fetchFields: vi.fn(async () => FIELDS) };
  const service = new DatasetsService(prisma as unknown as PrismaService, arcgis as unknown as ArcgisLayerClient);
  return { service, arcgis };
}

describe('DatasetsService', () => {
  it('404s for an unknown dataset', async () => {
    const { service } = setup();
    await expect(service.findById('nope')).rejects.toBeInstanceOf(ApiException);
  });

  it('fetches a dataset’s fields once and reuses them, including for concurrent calls', async () => {
    const { service, arcgis } = setup();
    const [a, b] = await Promise.all([service.getFields('trees'), service.getFields('trees')]);
    await service.getFields('trees');
    expect(a).toEqual(FIELDS);
    expect(b).toBe(a);
    expect(arcgis.fetchFields).toHaveBeenCalledTimes(1);
    expect(arcgis.fetchFields).toHaveBeenCalledWith('https://example.com/0');
  });

  it('does not cache a failure, so the next call retries', async () => {
    const { service, arcgis } = setup();
    arcgis.fetchFields.mockRejectedValueOnce(new Error('ArcGIS down'));
    await expect(service.getFields('trees')).rejects.toThrow('ArcGIS down');
    await expect(service.getFields('trees')).resolves.toEqual(FIELDS);
    expect(arcgis.fetchFields).toHaveBeenCalledTimes(2);
  });
});
