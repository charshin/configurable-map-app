import { ApiException } from '../common/api.exception.js';
import { ArcgisLayerClient } from './arcgis-layer.client.js';

const LAYER_URL = 'https://services.arcgis.com/x/arcgis/rest/services/Trees/FeatureServer/0';

function mockFetch(body: unknown) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body)));
}

describe('ArcgisLayerClient', () => {
  afterEach(() => vi.restoreAllMocks());

  it('requests the layer metadata as JSON and maps field types', async () => {
    const fetchSpy = mockFetch({
      fields: [
        { name: 'FID', alias: 'FID', type: 'esriFieldTypeOID' },
        { name: 'Height', alias: 'Height (ft)', type: 'esriFieldTypeInteger' },
        { name: 'LAI', alias: null, type: 'esriFieldTypeDouble' },
        { name: 'Cmn_Name', alias: 'Common name', type: 'esriFieldTypeString' },
      ],
    });

    const fields = await new ArcgisLayerClient().fetchFields(LAYER_URL);

    expect(String(fetchSpy.mock.calls[0][0])).toBe(`${LAYER_URL}?f=json`);
    expect(fields).toEqual([
      { name: 'FID', alias: 'FID', type: 'OID', numeric: false },
      { name: 'Height', alias: 'Height (ft)', type: 'Integer', numeric: true },
      { name: 'LAI', alias: 'LAI', type: 'Double', numeric: true },
      { name: 'Cmn_Name', alias: 'Common name', type: 'String', numeric: false },
    ]);
  });

  it('reports an ArcGIS error object (sent with HTTP 200) as upstream unavailable', async () => {
    mockFetch({ error: { code: 400, message: 'Invalid URL' } });
    const error = await new ArcgisLayerClient().fetchFields(LAYER_URL).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiException);
    expect(error).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect((error as ApiException).getStatus()).toBe(502);
  });

  it('reports a network failure as upstream unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('fetch failed'));
    await expect(new ArcgisLayerClient().fetchFields(LAYER_URL)).rejects.toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
    });
  });
});
