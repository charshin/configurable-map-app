/**
 * Seeds the one dataset and its system default configuration.
 * Idempotent: safe to run again; existing rows are updated in place.
 *
 * Run with `pnpm --filter api db:seed`.
 */
import {
  CONFIGURATION_SCHEMA_VERSION,
  type Configuration,
  configurationSchema,
  type PopupTemplateDto,
  popupTemplateSchema,
} from '@confmap/shared';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

try {
  process.loadEnvFile();
} catch {
  // no .env file; use the environment as is
}

const DATASET_ID = 'landscape-trees';

/** Fixed id so the default has a stable share link and re-seeding updates it in place. */
const DEFAULT_CONFIGURATION_ID = '019ab000-0000-7000-8000-000000000001';

// Moved here from the starter app's App.tsx: the popup belongs to the dataset.
const popupTemplate: PopupTemplateDto = popupTemplateSchema.parse({
  title: '{Cmn_Name} (Tree {Tree_ID})',
  fieldInfos: [
    { fieldName: 'Sci_Name', label: 'Scientific name' },
    { fieldName: 'Status', label: 'Status' },
    { fieldName: 'Condition', label: 'Condition' },
    { fieldName: 'Height', label: 'Height (ft)' },
    { fieldName: 'Native', label: 'Native' },
    { fieldName: 'Land_Use', label: 'Land use' },
  ],
});

// The starter app's sample configuration, with a darker top colour so light
// points stay readable on the basemap, and a few more columns.
const defaultConfig: Configuration = configurationSchema.parse({
  symbolConfig: {
    color: {
      field: 'Leaf_Area',
      stops: [
        { value: 10, color: '#ffffff' },
        { value: 40000, color: '#00a83a' },
      ],
    },
    size: {
      field: 'Leaf_Bmass',
      stops: [
        { value: 0, size: 5 },
        { value: 700, size: 28 },
      ],
    },
  },
  tableConfig: {
    columns: ['Cmn_Name', 'Sci_Name', 'Leaf_Area', 'Leaf_Bmass', 'Height', 'Condition'],
  },
});

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

  try {
    const dataset = {
      name: 'Landscape Trees',
      layerUrl:
        'https://services.arcgis.com/V6ZHFr6zdgNZuVG0/arcgis/rest/services/Landscape_Trees/FeatureServer/0',
      popupTemplate,
    };
    await prisma.dataset.upsert({
      where: { id: DATASET_ID },
      create: { id: DATASET_ID, ...dataset },
      update: dataset,
    });

    const configuration = {
      datasetId: DATASET_ID,
      name: 'Tree leaf area',
      kind: 'SYSTEM' as const,
      visibility: 'PUBLISHED' as const,
      isDefault: true,
      ownerId: null,
      schemaVersion: CONFIGURATION_SCHEMA_VERSION,
      config: defaultConfig,
    };
    const now = new Date();
    await prisma.configuration.upsert({
      where: { id: DEFAULT_CONFIGURATION_ID },
      create: { id: DEFAULT_CONFIGURATION_ID, ...configuration, createdAt: now, publishedAt: now },
      update: configuration,
    });

    console.log(`Seeded dataset "${DATASET_ID}" and its default configuration.`);
  } finally {
    await prisma.$disconnect();
  }
}

await main();
