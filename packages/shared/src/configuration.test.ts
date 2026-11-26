import { describe, expect, it } from 'vitest';
import {
  type Configuration,
  configurationSchema,
  createConfigurationSchema,
  findUnknownFields,
} from './configuration.js';

// The starter app's sample configuration.
const sample: Configuration = {
  symbolConfig: {
    color: {
      field: 'Leaf_Area',
      stops: [
        { value: 10, color: '#ffffff' },
        { value: 40000, color: '#00fd00' },
      ],
    },
    size: {
      field: 'Leaf_Bmass',
      stops: [
        { value: 0, size: 5 },
        { value: 700, size: 40 },
      ],
    },
  },
  tableConfig: { columns: ['Leaf_Area', 'Leaf_Bmass'] },
};

function issuePaths(input: unknown) {
  const result = configurationSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((issue) => issue.path.join('.'));
}

describe('configurationSchema', () => {
  it('accepts the starter sample', () => {
    expect(configurationSchema.parse(sample)).toEqual(sample);
  });

  it('accepts colour only or size only', () => {
    const { color, size } = sample.symbolConfig;
    for (const symbolConfig of [{ color }, { size }]) {
      expect(configurationSchema.safeParse({ ...sample, symbolConfig }).success).toBe(true);
    }
  });

  it('rejects turning off both colour and size', () => {
    expect(issuePaths({ ...sample, symbolConfig: {} })).toEqual(['symbolConfig']);
  });

  it('rejects colour and size on the same field', () => {
    const { color, size } = sample.symbolConfig;
    const symbolConfig = { color, size: { ...size!, field: color!.field } };
    expect(issuePaths({ ...sample, symbolConfig })).toEqual(['symbolConfig.color.field', 'symbolConfig.size.field']);
  });

  it('rejects stop values that do not increase', () => {
    const color = {
      field: 'Leaf_Area',
      stops: [
        { value: 500, color: '#ffffff' },
        { value: 200, color: '#00a83a' },
      ],
    };
    expect(issuePaths({ ...sample, symbolConfig: { color } })).toEqual([
      'symbolConfig.color.stops.1.value',
    ]);
  });

  it('rejects fewer than 2 stops', () => {
    const size = { field: 'Leaf_Bmass', stops: [{ value: 0, size: 5 }] };
    expect(issuePaths({ ...sample, symbolConfig: { size } })).toEqual(['symbolConfig.size.stops']);
  });

  it('rejects colours that are not 6-digit hex', () => {
    const color = {
      field: 'Leaf_Area',
      stops: [
        { value: 0, color: 'green' },
        { value: 1, color: '#00a83' },
      ],
    };
    expect(issuePaths({ ...sample, symbolConfig: { color } })).toEqual([
      'symbolConfig.color.stops.0.color',
      'symbolConfig.color.stops.1.color',
    ]);
  });

  it('rejects sizes outside 1–64px', () => {
    const size = {
      field: 'Leaf_Bmass',
      stops: [
        { value: 0, size: 0 },
        { value: 1, size: 65 },
      ],
    };
    expect(issuePaths({ ...sample, symbolConfig: { size } })).toHaveLength(2);
  });

  it('rejects an empty or duplicated column list', () => {
    expect(issuePaths({ ...sample, tableConfig: { columns: [] } })).toEqual(['tableConfig.columns']);
    expect(issuePaths({ ...sample, tableConfig: { columns: ['Height', 'Height'] } })).toEqual([
      'tableConfig.columns',
    ]);
  });
});

describe('createConfigurationSchema', () => {
  it('trims the name and defaults publish to false', () => {
    expect(createConfigurationSchema.parse({ name: '  Leaf area  ', config: sample })).toEqual({
      name: 'Leaf area',
      config: sample,
      publish: false,
    });
  });

  it('rejects blank and overlong names', () => {
    expect(createConfigurationSchema.safeParse({ name: '   ', config: sample }).success).toBe(false);
    expect(createConfigurationSchema.safeParse({ name: 'x'.repeat(81), config: sample }).success).toBe(
      false,
    );
  });
});

describe('findUnknownFields', () => {
  it('returns referenced fields the dataset does not have, once each', () => {
    const config: Configuration = {
      ...sample,
      tableConfig: { columns: ['Leaf_Area', 'Crown_Width', 'Crown_Width2'] },
    };
    expect(findUnknownFields(config, ['Leaf_Area', 'Leaf_Bmass'])).toEqual([
      'Crown_Width',
      'Crown_Width2',
    ]);
  });

  it('returns nothing when every field exists', () => {
    expect(findUnknownFields(sample, ['Leaf_Area', 'Leaf_Bmass', 'Height'])).toEqual([]);
  });
});
