import type { Configuration, DatasetFieldDto } from '@confmap/shared';
import { ApiException } from '../common/api.exception.js';
import type { DatasetsService } from '../datasets/datasets.service.js';
import type { ConfigurationRow, ConfigurationsRepository } from './configurations.repository.js';
import { ConfigurationsService } from './configurations.service.js';

const DATASET = 'landscape-trees';

const FIELDS: DatasetFieldDto[] = [
  { name: 'Cmn_Name', alias: 'Cmn_Name', type: 'String', numeric: false },
  { name: 'Leaf_Area', alias: 'Leaf_Area', type: 'Integer', numeric: true },
  { name: 'Leaf_Bmass', alias: 'Leaf_Bmass', type: 'Integer', numeric: true },
];

const CONFIG: Configuration = {
  symbolConfig: {
    color: {
      field: 'Leaf_Area',
      stops: [
        { value: 10, color: '#ffffff' },
        { value: 40000, color: '#00a83a' },
      ],
    },
  },
  tableConfig: { columns: ['Cmn_Name', 'Leaf_Area'] },
};

function row(overrides: Partial<ConfigurationRow>): ConfigurationRow {
  return {
    id: crypto.randomUUID(),
    datasetId: DATASET,
    name: 'A configuration',
    ownerId: 'alice',
    kind: 'CUSTOM',
    visibility: 'PRIVATE',
    isDefault: false,
    schemaVersion: 1,
    config: CONFIG,
    createdAt: new Date('2026-11-25T00:00:00Z'),
    publishedAt: null,
    ...overrides,
  };
}

/** In-memory stand-in for the Prisma repository. */
class FakeRepository {
  rows: ConfigurationRow[] = [];

  async findById(id: string) {
    return this.rows.find((r) => r.id === id) ?? null;
  }
  async findDefault(datasetId: string) {
    return this.rows.find((r) => r.datasetId === datasetId && r.isDefault) ?? null;
  }
  async listPublished(datasetId: string) {
    return this.rows.filter((r) => r.datasetId === datasetId && r.visibility === 'PUBLISHED');
  }
  async listByOwner(datasetId: string, ownerId: string) {
    return this.rows.filter((r) => r.datasetId === datasetId && r.ownerId === ownerId);
  }
  async create(data: Partial<ConfigurationRow>) {
    const created = row({ ...data, id: crypto.randomUUID() } as Partial<ConfigurationRow>);
    this.rows.push(created);
    return created;
  }
  async publish(id: string, ownerId: string, at: Date) {
    const target = this.rows.find((r) => r.id === id && r.ownerId === ownerId && r.visibility === 'PRIVATE');
    if (!target) return false;
    target.visibility = 'PUBLISHED';
    target.publishedAt = at;
    return true;
  }
}

function setup() {
  const repository = new FakeRepository();
  const datasets = {
    findById: vi.fn(async (id: string) => {
      if (id !== DATASET) throw ApiException.notFound();
      return { id, name: 'Trees', layerUrl: 'https://example.com/0', popupTemplate: { title: '', fieldInfos: [] } };
    }),
    getFields: vi.fn(async (id: string) => {
      if (id !== DATASET) throw ApiException.notFound();
      return FIELDS;
    }),
  };
  const service = new ConfigurationsService(
    repository as unknown as ConfigurationsRepository,
    datasets as unknown as DatasetsService,
  );
  return { service, repository, datasets };
}

async function errorCode(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiException) return { status: error.getStatus(), code: error.code };
    throw error;
  }
  throw new Error('Expected the call to fail');
}

describe('ConfigurationsService', () => {
  describe('get', () => {
    it('shows a private configuration only to its owner, and 404s for everyone else', async () => {
      const { service, repository } = setup();
      const mine = row({ ownerId: 'alice' });
      repository.rows.push(mine);

      await expect(service.get(mine.id, 'alice')).resolves.toMatchObject({ id: mine.id, canPublish: true });
      expect(await errorCode(service.get(mine.id, 'bob'))).toEqual({ status: 404, code: 'NOT_FOUND' });
      expect(await errorCode(service.get(mine.id, undefined))).toEqual({ status: 404, code: 'NOT_FOUND' });
    });

    it('shows published and system configurations to anyone, without canPublish', async () => {
      const { service, repository } = setup();
      const published = row({ visibility: 'PUBLISHED', publishedAt: new Date() });
      const system = row({ kind: 'SYSTEM', ownerId: null, visibility: 'PUBLISHED', publishedAt: new Date() });
      repository.rows.push(published, system);

      await expect(service.get(published.id, undefined)).resolves.toMatchObject({ canPublish: false });
      await expect(service.get(published.id, 'alice')).resolves.toMatchObject({ canPublish: false });
      await expect(service.get(system.id, 'bob')).resolves.toMatchObject({ kind: 'SYSTEM', ownerId: null });
    });

    it('404s for an id that does not exist', async () => {
      const { service } = setup();
      expect(await errorCode(service.get(crypto.randomUUID(), 'alice'))).toEqual({ status: 404, code: 'NOT_FOUND' });
    });
  });

  describe('list', () => {
    it('returns the caller’s own configurations for scope "mine"', async () => {
      const { service, repository } = setup();
      repository.rows.push(row({ name: 'Alice 1' }), row({ name: 'Bob 1', ownerId: 'bob' }));

      const mine = await service.list(DATASET, 'mine', 'alice');
      expect(mine.map((c) => c.name)).toEqual(['Alice 1']);
      expect(mine[0]).not.toHaveProperty('config');
    });

    it('requires a user for scope "mine"', async () => {
      const { service } = setup();
      expect(await errorCode(service.list(DATASET, 'mine', undefined))).toEqual({
        status: 401,
        code: 'UNAUTHENTICATED',
      });
    });

    it('returns only published configurations for scope "published"', async () => {
      const { service, repository } = setup();
      repository.rows.push(row({ name: 'Private' }), row({ name: 'Public', visibility: 'PUBLISHED', publishedAt: new Date() }));
      const published = await service.list(DATASET, 'published', undefined);
      expect(published.map((c) => c.name)).toEqual(['Public']);
    });

    it('404s for an unknown dataset', async () => {
      const { service } = setup();
      expect(await errorCode(service.list('nope', 'published', undefined))).toEqual({ status: 404, code: 'NOT_FOUND' });
    });
  });

  describe('getDefault', () => {
    it('returns the default configuration, or 404 when there is none', async () => {
      const { service, repository } = setup();
      expect(await errorCode(service.getDefault(DATASET, undefined))).toEqual({ status: 404, code: 'NOT_FOUND' });

      const fallback = row({ kind: 'SYSTEM', ownerId: null, visibility: 'PUBLISHED', isDefault: true, publishedAt: new Date() });
      repository.rows.push(fallback);
      await expect(service.getDefault(DATASET, undefined)).resolves.toMatchObject({ id: fallback.id, isDefault: true });
    });
  });

  describe('create', () => {
    it('saves a private custom configuration owned by the caller', async () => {
      const { service } = setup();
      const created = await service.create(DATASET, { name: 'Mine', config: CONFIG, publish: false }, 'alice');
      expect(created).toMatchObject({
        name: 'Mine',
        kind: 'CUSTOM',
        visibility: 'PRIVATE',
        ownerId: 'alice',
        publishedAt: null,
        canPublish: true,
      });
    });

    it('publishes straight away when asked', async () => {
      const { service } = setup();
      const created = await service.create(DATASET, { name: 'Shared', config: CONFIG, publish: true }, 'alice');
      expect(created.visibility).toBe('PUBLISHED');
      expect(created.publishedAt).not.toBeNull();
      expect(created.canPublish).toBe(false);
    });

    it('rejects fields the dataset does not have', async () => {
      const { service } = setup();
      const config = { ...CONFIG, tableConfig: { columns: ['Crown_Width'] } };
      expect(await errorCode(service.create(DATASET, { name: 'x', config, publish: false }, 'alice'))).toEqual({
        status: 400,
        code: 'VALIDATION_FAILED',
      });
    });

    it('rejects a non-numeric field for colour or size', async () => {
      const { service } = setup();
      const config: Configuration = {
        ...CONFIG,
        symbolConfig: {
          size: {
            field: 'Cmn_Name',
            stops: [
              { value: 0, size: 5 },
              { value: 1, size: 10 },
            ],
          },
        },
      };
      expect(await errorCode(service.create(DATASET, { name: 'x', config, publish: false }, 'alice'))).toEqual({
        status: 400,
        code: 'VALIDATION_FAILED',
      });
    });
  });

  describe('publish', () => {
    it('publishes the owner’s private configuration, and is idempotent', async () => {
      const { service, repository } = setup();
      const mine = row({});
      repository.rows.push(mine);

      const first = await service.publish(mine.id, 'alice');
      expect(first).toMatchObject({ visibility: 'PUBLISHED', canPublish: false });
      const second = await service.publish(mine.id, 'alice');
      expect(second.publishedAt).toBe(first.publishedAt);
    });

    it('404s when someone else tries to publish a private configuration', async () => {
      const { service, repository } = setup();
      const mine = row({});
      repository.rows.push(mine);
      expect(await errorCode(service.publish(mine.id, 'bob'))).toEqual({ status: 404, code: 'NOT_FOUND' });
      expect(mine.visibility).toBe('PRIVATE');
    });

    it('403s for a published configuration the caller does not own, including system ones', async () => {
      const { service, repository } = setup();
      const theirs = row({ ownerId: 'bob', visibility: 'PUBLISHED', publishedAt: new Date() });
      const system = row({ kind: 'SYSTEM', ownerId: null, visibility: 'PUBLISHED', publishedAt: new Date() });
      repository.rows.push(theirs, system);
      expect(await errorCode(service.publish(theirs.id, 'alice'))).toEqual({ status: 403, code: 'FORBIDDEN' });
      expect(await errorCode(service.publish(system.id, 'alice'))).toEqual({ status: 403, code: 'FORBIDDEN' });
    });
  });
});
