import type { Configuration, DatasetFieldDto } from '@confmap/shared';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp, setupOpenApi } from '../src/app.setup.js';
import { ArcgisLayerClient } from '../src/datasets/arcgis-layer.client.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const DATASET = 'landscape-trees';

/** Stands in for ArcGIS so the suite runs offline. */
const FIELDS: DatasetFieldDto[] = [
  { name: 'Cmn_Name', alias: 'Common name', type: 'String', numeric: false },
  { name: 'Sci_Name', alias: 'Scientific name', type: 'String', numeric: false },
  { name: 'Leaf_Area', alias: 'Leaf area', type: 'Integer', numeric: true },
  { name: 'Leaf_Bmass', alias: 'Leaf biomass', type: 'Integer', numeric: true },
  { name: 'Height', alias: 'Height', type: 'Integer', numeric: true },
  { name: 'Condition', alias: 'Condition', type: 'String', numeric: false },
];

const CONFIG: Configuration = {
  symbolConfig: {
    size: {
      field: 'Height',
      stops: [
        { value: 0, size: 4 },
        { value: 100, size: 30 },
      ],
    },
  },
  tableConfig: { columns: ['Cmn_Name', 'Height'] },
};

describe('Configurations API (e2e)', () => {
  let app: INestApplication<App>;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ArcgisLayerClient)
      .useValue({ fetchFields: async () => FIELDS })
      .compile();
    app = configureApp(moduleRef.createNestApplication());
    setupOpenApi(app);
    await app.init();
    http = request(app.getHttpServer());
  });

  beforeEach(async () => {
    // Keep the seeded system default; drop what earlier tests created.
    await app.get(PrismaService).configuration.deleteMany({ where: { kind: 'CUSTOM' } });
  });

  afterAll(async () => {
    await app.close();
  });

  const save = (user: string, body: object) =>
    http.post(`/api/datasets/${DATASET}/configurations`).set('x-user-id', user).send(body);

  it('GET /api/health', async () => {
    await http.get('/api/health').expect(200, { status: 'ok', schemaVersion: 1 });
  });

  it('serves the seeded dataset and its default configuration', async () => {
    const dataset = await http.get(`/api/datasets/${DATASET}`).expect(200);
    expect(dataset.body).toMatchObject({ id: DATASET, popupTemplate: { title: '{Cmn_Name} (Tree {Tree_ID})' } });

    const fallback = await http.get(`/api/datasets/${DATASET}/configurations/default`).expect(200);
    expect(fallback.body).toMatchObject({ kind: 'SYSTEM', isDefault: true, ownerId: null, canPublish: false });
    expect(fallback.body.config.tableConfig.columns).toContain('Leaf_Area');
  });

  it('saves a private configuration, keeps it private, then publishes it for everyone', async () => {
    const created = await save('alice', { name: 'Height classes', config: CONFIG }).expect(201);
    expect(created.body).toMatchObject({ visibility: 'PRIVATE', ownerId: 'alice', canPublish: true });
    const { id } = created.body;

    // Private: alice sees it; bob and anonymous callers get the same 404 as for a missing id.
    await http.get(`/api/configurations/${id}`).set('x-user-id', 'alice').expect(200);
    await http.get(`/api/configurations/${id}`).set('x-user-id', 'bob').expect(404);
    await http.get(`/api/configurations/${id}`).expect(404);

    const mine = await http.get(`/api/datasets/${DATASET}/configurations?scope=mine`).set('x-user-id', 'alice').expect(200);
    expect(mine.body.map((c: { id: string }) => c.id)).toEqual([id]);

    // Only the owner can publish, and publishing twice is fine.
    await http.post(`/api/configurations/${id}/publish`).set('x-user-id', 'bob').expect(404);
    const published = await http.post(`/api/configurations/${id}/publish`).set('x-user-id', 'alice').expect(200);
    expect(published.body).toMatchObject({ visibility: 'PUBLISHED', canPublish: false });
    await http.post(`/api/configurations/${id}/publish`).set('x-user-id', 'alice').expect(200);

    // Published: bob can open it and finds it in the shared list, but can't publish it.
    await http.get(`/api/configurations/${id}`).set('x-user-id', 'bob').expect(200);
    const list = await http.get(`/api/datasets/${DATASET}/configurations?scope=published`).expect(200);
    expect(list.body.map((c: { name: string }) => c.name)).toEqual(['Tree leaf area', 'Height classes']);
    const forbidden = await http.post(`/api/configurations/${id}/publish`).set('x-user-id', 'bob').expect(403);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');
  });

  it('can publish on save', async () => {
    const created = await save('alice', { name: 'Shared now', config: CONFIG, publish: true }).expect(201);
    expect(created.body.visibility).toBe('PUBLISHED');
  });

  it('needs a user to save or to list your own configurations', async () => {
    const saveRes = await http.post(`/api/datasets/${DATASET}/configurations`).send({ name: 'x', config: CONFIG }).expect(401);
    expect(saveRes.body).toEqual({
      error: { code: 'UNAUTHENTICATED', message: expect.any(String) },
    });
    await http.get(`/api/datasets/${DATASET}/configurations?scope=mine`).expect(401);
  });

  it('reports validation failures with the path of each problem', async () => {
    const res = await save('alice', {
      name: ' ',
      config: { ...CONFIG, tableConfig: { columns: [] } },
    }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_FAILED');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { path: ['name'], message: 'Name is required' },
        { path: ['config', 'tableConfig', 'columns'], message: 'Show at least one column' },
      ]),
    );
  });

  it('rejects fields the dataset does not have', async () => {
    const res = await save('alice', {
      name: 'x',
      config: { ...CONFIG, tableConfig: { columns: ['Crown_Width'] } },
    }).expect(400);
    expect(res.body.error.details).toEqual({ unknownFields: ['Crown_Width'] });
  });

  it('404s for an unknown dataset and 400s for a malformed id', async () => {
    await http.get('/api/datasets/nope/configurations?scope=published').expect(404);
    await http.get('/api/configurations/not-a-uuid').expect(400);
  });

  it('publishes an OpenAPI document covering every endpoint', async () => {
    const doc = await http.get('/api/docs-json').expect(200);
    expect(Object.keys(doc.body.paths)).toEqual(
      expect.arrayContaining([
        '/api/datasets/{datasetId}',
        '/api/datasets/{datasetId}/fields',
        '/api/datasets/{datasetId}/configurations',
        '/api/datasets/{datasetId}/configurations/default',
        '/api/configurations/{id}',
        '/api/configurations/{id}/publish',
      ]),
    );
  });
});
