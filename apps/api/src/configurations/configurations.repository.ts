import { Injectable } from '@nestjs/common';
import type { Configuration as ConfigurationRow, Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type { ConfigurationRow };

/** Data access for configurations. Holds queries only; the rules live in the service. */
@Injectable()
export class ConfigurationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<ConfigurationRow | null> {
    return this.prisma.configuration.findUnique({ where: { id } });
  }

  findDefault(datasetId: string): Promise<ConfigurationRow | null> {
    return this.prisma.configuration.findFirst({ where: { datasetId, isDefault: true } });
  }

  /** System configurations first, then the newest. */
  listPublished(datasetId: string): Promise<ConfigurationRow[]> {
    return this.prisma.configuration.findMany({
      where: { datasetId, visibility: 'PUBLISHED' },
      orderBy: [{ kind: 'asc' }, { createdAt: 'desc' }],
    });
  }

  listByOwner(datasetId: string, ownerId: string): Promise<ConfigurationRow[]> {
    return this.prisma.configuration.findMany({
      where: { datasetId, ownerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(data: Prisma.ConfigurationUncheckedCreateInput): Promise<ConfigurationRow> {
    return this.prisma.configuration.create({ data });
  }

  /**
   * Publishes a private configuration owned by `ownerId`. The conditions are in
   * the UPDATE itself, so two concurrent publishes can't both apply.
   * Returns whether a row changed.
   */
  async publish(id: string, ownerId: string, at: Date): Promise<boolean> {
    const { count } = await this.prisma.configuration.updateMany({
      where: { id, ownerId, visibility: 'PRIVATE' },
      data: { visibility: 'PUBLISHED', publishedAt: at },
    });
    return count === 1;
  }
}
