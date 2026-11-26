import {
  apiErrorBodySchema,
  configurationDtoSchema,
  type ConfigurationScope,
  configurationScopeSchema,
  configurationSummarySchema,
  createConfigurationSchema,
  USER_ID_HEADER,
} from '@confmap/shared';
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { z } from 'zod';
import { UserId } from '../common/user-id.decorator.js';
import { ConfigurationsService } from './configurations.service.js';

const idSchema = z.uuid();

const optionalUser = ApiHeader({
  name: USER_ID_HEADER,
  required: false,
  description: 'Username of the caller. Needed to see your own private configurations.',
});
const requiredUser = ApiHeader({ name: USER_ID_HEADER, required: true, description: 'Username of the caller.' });
const errors = {
  badRequest: ApiBadRequestResponse({ description: 'Validation failed', standardSchema: apiErrorBodySchema }),
  unauthorized: ApiUnauthorizedResponse({ description: `Missing ${USER_ID_HEADER}`, standardSchema: apiErrorBodySchema }),
  forbidden: ApiForbiddenResponse({ description: 'Not the owner', standardSchema: apiErrorBodySchema }),
  notFound: ApiNotFoundResponse({
    description: 'Not found, or private and not yours',
    standardSchema: apiErrorBodySchema,
  }),
};

@ApiTags('Configurations')
@Controller()
export class ConfigurationsController {
  constructor(private readonly configurations: ConfigurationsService) {}

  /** Lists a dataset's configurations: the default, all published ones, or the caller's own. */
  @Get('datasets/:datasetId/configurations')
  @optionalUser
  @ApiQuery({ name: 'scope', enum: configurationScopeSchema.options })
  @ApiOkResponse({ standardSchema: z.array(configurationSummarySchema) })
  @errors.badRequest
  @errors.unauthorized
  @errors.notFound
  list(
    @Param('datasetId') datasetId: string,
    @Query('scope', { schema: configurationScopeSchema }) scope: ConfigurationScope,
    @UserId() userId?: string,
  ) {
    return this.configurations.list(datasetId, scope, userId);
  }

  /** The configuration loaded when the app starts. */
  @Get('datasets/:datasetId/configurations/default')
  @optionalUser
  @ApiOkResponse({ standardSchema: configurationDtoSchema })
  @errors.notFound
  getDefault(@Param('datasetId') datasetId: string, @UserId() userId?: string) {
    return this.configurations.getDefault(datasetId, userId);
  }

  /** Saves a new configuration owned by the caller, private unless `publish` is true. */
  @Post('datasets/:datasetId/configurations')
  @requiredUser
  @ApiCreatedResponse({ standardSchema: configurationDtoSchema })
  @errors.badRequest
  @errors.unauthorized
  @errors.notFound
  create(
    @Param('datasetId') datasetId: string,
    @Body({ schema: createConfigurationSchema }) body: z.output<typeof createConfigurationSchema>,
    @UserId({ required: true }) userId: string,
  ) {
    return this.configurations.create(datasetId, body, userId);
  }

  /** One configuration. Private ones are only visible to their owner. */
  @Get('configurations/:id')
  @optionalUser
  @ApiOkResponse({ standardSchema: configurationDtoSchema })
  @errors.badRequest
  @errors.notFound
  get(@Param('id', { schema: idSchema }) id: string, @UserId() userId?: string) {
    return this.configurations.get(id, userId);
  }

  /** Publishes the caller's private configuration so everyone can use it. Idempotent. */
  @Post('configurations/:id/publish')
  @HttpCode(HttpStatus.OK)
  @requiredUser
  @ApiOkResponse({ standardSchema: configurationDtoSchema })
  @errors.badRequest
  @errors.unauthorized
  @errors.forbidden
  @errors.notFound
  publish(@Param('id', { schema: idSchema }) id: string, @UserId({ required: true }) userId: string) {
    return this.configurations.publish(id, userId);
  }
}
